import { $static, $symbol, createContext, mutable, uIndex, untrack } from '@airlib/core';
import { Aria } from '../../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
} from '../../types.js';
import {
  type DragBox,
  type DragConstraints,
  type DragEdge,
  type DragSizeLimits,
  measureDragFrame,
  moveBox,
  resizeBox,
} from '../../utils/drag.js';
import { queryFocusable } from '../../utils/navigation.js';
import { openDragSession } from '../../utils/pointer.js';
import { pageWindowStack, type WindowDesktopAria, type WindowStack, windowDesktopCtx } from './desktop.js';

const WINDOW_SYMBOL = $symbol('window');

/**
 * Ambient window for the parts created inside it.
 */
export const windowCtx = createContext<WindowAria>();

/**
 * A window's position and size, relative to the area it is positioned in.
 */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lifecycle and geometry notifications from a window.
 */
export type WindowEvent<T = void> = AriaEvent<T>;

/**
 * Reactive input properties for WindowAria.
 */
export interface WindowProps extends AriaProps, DragConstraints, DragSizeLimits {
  /**
   * Deterministic identifier; parts derive their ids from it.
   */
  id?: string;

  /**
   * Whether the window is showing. Defaults to true.
   */
  open?: boolean;

  /**
   * Left edge, in pixels, from the area the window is positioned in.
   */
  x?: number;

  /**
   * Top edge, in pixels, from the area the window is positioned in.
   */
  y?: number;

  width?: number;
  height?: number;

  /**
   * Whether the window is put away (hidden but kept, restorable).
   */
  minimized?: boolean;

  /**
   * Whether the window fills its area.
   */
  maximized?: boolean;

  /**
   * Whether the user may move the window. Defaults to true.
   */
  movable?: boolean;

  /**
   * Whether the user may resize the window. Defaults to true.
   */
  resizable?: boolean;

  /**
   * Locks moving, resizing, and the window buttons.
   */
  disabled?: boolean;

  /**
   * Pixels one arrow key moves or resizes the window when it has no grid. Defaults to 16.
   */
  keyStep?: number;

  /** Called when a move ends, with the new position. */
  onmove?: AriaEventHandler<WindowEvent<WindowRect>>;
  /** Called when a resize ends, with the new position and size. */
  onresize?: AriaEventHandler<WindowEvent<WindowRect>>;
  /** Called after the window closes. */
  onclose?: AriaEventHandler<WindowEvent>;
  /** Called after the window is minimized. */
  onminimize?: AriaEventHandler<WindowEvent>;
  /** Called after the window is maximized or restored from maximized, with the new state. */
  onmaximize?: AriaEventHandler<WindowEvent<boolean>>;
  /** Called after a minimized window comes back. */
  onrestore?: AriaEventHandler<WindowEvent>;
  /** Called when the window comes to the front or becomes active again. */
  onraise?: AriaEventHandler<WindowEvent>;
  /** Called when the window stops being active because its desktop was pressed. */
  onrelease?: AriaEventHandler<WindowEvent>;
}

/**
 * Compiled attributes for a window.
 */
export interface WindowAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'dialog';
  tabindex?: number;
  hidden?: boolean;
  'aria-labelledby'?: string;
  'data-active'?: 'true';
  'data-minimized'?: 'true';
  'data-maximized'?: 'true';
  'data-interaction'?: 'move' | 'resize';
  style?: Record<string, string>;
}

const WINDOW_KEYS = [
  'id',
  'open',
  'x',
  'y',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'minimized',
  'maximized',
  'movable',
  'resizable',
  'disabled',
  'keyStep',
  'grid',
  'bounds',
  'snap',
  'snapMode',
  'snapThreshold',
  'axis',
  'onmove',
  'onresize',
  'onclose',
  'onminimize',
  'onmaximize',
  'onrestore',
  'onraise',
  'onrelease',
];

