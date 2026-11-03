import { $static, $symbol, type AnyType, createContext, mutable, uIndex, untrack } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import {
  type DragBox,
  type DragConstraints,
  type DragEdge,
  type DragSizeLimits,
  measureDragFrame,
  moveBox,
  resizeBox,
} from '../../utils/drag.js';
import { FOCUSABLE_SELECTOR, trapTab } from '../../utils/navigation.js';
import { openDragSession } from '../../utils/pointer.js';
import { pageWindowStack, type WindowDesktopAria, windowDesktopCtx, type WindowStack } from './desktop.js';

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
 * Elements that keep their own pointer behavior instead of moving their
 * window: anything focusable or operable, by tag or by role.
 */
export const WINDOW_INTERACTIVE = [
  FOCUSABLE_SELECTOR,
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  ...[
    'button',
    'link',
    'option',
    'treeitem',
    'tab',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'spinbutton',
    'gridcell',
    'textbox',
    'combobox',
  ].map((role) => `[role="${role}"]`),
].join(', ');

/**
 * Marks what a press inside a window lands on: a surface people work on
 * (content, a sidebar panel) never moves the window; a drag handle does. The
 * nearest marker wins, and the window's unmarked glass moves it too.
 */
const WINDOW_SURFACE = '[data-window-surface]';
const WINDOW_MARKERS = '[data-window-surface], [data-window-drag]';

/** One half of a window's area. */
export type WindowHalf = 'left' | 'right' | 'top' | 'bottom';

/** How two windows share an area: `vertical` side by side, `horizontal` one above the other. */
export type WindowSplit = 'horizontal' | 'vertical';

/**
 * Reactive input properties for WindowAria.
 */
export interface WindowProps extends AriaProps, DragConstraints, DragSizeLimits {
  /**
   * Deterministic identifier; parts derive their ids from it.
   */
  id?: string;

  /**
   * Accessible name for a window that draws no title. Without it, the window
   * is named by its `window-title` part.
   */
  label?: string;

  /**
   * Whether maximizing and the half layouts leave room for a dock — any
   * element marked `data-dock` in the window's area — so the window never
   * reaches beneath it. Defaults to true.
   */
  dockAware?: boolean;

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
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-active'?: 'true';
  'data-minimized'?: 'true';
  'data-maximized'?: 'true';
  'data-interaction'?: 'move' | 'resize';
  style?: Record<string, string>;
}

