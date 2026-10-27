import { createContext, mutable, untrack } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import type { WindowAria } from './window.js';

/**
 * Front-to-back order of the windows sharing one desktop. The last entry is
 * in front. Windows join when they are created and leave when destroyed;
 * closing or minimizing keeps their place so a reopened window returns to it.
 */
export class WindowStack {
  /**
   * Window ids from back to front.
   */
  public readonly order: string[] = mutable<string[]>([]);
  /**
   * `released` is true after the desktop itself was pressed: no window is
   * active until one is pressed or focused again. Order is kept.
   */
  public readonly state = mutable({ released: false });
  private readonly windows = new Map<string, WindowAria>();

  /**
   * Leaves every window inactive, keeping their order. Called when the
   * desktop background is pressed.
   */
  public release(): void {
    if (untrack(() => this.state.released)) return;
    const front = untrack(() => this.front());
    this.state.released = true;
    front?.notifyRelease();
  }

  /**
   * The active window: the front-most visible one, unless the desktop released them all.
   */
  public get active(): WindowAria | undefined {
    return this.state.released ? undefined : this.front();
  }

  /**
   * Adds a window at the front.
   *
   * @param win - The window joining the stack.
   */
  public add(win: WindowAria): void {
    this.windows.set(win.id, win);
    this.raise(win.id);
    // A newly opened window is the active one, even right after the desktop was pressed.
    untrack(() => {
      if (this.state.released) this.state.released = false;
    });
  }

  /**
   * Removes a window from the stack.
   *
   * @param id - The leaving window's id.
   */
  public remove(id: string): void {
    this.windows.delete(id);
    // A write, not a read: windows join and leave during setup and teardown, where reads must not track.
    untrack(() => {
      const index = this.order.indexOf(id);
      if (index > -1) this.order.splice(index, 1);
    });
  }

  /**
   * Brings a window to the front.
   *
   * @param id - The window to raise.
   */
  public raise(id: string): void {
    untrack(() => {
      if (this.order.at(-1) === id) return;
      const index = this.order.indexOf(id);
      if (index > -1) this.order.splice(index, 1);
      this.order.push(id);
    });
  }

  /**
   * The window's depth, 1 at the back. Drives its stacking order in CSS.
   *
   * @param id - The window to look up.
   * @returns Its 1-based position from the back, or 0 when not in the stack.
   */
  public depth(id: string): number {
    return this.order.indexOf(id) + 1;
  }

  /**
   * The front-most window that is open and not minimized — the active one.
   *
   * @param except - A window to skip, e.g. the one closing right now.
   * @returns The active window, if any.
   */
  public front(except?: string): WindowAria | undefined {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const id = this.order[i];
      if (id === except) continue;
      const win = this.windows.get(id);
      if (win?.open && !win.minimized) return win;
    }
    return undefined;
  }

  /**
   * Every window on the stack, back to front.
   */
  public get all(): WindowAria[] {
    return this.order.map((id) => this.windows.get(id)).filter(Boolean) as WindowAria[];
  }
}

let pageStack: WindowStack | undefined;

/**
 * The stack windows share when no desktop encloses them.
 *
 * @returns The page-wide window stack.
 */
export function pageWindowStack(): WindowStack {
  pageStack ??= new WindowStack();
  return pageStack;
}

/**
 * Ambient desktop for windows created inside it.
 */
export const windowDesktopCtx = createContext<WindowDesktopAria>();

/**
 * Compiled attributes for a window desktop.
 */
export interface WindowDesktopProps extends AriaProps {
  /**
   * Space, in pixels, its windows leave where they meet face to face — another
   * window, a dock, the other half of a split. A window's own `snapGap` wins.
   * Defaults to 1.
   */
  snapGap?: number;
}

export interface WindowDesktopAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'data-window-desktop'?: 'true';
}

/**
 * The area windows live in. Windows created inside share its stack, stay
 * inside it unless given other bounds, and snap to its edges.
 */
export class WindowDesktopAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  WindowDesktopProps,
  WindowDesktopAttributes<E>
> {
  public readonly stack = new WindowStack();

  public constructor(props: Partial<WindowDesktopProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    windowDesktopCtx.set(this as never);
    this.omittedAttrs.push('data-window-desktop', 'snapGap');
    this.update();
  }

  /**
   * The space its windows leave where they meet each other or a dock, unless a window sets its own.
   */
  public get snapGap(): number | undefined {
    return this.properties.snapGap;
  }

  /**
   * The active window, if any.
   */
  public get active(): WindowAria | undefined {
    return this.stack.active;
  }

  protected createAttributes(): WindowDesktopAttributes<E> {
    return { 'data-window-desktop': 'true' };
  }

  /**
   * Pressing the bare desktop itself leaves every window inactive and takes
   * focus out of them. Pressing anything on it — a window, the dock, a widget
   * — doesn't: using the dock is not leaving the window being worked in.
   */
  protected attach() {
    const element = this.element as unknown as HTMLElement;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target !== element) return;

      this.stack.release();
      const focused = element.ownerDocument.activeElement as HTMLElement | null;
      if (focused && focused !== element && element.contains(focused)) focused.blur();
    };

    element.addEventListener('pointerdown', handlePointerDown);
    return () => element.removeEventListener('pointerdown', handlePointerDown);
  }
}