/**
 * A movable, resizable, stackable window. It owns its geometry and window
 * state, joins the enclosing desktop's stack (or the page's), comes to the
 * front when pressed or focused, and emits its geometry as CSS variables:
 * `--window-x`, `--window-y`, `--window-width`, `--window-height`,
 * `--window-z`, and the min/max size limits.
 *
 * Keyboard: Tab and Shift+Tab cycle inside the window and never leave it.
 * With the window itself focused, arrows move it and Shift+arrows resize it,
 * by the grid step or `keyStep`.
 */
export class WindowAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  WindowProps,
  WindowAttributes<E>,
  AriaOptions
> {
  public readonly id: string;
  public readonly desktop?: WindowDesktopAria;
  public readonly stack: WindowStack;

  private readonly session = mutable<{ mode?: 'move' | 'resize' }>({});
  private closeSession?: () => void;

  public constructor(props: Partial<WindowProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.id = $static(() => this.properties.id ?? `window-${uIndex(WINDOW_SYMBOL, true)}`);
    this.desktop = windowDesktopCtx.get();
    this.stack = this.desktop?.stack ?? pageWindowStack();
    this.stack.add(this as never);
    windowCtx.set(this as never);

    this.cleanups.add(() => {
      this.closeSession?.();
      this.stack.remove(this.id);
    });
    this.omittedAttrs.push(
      ...WINDOW_KEYS,
      'role',
      'tabindex',
      'hidden',
      'aria-labelledby',
      'data-active',
      'data-minimized',
      'data-maximized',
      'data-interaction',
      'style'
    );
    this.update();
  }

  public get open(): boolean {
    return this.properties.open ?? true;
  }

  public get minimized(): boolean {
    return !!this.properties.minimized;
  }

  public get maximized(): boolean {
    return !!this.properties.maximized;
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  public get movable(): boolean {
    return !this.disabled && (this.properties.movable ?? true) && !this.maximized;
  }

  public get resizable(): boolean {
    return !this.disabled && (this.properties.resizable ?? true) && !this.maximized;
  }

  /**
   * Whether this is the front-most visible window of its stack.
   */
  public get active(): boolean {
    return this.stack.active === (this as never);
  }

  /**
   * What the user is doing to the window right now, if anything.
   */
  public get interaction(): 'move' | 'resize' | undefined {
    return this.session.mode;
  }

  /**
   * Brings the window to the front.
   */
  public raise(): void {
    const front = untrack(() => this.stack.order.at(-1)) === this.id;
    const released = untrack(() => this.stack.state.released);
    if (front && !released) return;
    if (released) this.stack.state.released = false;
    if (!front) this.stack.raise(this.id);
    this.emit('raise');
  }

  /**
   * Tells the window it stopped being active because the desktop was pressed.
   * Called by the stack; fires `onrelease`.
   */
  public notifyRelease(): void {
    this.emit('release');
  }

  /**
   * Opens the window and brings it to the front.
   */
  public show(): void {
    this.properties.open = true;
    this.raise();
  }

  /**
   * Closes the window and moves focus to the next one in front.
   */
  public close(): void {
    if (this.disabled || !this.open) return;
    this.properties.open = false;
    this.emit('close');
    this.focusNext();
  }

  /**
   * Puts the window away and moves focus to the next one in front.
   */
  public minimize(): void {
    if (this.disabled || this.minimized) return;
    this.properties.minimized = true;
    this.emit('minimize');
    this.focusNext();
  }

  /**
   * Brings a minimized window back to the front.
   */
  public restore(): void {
    if (this.minimized) {
      this.properties.minimized = false;
      this.emit('restore');
    }
    this.raise();
    this.focus();
  }

  /**
   * Toggles between filling the area and the window's own size.
   */
  public toggleMaximized(): void {
    if (this.disabled) return;
    this.properties.maximized = !this.maximized;
    this.emit('maximize', this.maximized);
  }

  /**
   * Moves the window to a position.
   *
   * @param x - Left edge from the positioning area.
   * @param y - Top edge from the positioning area.
   */
  public moveTo(x: number, y: number): void {
    this.assign({ x, y });
  }

  /**
   * Sets the window's position and size at once.
   *
   * @param rect - The new geometry; omitted fields keep their value.
   */
  public setRect(rect: Partial<WindowRect>): void {
    this.assign(rect);
  }

  /**
   * Starts moving the window with the pointer. Called by the drag handle.
   *
   * @param event - The pointerdown that started the move.
   */
  public startMove(event: PointerEvent): void {
    if (!this.movable || event.button !== 0 || !this.element) return;
    this.track(event, 'move', (start, dx, dy, frame) => moveBox(start, dx, dy, frame));
  }

  /**
   * Starts resizing the window from an edge or corner. Called by the resize handles.
   *
   * @param edge - The edge or corner being dragged.
   * @param event - The pointerdown that started the resize.
   */
  public startResize(edge: DragEdge, event: PointerEvent): void {
    if (!this.resizable || event.button !== 0 || !this.element) return;
    event.preventDefault();
    this.track(event, 'resize', (start, dx, dy, frame) => resizeBox(start, edge, dx, dy, frame, this.properties));
  }

  protected createAttributes(): WindowAttributes<E> {
    const { x, y, width, height, minWidth, minHeight, maxWidth, maxHeight } = this.properties;
    const style: Record<string, string> = { '--window-z': String(this.stack.depth(this.id)) };

    if (x !== undefined) style['--window-x'] = `${x}px`;
    if (y !== undefined) style['--window-y'] = `${y}px`;
    if (width !== undefined) style['--window-width'] = `${width}px`;
    if (height !== undefined) style['--window-height'] = `${height}px`;
    if (minWidth !== undefined) style['--window-min-width'] = `${minWidth}px`;
    if (minHeight !== undefined) style['--window-min-height'] = `${minHeight}px`;
    if (maxWidth !== undefined) style['--window-max-width'] = `${maxWidth}px`;
    if (maxHeight !== undefined) style['--window-max-height'] = `${maxHeight}px`;

    return {
      id: this.id,
      role: 'dialog',
      tabindex: -1,
      hidden: !this.open || undefined,
      'aria-labelledby': `${this.id}-title`,
      'data-active': this.active ? 'true' : undefined,
      'data-minimized': this.minimized ? 'true' : undefined,
      'data-maximized': this.maximized ? 'true' : undefined,
      'data-interaction': this.session.mode,
      style,
      onkeydown: this.handleKeyDown,
    };
  }

  protected attach() {
    const element = this.element as HTMLElement;
    const raise = () => this.raise();
    element.addEventListener('pointerdown', raise, true);
    element.addEventListener('focusin', raise);

    return () => {
      element.removeEventListener('pointerdown', raise, true);
      element.removeEventListener('focusin', raise);
    };
  }

  /**
   * Runs one pointer session: measures the frame once, maps every move
   * through `compute`, writes the result back as the window's geometry, and
   * reports the final rect when the pointer is released.
   */
  private track(
    event: PointerEvent,
    mode: 'move' | 'resize',
    compute: (start: DragBox, dx: number, dy: number, frame: ReturnType<typeof measureDragFrame>) => DragBox
  ): void {
    const element = this.element as HTMLElement;
    const rect = element.getBoundingClientRect();
    const origin = positioningOrigin(element);
    const start: DragBox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    const frame = measureDragFrame(element, this.properties, this.desktop?.current as HTMLElement | undefined);
    const before = this.rect(start, origin);
    const startX = event.clientX;
    const startY = event.clientY;

    this.closeSession?.();
    this.session.mode = mode;

    const apply = (box: DragBox) => {
      const next = this.rect(box, origin);
      this.assign(mode === 'move' ? { x: next.x, y: next.y } : next);
    };

    this.closeSession = openDragSession({
      onMove: (moveEvent) => apply(compute(start, moveEvent.clientX - startX, moveEvent.clientY - startY, frame)),
      onUp: () => {
        this.closeSession = undefined;
        this.session.mode = undefined;
        this.emit(mode, this.currentRect());
      },
      onCancel: () => {
        this.closeSession = undefined;
        this.session.mode = undefined;
        this.assign(mode === 'move' ? { x: before.x, y: before.y } : before);
      },
    });
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;

    if (event.key === 'Tab') {
      this.trapTab(event);
      return;
    }

    if (event.target !== this.element) return;

    const dir = ARROWS[event.key];
    if (!dir) return;

    const resizing = event.shiftKey;
    if (resizing ? !this.resizable : !this.movable) return;
    event.preventDefault();

    const element = this.element as HTMLElement;
    const rect = element.getBoundingClientRect();
    const origin = positioningOrigin(element);
    const start: DragBox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    const frame = measureDragFrame(element, { ...this.properties, snap: undefined }, this.desktop?.current as never);
    const stepX = frame.grid.x || (this.properties.keyStep ?? 16);
    const stepY = frame.grid.y || (this.properties.keyStep ?? 16);
    const dx = dir[0] * stepX;
    const dy = dir[1] * stepY;

    if (resizing) {
      const box = resizeBox(start, dx ? 'e' : 's', dx, dy, frame, this.properties);
      this.assign(this.rect(box, origin));
      this.emit('resize', this.currentRect());
    } else {
      const box = moveBox(start, dx, dy, frame);
      const next = this.rect(box, origin);
      this.assign({ x: next.x, y: next.y });
      this.emit('move', this.currentRect());
    }
  };

  /**
   * Keeps Tab inside the focused window: past the last control it wraps to
   * the first, and Shift+Tab past the first wraps to the last. Leaving a
   * window is a deliberate act — pressing another window, or its taskbar entry.
   */
  private trapTab(event: KeyboardEvent): void {
    const element = this.element as HTMLElement;
    const focusables = queryFocusable(element).filter((node) => node.getClientRects().length > 0);
    const current = element.ownerDocument.activeElement as HTMLElement | null;

    if (!focusables.length) {
      event.preventDefault();
      element.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const outside = !current || !focusables.includes(current);

    if (event.shiftKey && (current === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }

  private rect(box: DragBox, origin: { x: number; y: number }): WindowRect {
    return {
      x: Math.round(box.x - origin.x),
      y: Math.round(box.y - origin.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }

  private currentRect(): WindowRect {
    const element = this.element as HTMLElement;
    const rect = element.getBoundingClientRect();
    const origin = positioningOrigin(element);
    return this.rect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }, origin);
  }

  private focus(): void {
    const element = this.element as HTMLElement | null;
    if (element && !element.contains(document.activeElement)) element.focus();
  }

  private focusNext(): void {
    const element = this.element as HTMLElement | null;
    const hadFocus = !!element?.contains(document.activeElement);
    const next = this.stack.front(this.id);
    if (hadFocus && next) (next.current as HTMLElement | null)?.focus();
  }

  private emit<T>(type: string, detail?: T): void {
    const handler = this.properties[`on${type}`] as ((event: WindowEvent<T>) => void) | undefined;
    handler?.(new CustomEvent(type, { detail, bubbles: false }));
  }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Where (0, 0) of the window's `left`/`top` sits in client coordinates: the
 * padding box of its positioned ancestor, or the viewport for a fixed window.
 */
function positioningOrigin(element: HTMLElement): { x: number; y: number } {
  const parent = element.offsetParent as HTMLElement | null;
  if (!parent || getComputedStyle(element).position === 'fixed') return { x: 0, y: 0 };
  const rect = parent.getBoundingClientRect();
  return {
    x: rect.left + parent.clientLeft - parent.scrollLeft,
    y: rect.top + parent.clientTop - parent.scrollTop,
  };
}
