import { $static, $symbol, effect, type StyleInput, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, DetachFn } from '../types.js';

const POPOVER_SYMBOL = $symbol('popover');

/**
 * Supported activation trigger modes for anchored overlays.
 */
export type OverlayTriggerMode = 'hover' | 'focus' | 'click';

/**
 * Reactive input properties for PopoverAria and overlay subclasses.
 */
/**
 * Controller-dispatched popover visibility event carrying the open state in `detail`.
 */
export type PopoverEvent = AriaEvent<boolean>;

export interface PopoverProps extends AriaProps {
  /**
   * Called with the open state after the popover toggles.
   */
  ontoggle?: AriaEventHandler<PopoverEvent>;

  /**
   * DOM element identifier for the overlay panel.
   */
  id?: string;

  /**
   * Whether the overlay is currently open and visible.
   * @default false
   */
  open?: boolean;

  /**
   * Activation trigger modes for opening and closing the overlay.
   * @default ['click']
   */
  mode?: OverlayTriggerMode[];

  /**
   * Delay in milliseconds before opening on pointer hover.
   * @default 0
   */
  delay?: number;

  /**
   * Light-dismissal flag: outside click and Escape dismiss when true.
   * @default true
   */
  dismissable?: boolean;

  /**
   * Horizontal placement token.
   */
  xDir?: 'before' | 'after' | 'left' | 'between' | 'right';

  /**
   * Vertical placement token.
   */
  yDir?: 'top' | 'bottom' | 'above' | 'below' | 'between';
}

/**
 * Controller configuration options for PopoverAria.
 */
export interface PopoverOptions extends AriaOptions {
  /**
   * Semantic popup role reflected in the panel role.
   * @default 'dialog'
   */
  popupRole?: 'dialog' | 'menu';
}

/**
 * Compiled HTML and ARIA attributes for a Popover overlay.
 */
export interface PopoverAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'dialog' | 'menu' | 'tooltip';
  popover?: 'auto' | 'manual';
  hidden?: boolean;
  'data-popover-x'?: 'before' | 'after' | 'left' | 'between' | 'right';
  'data-popover-y'?: 'top' | 'bottom' | 'above' | 'below' | 'between';
  'data-tooltip-x'?: 'before' | 'after' | 'left' | 'between' | 'right';
  'data-tooltip-y'?: 'top' | 'bottom' | 'above' | 'below' | 'between';
}

/**
 * Creates a reactive non-modal anchored floating popover controller.
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
 * Headless anchored overlay widget coordinating trigger activation modes (click, hover, focus),
 * light dismissal, focus management, and automatic trigger candidate linkage via ambient scope.
 */
export class PopoverAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  PopoverProps,
  PopoverAttributes<E>,
  PopoverOptions
