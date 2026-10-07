import { $static, $symbol, createContext, effect, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn } from '../types.js';
import { ButtonAria, type ButtonAttributes } from '../widgets/button.js';

const POPOVER_SYMBOL = $symbol('popover');

/**
 * Ambient instance context for the enclosing Popover coordinator.
 */
export const popoverCtx = createContext<PopoverAria>();

/**
 * Reactive input properties for PopoverAria.
 */
export interface PopoverProps extends AriaProps {
  /**
   * Deterministic identifier and namespace for child part derivation.
   */
  id?: string;

  /**
   * Whether the popover is currently open.
   */
  open?: boolean;

  /**
   * Whether the popover can be dismissed via outside click or Escape key.
   * @default true
   */
  dismissable?: boolean;

  /**
   * Horizontal placement token emitted as the `data-popover-x` DOM attribute.
   */
  xDir?: 'before' | 'after' | 'left' | 'between' | 'right';

  /**
   * Vertical placement token emitted as the `data-popover-y` DOM attribute.
   */
  yDir?: 'above' | 'below' | 'between';
}

/**
 * Configuration options for PopoverAria.
 */
export interface PopoverOptions extends AriaOptions {
  /**
   * Semantic popup role reflected in trigger aria-haspopup and panel role.
   * @default 'dialog'
   */
  popupRole?: 'dialog' | 'menu';
}

/**
 * Compiled HTML and ARIA attributes for a Popover coordinator host.
 */
export interface PopoverAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * Compiled HTML and ARIA attributes for a Popover trigger.
 */
export interface PopoverTriggerAttributes<E extends HTMLElement = HTMLButtonElement> extends ButtonAttributes<E> {
  'aria-haspopup'?: 'dialog' | 'menu';
  'aria-expanded'?: 'true' | 'false';
  'aria-controls'?: string;
}

/**
 * Compiled HTML and ARIA attributes for a Popover panel.
 */
export interface PopoverPanelAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'dialog' | 'menu';
  hidden?: boolean;
  popover?: 'auto' | 'manual';
  'data-popover-x'?: 'before' | 'after' | 'left' | 'between' | 'right';
  'data-popover-y'?: 'above' | 'below' | 'between';
}

/**
 * Creates a reactive non-modal popover composite coordinator.
 *
 * @param props - Initial popover properties
 * @param options - Controller configuration options
 * @returns A new PopoverAria controller instance
 */
export function popover<E extends HTMLElement = HTMLElement>(
  props?: PopoverProps,
  options?: PopoverOptions
): PopoverAria<E> {
  return new PopoverAria<E>(props, options);
}

/**
 * Root coordinator controller for an anchored floating popover composite widget.
 */
export class PopoverAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  PopoverProps,
  PopoverAttributes<E>,
  PopoverOptions
> {
  public id: string;

  public constructor(props: Partial<PopoverProps> = {}, options: PopoverOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id', 'open', 'dismissable', 'xDir', 'yDir');
    this.id = $static(() => this.properties.id ?? `popover-${uIndex(POPOVER_SYMBOL, true)}`);
    popoverCtx.set(this as never);
    this.update();
  }

  public get open(): boolean {
    return !!this.properties.open;
  }

  public set open(value: boolean) {
    this.properties.open = value;
  }

  public get dismissable(): boolean {
    return this.properties.dismissable ?? true;
  }

  public get popupRole(): 'dialog' | 'menu' {
    return this.options.popupRole ?? 'dialog';
  }

  public toggle(): void {
    this.open = !this.open;
  }

  public show(): void {
    this.open = true;
  }

  public close(): void {
    this.open = false;
  }

  public trigger<T extends HTMLElement = HTMLButtonElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): PopoverTriggerAria<T> {
    return new PopoverTriggerAria<T>(props, options);
  }

  public panel<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): PopoverPanelAria<T> {
    return new PopoverPanelAria<T>(props, options);
  }

  protected override createAttributes(): PopoverAttributes<E> {
    return {
      id: this.id,
    };
  }
}

/**
 * Interactive trigger button controller for opening and closing a popover.
 */
export class PopoverTriggerAria<E extends HTMLElement = HTMLButtonElement> extends ButtonAria<
  E,
  AriaProps,
  PopoverTriggerAttributes<E>,
  AriaOptions