const WINDOW_KEYS = [
  'id',
  'label',
  'dockAware',
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
  'snapGap',
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

  private readonly session = mutable<{ mode?: 'move' | 'resize'; reserve?: AreaReserve }>({});
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
      'aria-label',
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

  /**
   * The space the window leaves where it meets something face to face: its
   * own `snapGap`, else its desktop's, else 1.
   */
  public get snapGap(): number {
    return this.properties.snapGap ?? this.desktop?.snapGap ?? 1;
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
    if (!this.maximized) this.measureReserve();
    this.properties.maximized = !this.maximized;
    this.emit('maximize', this.maximized);
  }

  /**
   * Fills one half of the window's area — its desktop, or the viewport —
   * leaving maximized first.
   *
   * @param half - Which half to fill: `left`, `right`, `top`, or `bottom`.
   */
  public snapTo(half: WindowHalf): void {
    if (this.disabled || !this.element) return;
    this.place(halfRect(tilingArea(this.element as HTMLElement, this.reserveGap()), half, this.snapGap));
  }

  /**
   * Fills the whole area at the window's own size — its desktop, or the viewport, short of a
   * dock — without maximizing, so moving or resizing it afterwards works as usual.
   */
  public fill(): void {
    if (this.disabled || !this.element) return;
    const { x, y, width, height } = tilingArea(this.element as HTMLElement, this.reserveGap());
    this.place({ x, y, width, height });
  }

  /**
   * Tiles the area in four with up to three windows behind this one. This window takes the
   * quarter it mostly sits in; the windows behind take the rest, front-most first.
   */
  public tileQuarters(): void {
    if (this.disabled || !this.element) return;
    const area = tilingArea(this.element as HTMLElement, this.reserveGap());
    const rect = this.currentRect();
    const right = rect.x + rect.width / 2 > area.x + area.width / 2;
    const bottom = rect.y + rect.height / 2 > area.y + area.height / 2;
    const quarters = quarterRects(area, this.snapGap);
    const mine = (bottom ? 2 : 0) + (right ? 1 : 0);

    const behind = this.stack.all
      .filter((win) => win !== (this as AnyType) && win.open && !win.minimized)
      .reverse()
      .slice(0, 3);
    const rest = quarters.filter((_, index) => index !== mine);

    this.place(quarters[mine]);
    behind.forEach((win, index) => win.place(rest[index]));
    this.raise();
  }

  /**
   * Shares the area with the window behind this one: side by side with a
   * vertical split, one above the other with a horizontal split. This window
   * takes the half it mostly sits in — the left or top one when centered —
   * the other window the opposite one, and this window stays in front.
   *
   * @param split - `vertical` for side by side, `horizontal` for stacked.
   */
  public pairWith(split: WindowSplit): void {
    if (this.disabled || !this.element) return;
    const other = this.stack.front(this.id);
    const [first, second]: WindowHalf[] = split === 'vertical' ? ['left', 'right'] : ['top', 'bottom'];
    const area = tilingArea(this.element as HTMLElement, this.reserveGap());
    const rect = this.currentRect();
    const later =
      split === 'vertical'
        ? rect.x + rect.width / 2 > area.x + area.width / 2
        : rect.y + rect.height / 2 > area.y + area.height / 2;
    this.snapTo(later ? second : first);
    other?.snapTo(later ? first : second);
    this.raise();
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

    const reserve = this.session.reserve;
    if (this.maximized && reserve) {
      style['--window-reserve-top'] = `${reserve.top}px`;
      style['--window-reserve-bottom'] = `${reserve.bottom}px`;
    }

    return {
      id: this.id,
      role: 'dialog',
      tabindex: -1,
      hidden: !this.open || undefined,
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.label ? undefined : `${this.id}-title`,
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
    element.addEventListener('pointerdown', this.handleFrameDown);
    element.addEventListener('focusin', raise);
    if (this.maximized) this.measureReserve();

    return () => {
      element.removeEventListener('pointerdown', raise, true);
      element.removeEventListener('pointerdown', this.handleFrameDown);
      element.removeEventListener('focusin', raise);
    };
  }

  /**
   * Moves the window from any press on its glass: not on a control, and not
   * inside a surface unless a drag handle sits nearer. Resize grips claim
   * their press first, so they keep resizing.
   */
  private readonly handleFrameDown = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    const element = this.element as HTMLElement;
    if (event.defaultPrevented || !target?.closest || target.closest(WINDOW_INTERACTIVE)) return;
    const marker = target.closest(WINDOW_MARKERS);
    if (marker && element.contains(marker) && marker.matches(WINDOW_SURFACE)) return;
    this.startMove(event);
  };

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
    const frame = measureDragFrame(element, this.constraints(), this.desktop?.current as HTMLElement | undefined);
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

    // Leaving a window is a deliberate act — pressing another window, or its taskbar entry.
    if (event.key === 'Tab') {
      trapTab(this.element as HTMLElement, event);
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
    const frame = measureDragFrame(element, { ...this.constraints(), snap: undefined }, this.desktop?.current as never);
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

  private rect(box: DragBox, origin: { x: number; y: number }): WindowRect {
    return {
      x: Math.round(box.x - origin.x),
      y: Math.round(box.y - origin.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }

  // A tiled window leaves maximized first, so its new rect is what shows.
  private place(rect: WindowRect): void {
    if (this.maximized) this.toggleMaximized();
    this.assign(rect);
    this.emit('resize', rect);
  }

  private currentRect(): WindowRect {
    const element = this.element as HTMLElement;
    const rect = element.getBoundingClientRect();
    const origin = positioningOrigin(element);
    return this.rect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }, origin);
  }

  /** The space kept between a tiled window and a dock; undefined when the window ignores docks. */
  private reserveGap(): number | undefined {
    return this.properties.dockAware === false ? undefined : this.snapGap;
  }

  /** The drag constraints with the window's effective gap, for a pointer or keyboard session. */
  private constraints(): WindowProps {
    return { ...this.properties, snapGap: this.snapGap };
  }

  /** Records how much of the area's top and bottom the docks take, for a maximized window to stay clear of. */
  private measureReserve(): void {
    if (!this.element) return;
    this.session.reserve = tilingArea(this.element as HTMLElement, this.reserveGap()).reserve;
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

/** How much of an area's top and bottom docks take, in pixels. */
type AreaReserve = { top: number; bottom: number };

/** The part of a window's area that tiling may fill, and what docks reserve around it. */
type TilingArea = WindowRect & { reserve: AreaReserve };

const DOCK_SELECTOR = '[data-dock]';

/**
 * The area a window tiles into — its positioned ancestor's padding box, or
 * the viewport for a fixed window — in the window's own `left`/`top`
 * coordinates. With a gap, every rendered dock in that area takes its edge:
 * a dock in the lower half reserves the bottom up to its top edge, one in
 * the upper half the top down to its bottom edge, each plus the gap.
 *
 * @param element - The window.
 * @param gap - Space kept from a dock; undefined to ignore docks.
 * @returns The fillable rect and the reserved top and bottom.
 */
function tilingArea(element: HTMLElement, gap?: number): TilingArea {
  const parent = element.offsetParent as HTMLElement | null;
  const fixed = !parent || getComputedStyle(element).position === 'fixed';
  const width = fixed ? window.innerWidth : (parent as HTMLElement).clientWidth;
  const height = fixed ? window.innerHeight : (parent as HTMLElement).clientHeight;
  const reserve: AreaReserve = { top: 0, bottom: 0 };

  if (gap !== undefined) {
    const origin = positioningOrigin(element);
    const scope: ParentNode = fixed ? element.ownerDocument : (parent as HTMLElement);

    for (const dock of scope.querySelectorAll(DOCK_SELECTOR) as never as HTMLElement[]) {
      if (!dock.getClientRects().length) continue;
      const rect = dock.getBoundingClientRect();
      const top = rect.top - origin.y;
      const bottom = rect.bottom - origin.y;
      if (bottom <= 0 || top >= height) continue;

      if (top + rect.height / 2 > height / 2) {
        reserve.bottom = Math.max(reserve.bottom, Math.ceil(height - top + gap));
      } else {
        reserve.top = Math.max(reserve.top, Math.ceil(bottom + gap));
      }
    }
  }

  return { x: 0, y: reserve.top, width, height: height - reserve.top - reserve.bottom, reserve };
}

/**
 * One half of a tiling area. The two halves leave the gap between them, as
 * windows snapped face to face do; the area's own edges stay flush.
 *
 * @param area - The area to split.
 * @param half - Which half.
 * @param gap - Space between the two halves, in pixels.
 * @returns The half's rect, in the window's `left`/`top` coordinates.
 */
function halfRect(area: WindowRect, half: WindowHalf, gap: number): WindowRect {
  const firstWidth = Math.floor((area.width - gap) / 2);
  const firstHeight = Math.floor((area.height - gap) / 2);

  if (half === 'left') return { x: area.x, y: area.y, width: firstWidth, height: area.height };
  if (half === 'right') {
    return { x: area.x + firstWidth + gap, y: area.y, width: area.width - firstWidth - gap, height: area.height };
  }
  if (half === 'top') return { x: area.x, y: area.y, width: area.width, height: firstHeight };
  return { x: area.x, y: area.y + firstHeight + gap, width: area.width, height: area.height - firstHeight - gap };
}

/**
 * The four quarters of a tiling area, leaving the gap between them as halves do.
 *
 * @param area - The area to split.
 * @param gap - Space between neighboring quarters, in pixels.
 * @returns Top left, top right, bottom left, bottom right.
 */
function quarterRects(area: WindowRect, gap: number): WindowRect[] {
  const left = halfRect(area, 'left', gap);
  const right = halfRect(area, 'right', gap);
  return [
    halfRect(left, 'top', gap),
    halfRect(right, 'top', gap),
    halfRect(left, 'bottom', gap),
    halfRect(right, 'bottom', gap),
  ];
}

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