> {
  public id: string;
  protected target?: Aria<HTMLElement, AriaProps, AriaAttributes<HTMLElement>>;
  protected previousFocused: HTMLElement | null = null;
  protected openTimer?: ReturnType<typeof setTimeout>;
  protected cleanups = new Set<() => void>();

  public get mode(): OverlayTriggerMode[] {
    return this.properties.mode ?? ['click'];
  }

  public get delay(): number {
    return this.properties.delay ?? 0;
  }

  public set delay(value: number) {
    this.properties.delay = value;
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

  public get popupRole(): 'dialog' | 'menu' | 'tooltip' {
    return this.options.popupRole ?? 'dialog';
  }

  public constructor(props: Partial<PopoverProps> = {}, options: PopoverOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('open', 'mode', 'delay', 'dismissable', 'lightDismiss', 'xDir', 'yDir', 'ontoggle');
    this.id = $static(() => this.properties.id ?? `${this.anchorPrefix}-${uIndex(this.instanceSymbol, true)}`);

    const candidate = this.scope?.actionable;
    if (candidate) {
      this.target = candidate as never;
      const unrefine = candidate.refine(() => {
        const attrs: Record<string, unknown> = {
          ...this.createTriggerAttributes(),
          style: this.open
            ? {
                'anchor-name': `--${this.anchorPrefix}-anchor-${this.id}`,
                [`--${this.anchorPrefix}-anchor-name`]: `--${this.anchorPrefix}-anchor-${this.id}`,
              }
            : undefined,
        };

        if (this.mode.includes('click')) {
          attrs.onclick = (e: MouseEvent) => this.handleClick(e);
        }
        if (this.mode.includes('hover')) {
          attrs.onpointerenter = () => this.handleTriggerEnter();
          attrs.onpointerleave = (e: PointerEvent) => this.handleTriggerLeave(e);
        }
        if (this.mode.includes('focus')) {
          attrs.onfocus = () => this.handleFocus();
          attrs.onblur = () => this.handleBlur();
        }
        attrs.onkeydown = (e: KeyboardEvent) => this.handleKeyDown(e);

        return attrs;
      });
      this.cleanups.add(unrefine);
    }

    this.update();
  }

  public toggle(): void {
    this.open = !this.open;
  }

  public show(): void {
    this.cancelOpen();
    this.open = true;
  }

  public close(): void {
    this.cancelOpen();
    this.open = false;
  }

  public scheduleOpen(): void {
    this.cancelOpen();
    if (this.delay > 0) {
      this.openTimer = setTimeout(() => {
        this.open = true;
      }, this.delay);
    } else {
      this.open = true;
    }
  }

  public cancelOpen(): void {
    if (this.openTimer !== undefined) {
      clearTimeout(this.openTimer);
      this.openTimer = undefined;
    }
  }

  public override destroy(): void {
    this.cancelOpen();
    if (this.open && this.managesFocus) {
      const restoreTarget = this.target?.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    }
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups.clear();
    super.destroy();
  }

  protected get anchorPrefix(): string {
    return 'popover';
  }

  protected get instanceSymbol(): symbol {
    return POPOVER_SYMBOL;
  }

  protected get managesFocus(): boolean {
    return true;
  }

  protected handleClick(e: MouseEvent): void {
    if (e.defaultPrevented) return;
    if (this.element?.contains(e.target as Node)) return;
    this.toggle();
  }

  protected handleTriggerEnter(): void {
    this.scheduleOpen();
  }

  protected handleTriggerLeave(e: PointerEvent): void {
    if (this.element?.contains(e.relatedTarget as Node)) return;
    this.close();
  }

  protected handleFocus(): void {
    this.show();
  }

  protected handleBlur(): void {
    this.close();
  }

  protected handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      if (this.managesFocus) {
        const restoreTarget = this.previousFocused ?? this.target?.current;
        if (restoreTarget && document.contains(restoreTarget)) {
          restoreTarget.focus();
        }
      }
    }
  }

  protected createTriggerAttributes(): Record<string, unknown> {
    return {
      'aria-haspopup': 'dialog',
      'aria-expanded': this.open ? 'true' : 'false',
      'aria-controls': this.id,
    };
  }

  protected applyFallbackTrigger(hostEl: HTMLElement, isOpen: boolean): void {
    hostEl.setAttribute('aria-haspopup', 'dialog');
    hostEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    hostEl.setAttribute('aria-controls', this.id);
  }

  protected removeFallbackTrigger(hostEl: HTMLElement): void {
    hostEl.removeAttribute('aria-haspopup');
    hostEl.removeAttribute('aria-expanded');
    hostEl.removeAttribute('aria-controls');
  }

  protected dispatchVisibilityEvent(el: HTMLElement, isOpen: boolean): void {
    const event: PopoverEvent = new CustomEvent('toggle', { bubbles: false, detail: isOpen });
    el.dispatchEvent(event);
    this.properties.ontoggle?.(event);
  }

  protected override createAttributes(): PopoverAttributes<E> {
    const attrs: PopoverAttributes<E> = {
      id: this.id,
      role: this.popupRole,
    };

    if (this.isNative) {
      attrs.popover = this.dismissable ? 'auto' : 'manual';
    } else if (!this.open) {
      attrs.hidden = true;
    }

    if (this.open) {
      attrs.style = {
        'position-anchor': `--${this.anchorPrefix}-anchor-${this.id}`,
        [`--${this.anchorPrefix}-anchor-name`]: `--${this.anchorPrefix}-anchor-${this.id}`,
      } as StyleInput;
    }

    if (this.properties.xDir) {
      attrs[`data-${this.anchorPrefix}-x`] = this.properties.xDir;
    }
    if (this.properties.yDir) {
      attrs[`data-${this.anchorPrefix}-y`] = this.properties.yDir;
    }

    return attrs;
  }

  protected override attach(): DetachFn {
    const el = this.element!;
    const cleanups: Array<() => void> = [];
    const hostEl = this.target?.current ?? el.parentElement;

    if (hostEl && !this.target) {
      this.applyFallbackTrigger(hostEl, this.open);

      const cleanHost: Array<() => void> = [];
      if (this.mode.includes('click')) {
        const onClick = (e: MouseEvent) => this.handleClick(e);
        hostEl.addEventListener('click', onClick);
        cleanHost.push(() => hostEl.removeEventListener('click', onClick));
      }
      if (this.mode.includes('hover')) {
        const onEnter = () => this.handleTriggerEnter();
        const onLeave = (e: PointerEvent) => this.handleTriggerLeave(e);
        hostEl.addEventListener('pointerenter', onEnter);
        hostEl.addEventListener('pointerleave', onLeave);
        cleanHost.push(() => {
          hostEl.removeEventListener('pointerenter', onEnter);
          hostEl.removeEventListener('pointerleave', onLeave);
        });
      }
      if (this.mode.includes('focus')) {
        const onFocus = () => this.handleFocus();
        const onBlur = () => this.handleBlur();
        hostEl.addEventListener('focus', onFocus);
        hostEl.addEventListener('blur', onBlur);
        cleanHost.push(() => {
          hostEl.removeEventListener('focus', onFocus);
          hostEl.removeEventListener('blur', onBlur);
        });
      }
      const onKey = (e: KeyboardEvent) => this.handleKeyDown(e);
      hostEl.addEventListener('keydown', onKey);
      cleanHost.push(() => hostEl.removeEventListener('keydown', onKey));

      cleanups.push(() => {
        this.removeFallbackTrigger(hostEl);
        for (const c of cleanHost) c();
      });
    }

    if (this.mode.includes('hover')) {
      const onPanelEnter = () => this.cancelOpen();
      const onPanelLeave = (e: PointerEvent) => {
        if (hostEl?.contains(e.relatedTarget as Node)) return;
        this.close();
      };
      el.addEventListener('pointerenter', onPanelEnter);
      el.addEventListener('pointerleave', onPanelLeave);
      cleanups.push(() => {
        el.removeEventListener('pointerenter', onPanelEnter);
        el.removeEventListener('pointerleave', onPanelLeave);
      });
    }

    let wasOpen = this.open;
    const stopEffect = effect(() => {
      const isOpen = this.open;

      if (hostEl && !this.target) {
        this.applyFallbackTrigger(hostEl, isOpen);
        if (isOpen) {
          hostEl.style.setProperty('anchor-name', `--${this.anchorPrefix}-anchor-${this.id}`);
          hostEl.style.setProperty(`--${this.anchorPrefix}-anchor-name`, `--${this.anchorPrefix}-anchor-${this.id}`);
        } else {
          hostEl.style.removeProperty('anchor-name');
          hostEl.style.removeProperty(`--${this.anchorPrefix}-anchor-name`);
        }
      }

      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        this.dispatchVisibilityEvent(el, isOpen);

        if (this.managesFocus) {
          if (isOpen) {
            this.previousFocused = document.activeElement as HTMLElement | null;
            const firstFocusable = el.querySelector<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusable) {
              firstFocusable.focus();
            } else if (el.tabIndex >= 0) {
              el.focus();
            }
          } else {
            const restoreTarget = this.previousFocused ?? hostEl;
            if (restoreTarget && document.contains(restoreTarget)) {
              restoreTarget.focus();
            }
            this.previousFocused = null;
          }
        }
      }
    });
    cleanups.push(stopEffect);

    const handlePointerDown = (e: MouseEvent) => {
      if (!this.open || !this.dismissable) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target) && !hostEl?.contains(target)) {
        this.open = false;
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleGlobalKeyDown);
    el.addEventListener('keydown', handleGlobalKeyDown);

    cleanups.push(() => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      el.removeEventListener('keydown', handleGlobalKeyDown);
    });

    return () => {
      this.cancelOpen();
      if (hostEl && !this.target) {
        hostEl.style.removeProperty('anchor-name');
        hostEl.style.removeProperty(`--${this.anchorPrefix}-anchor-name`);
      }
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }
}