> {
  public popover?: PopoverAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.popover = popoverCtx.get();
    this.omittedAttrs.push('aria-haspopup', 'aria-expanded', 'aria-controls', 'style');
    this.update();
  }

  protected override createAttributes(): PopoverTriggerAttributes<E> {
    const parent = this.popover;
    const parentId = parent?.id ?? 'popover';
    const isOpen = !!parent?.open;
    const base = super.createAttributes();

    base['aria-haspopup'] = parent?.popupRole ?? 'dialog';
    base['aria-expanded'] = isOpen ? 'true' : 'false';
    base['aria-controls'] = `${parentId}-panel`;
    if (isOpen) {
      base.style = {
        '--popover-anchor-name': `--popover-anchor-${parentId}`,
      };
    }
    base.onclick = (e: MouseEvent) => this.handleClick(e);

    return base;
  }

  protected handleClick(e: MouseEvent): void {
    if (this.disabled || e.defaultPrevented) {
      e.preventDefault();
      return;
    }
    const parent = this.popover;
    parent?.toggle();
  }

  protected override attach(): DetachFn {
    const cleanups: Array<() => void> = [];
    const superDetach = super.attach();
    if (superDetach) {
      cleanups.push(superDetach);
    }
    const el = this.element;

    if (el) {
      const stopEffect = effect(() => {
        const parent = this.popover;
        const isOpen = !!parent?.open;
        const parentId = parent?.id ?? 'popover';

        if (isOpen) {
          el.style.setProperty('anchor-name', `--popover-anchor-${parentId}`);
        } else {
          el.style.removeProperty('anchor-name');
        }
      });
      cleanups.push(stopEffect);
    }

    return () => {
      if (el) {
        el.style.removeProperty('anchor-name');
      }
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }
}

/**
 * Overlay panel controller for an anchored floating popover.
 */
export class PopoverPanelAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  PopoverPanelAttributes<E>,
  AriaOptions
> {
  public popover?: PopoverAria;
  protected triggerElement: HTMLElement | null = null;
  protected previousFocused: HTMLElement | null = null;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.popover = popoverCtx.get();
    this.omittedAttrs.push('id', 'role', 'hidden', 'popover', 'style', 'data-popover-x', 'data-popover-y');
    this.update();
  }

  protected override createAttributes(): PopoverPanelAttributes<E> {
    const parent = this.popover;
    const parentId = parent?.id ?? 'popover';
    const isOpen = !!parent?.open;

    const attrs: PopoverPanelAttributes<E> = {
      id: `${parentId}-panel`,
      role: parent?.popupRole ?? 'dialog',
    };

    if (this.isNative) {
      attrs.popover = parent?.dismissable ? 'auto' : 'manual';
    } else {
      attrs.hidden = !isOpen;
    }

    if (parent?.properties.xDir) {
      attrs['data-popover-x'] = parent.properties.xDir;
    }
    if (parent?.properties.yDir) {
      attrs['data-popover-y'] = parent.properties.yDir;
    }

    attrs.style = {
      '--popover-anchor-name': `--popover-anchor-${parentId}`,
    };

    return attrs;
  }

  protected override attach(): DetachFn {
    const el = this.element!;
    const cleanups: Array<() => void> = [];
    let wasOpen = !!this.popover?.open;

    if (el && this.popover) {
      const parentId = this.popover.id ?? 'popover';
      el.style.setProperty('position-anchor', `--popover-anchor-${parentId}`);
    }

    const stopEffect = effect(() => {
      const parent = this.popover;
      const isOpen = !!parent?.open;

      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        const evt = new CustomEvent<boolean>('toggle', { bubbles: false, detail: isOpen });
        el?.dispatchEvent(evt);

        if (isOpen) {
          this.previousFocused = document.activeElement as HTMLElement | null;
          const firstFocusable = el?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (firstFocusable) {
            firstFocusable.focus();
          } else if (el && el.tabIndex >= 0) {
            el.focus();
          }
        } else {
          if (this.previousFocused && document.contains(this.previousFocused)) {
            this.previousFocused.focus();
          }
          this.previousFocused = null;
        }
      }
    });
    cleanups.push(stopEffect);

    const handlePointerDown = (e: MouseEvent) => {
      const parent = this.popover;
      if (!parent?.open || !parent.dismissable) {
        return;
      }

      const target = e.target as Node | null;
      if (target && !el.contains(target)) {
        const triggerNode = document.querySelector(`[aria-controls="${el.id}"]`);
        if (triggerNode?.contains(target)) {
          return;
        }
        parent.close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const parent = this.popover;
      if (!parent?.open || !parent.dismissable) {
        return;
      }

      if (e.key === 'Escape') {
        parent.close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    cleanups.push(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    });

    return () => {
      if (el) {
        el.style.removeProperty('position-anchor');
      }
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }
}
