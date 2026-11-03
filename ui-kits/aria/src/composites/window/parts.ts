import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import type { DragEdge } from '../../utils/drag.js';
import { WINDOW_INTERACTIVE, type WindowAria, windowCtx } from './window.js';

/**
 * Compiled attributes for a window drag handle.
 */
export interface WindowDragAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'data-movable'?: 'true';
  'data-window-drag'?: 'true';
}

/**
 * The area that moves its window — usually the toolbar. The window itself
 * starts the move: this part marks a handle, which wins over a surface around
 * it, so a header inside a content panel can move the window too.
 * Double-clicking it maximizes or restores. Controls inside it keep their own
 * behavior.
 */
export class WindowDragAria<E extends BaseElement = HTMLElement> extends Aria<E, AriaProps, WindowDragAttributes<E>> {
  protected window?: WindowAria = windowCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('data-movable', 'data-window-drag');
    this.update();
  }

  protected createAttributes(): WindowDragAttributes<E> {
    return {
      'data-movable': this.window?.movable ? 'true' : undefined,
      'data-window-drag': 'true',
      ondblclick: this.handleDoubleClick,
    };
  }

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || (event.target as Element).closest?.(WINDOW_INTERACTIVE)) return;
    if (this.window && (this.window.properties.resizable ?? true)) this.window.toggleMaximized();
  };
}

/**
 * Reactive input properties for a window resize handle.
 */
export interface WindowResizeProps extends AriaProps {
  /**
   * The edge or corner this handle drags.
   */
  edge: DragEdge;
}

/**
 * Compiled attributes for a window resize handle.
 */
export interface WindowResizeAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  hidden?: boolean;
  'aria-hidden'?: 'true';
  'data-edge'?: DragEdge;
}

/**
 * A pointer grip on one edge or corner of its window. Hidden while the
 * window can't be resized; keyboard resizing lives on the window itself.
 */
export class WindowResizeAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  WindowResizeProps,
  WindowResizeAttributes<E>
> {
  protected window?: WindowAria = windowCtx.get();

  public constructor(props: Partial<WindowResizeProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('edge', 'hidden', 'aria-hidden', 'data-edge');
    this.update();
  }

  public get edge(): DragEdge {
    return this.properties.edge ?? 'se';
  }

  protected createAttributes(): WindowResizeAttributes<E> {
    return {
      hidden: !this.window?.resizable || undefined,
      'aria-hidden': 'true',
      'data-edge': this.edge,
      onpointerdown: this.handlePointerDown,
    };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.defaultPrevented) return;
    this.window?.startResize(this.edge, event);
  };
}

/**
 * Compiled attributes for a window title.
 */
export interface WindowTitleAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * The window's heading; the window is named by it.
 */
export class WindowTitleAria<E extends BaseElement = HTMLElement> extends Aria<E, AriaProps, WindowTitleAttributes<E>> {
  protected window?: WindowAria = windowCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id');
    this.update();
  }

  protected createAttributes(): WindowTitleAttributes<E> {
    return { id: `${this.window?.id ?? 'window'}-title` };
  }
}

/**
 * Compiled attributes for a window button.
 */
export interface WindowButtonAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'button';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true';
  'aria-pressed'?: 'true' | 'false';
}

/**
 * Shared base for the buttons that act on their window. Names come from the
 * consumer (`aria-label` or text); none is built in.
 */
abstract class WindowButtonAria<E extends BaseElement = HTMLButtonElement> extends Aria<
  E,
  AriaProps,
  WindowButtonAttributes<E>
> {
  protected window?: WindowAria = windowCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, { native: true, ...options, clickable: true });
    this.omittedAttrs.push('role', 'type', 'disabled', 'tabindex', 'aria-disabled', 'aria-pressed');
    // Like any button, so an overlay inside it (the maximize button's layout popup) finds it as its trigger.
    this.markActionable();
    this.update();
  }

  public get disabled(): boolean {
    return !!(this.properties.disabled || this.window?.disabled);
  }

  protected abstract act(): void;

  protected createAttributes(): WindowButtonAttributes<E> {
    const attrs: WindowButtonAttributes<E> = { onclick: this.handleClick };

    if (this.isNative) {
      attrs.type = 'button';
      if (this.disabled) attrs.disabled = true;
    } else {
      attrs.role = 'button';
      attrs.tabindex = this.disabled ? -1 : 0;
      if (this.disabled) attrs['aria-disabled'] = 'true';
    }

    return attrs;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    this.act();
  };
}

/**
 * Button that closes its window.
 */
export class WindowCloseAria<E extends BaseElement = HTMLButtonElement> extends WindowButtonAria<E> {
  protected act(): void {
    this.window?.close();
  }
}

/**
 * Button that minimizes its window.
 */
export class WindowMinimizeAria<E extends BaseElement = HTMLButtonElement> extends WindowButtonAria<E> {
  protected act(): void {
    this.window?.minimize();
  }
}

/**
 * Toggle button that maximizes its window or restores it; pressed while maximized.
 */
export class WindowMaximizeAria<E extends BaseElement = HTMLButtonElement> extends WindowButtonAria<E> {
  protected act(): void {
    this.window?.toggleMaximized();
  }

  protected createAttributes(): WindowButtonAttributes<E> {
    const attrs = super.createAttributes();
    attrs['aria-pressed'] = this.window?.maximized ? 'true' : 'false';
    return attrs;
  }
}
