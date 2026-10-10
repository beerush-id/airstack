import { $static, $symbol, effect, type StyleInput, uIndex } from '@airlib/core';
import { withEvents } from '@airlib/core/browser';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, DetachFn } from '../types.js';

const POPOVER_SYMBOL = $symbol('popover');
const FOCUSABLE_SELECTOR = ['button', '[href]', 'input', 'select', 'textarea', '[tabindex]']
  .map((s) => `${s}:not(:disabled, [aria-disabled='true'])`)
  .join(', ');
const POPOVER_ROVING_KEYS = new Set(['ArrowDown', 'ArrowUp']);

export type PopoverRole = 'dialog' | 'menu' | 'tooltip' | 'listbox';

/**
 * Supported activation trigger modes for anchored overlays.
 */
export type OverlayTriggerMode = 'hover' | 'focus' | 'click' | 'rove' | 'combo';

/**
 * Reactive input properties for PopoverAria and overlay subclasses.
 */
/**
 * Controller-dispatched popover visibility event carrying the open state in `detail`.
 */
export type PopoverEvent = AriaEvent<boolean>;

export interface PopoverProps extends AriaProps {
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
   * Auto-focus flag: focus the first focusable element when the overlay opens.
   * @default true
   */
  autofocus?: boolean;

  /**
   * Horizontal placement token.
   */
  xDir?: 'before' | 'after' | 'left' | 'between' | 'right';

  /**
   * Vertical placement token.
   */
  yDir?: 'top' | 'bottom' | 'above' | 'below' | 'between';

  /**
   * Called with the open state when the popover opens.
   */
  onopen?: AriaEventHandler<PopoverEvent>;
  /**
   * Called with the open state when the popover closes.
   */
  onclose?: AriaEventHandler<PopoverEvent>;
  /**
   * Called with the open state after the popover toggles.
   */
  ontoggle?: AriaEventHandler<PopoverEvent>;
}

/**
 * Controller configuration options for PopoverAria.
 */
export interface PopoverOptions extends AriaOptions {
  /**
   * Semantic popup role reflected in the panel role.
   * @default 'dialog'
   */
  popupRole?: PopoverRole;
}

/**
 * Compiled HTML and ARIA attributes for a Popover overlay.
 */
export interface PopoverAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: PopoverRole;
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
  protected target?: Aria<HTMLElement, AriaProps, AriaAttributes> & { disabled?: boolean };
  protected previousFocused: HTMLElement | null = null;
  protected openTimer?: ReturnType<typeof setTimeout>;
  protected cleanups = new Set<() => void>();
  protected restoring = false;

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

  public get popupRole(): PopoverRole {
    return this.options.popupRole ?? 'dialog';
  }

  protected get anchorPrefix(): string {
    return 'popover';
  }

  protected get instanceSymbol(): symbol {
    return POPOVER_SYMBOL;
  }

  protected get autofocus(): boolean {
    return this.properties.autofocus ?? true;
  }

  public constructor(props: Partial<PopoverProps> = {}, options: PopoverOptions = {}) {
    super(props, options);
    this.id = $static(() => this.properties.id ?? `${this.anchorPrefix}-${uIndex(this.instanceSymbol, true)}`);
    this.target = this.scope?.actionable as unknown as Aria;
    this.omittedAttrs.push('open', 'mode', 'delay', 'dismissable', 'xDir', 'yDir', 'ontoggle', 'autofocus');
    this.dispatchedState = $static(() => this.properties.open ?? false);

    this.attachTrigger();
    this.update();
  }

  public toggle(): void {
    if (this.target?.disabled) return;
    this.open = !this.open;
  }

  public show(): void {
    this.cancelOpen();
    if (this.target?.disabled) return;
    this.open = true;
  }

  public close(): void {
    this.cancelOpen();
    if (this.target?.disabled) return;
    this.open = false;
  }

  public scheduleOpen(): void {
    this.cancelOpen();
    if (this.target?.disabled) return;

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

    if (this.open && this.autofocus) {
      const restoreTarget = this.target?.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        this.refocus(restoreTarget);
      }
    }

    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.cleanups.clear();
    super.destroy();
  }

  protected override createAttributes(): PopoverAttributes<E> {
    const attrs: PopoverAttributes<E> = {
      id: this.id,
      role: this.popupRole,
      hidden: !this.open,
    };

    if (this.isNative) {
      attrs.popover = this.dismissable ? 'auto' : 'manual';
    }

    if (this.open) {
      attrs.style = {
        positionAnchor: `--${this.anchorPrefix}-anchor-${this.id}`,
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
    this.ensureTrigger(hostEl);

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

    const stopEffect = effect.client(() => {
      this.handleTransition();
    });
    cleanups.push(stopEffect);

    const handleOutsideClick = (e: MouseEvent) => {
      if (!this.open || !this.dismissable) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target) && !hostEl?.contains(target)) {
        this.open = false;
      }
    };

    const handleDismissKey = (e: KeyboardEvent) => {
      this.handleDismissKey(e);
    };

    const unListen = withEvents((listen) => {
      listen(document, 'pointerdown', handleOutsideClick);
      listen(window, 'keydown', handleDismissKey);
      listen(el, 'keydown', handleDismissKey);
    });
    cleanups.push(unListen);

    return () => {
      this.cancelOpen();

      if (hostEl && !this.target) {
        hostEl.style.removeProperty('anchor-name');
      }

      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  protected handleTransition() {
    if (!this.element) return;

    const el = this.element!;
    const isOpen = this.open;
    const hostEl = this.target?.current ?? el.parentElement;

    if (this.autofocus && this.dispatchedState !== isOpen) {
      if (isOpen) {
        this.previousFocused = document.activeElement as HTMLElement | null;

        if (!this.mode.includes('combo')) {
          this.focusPopupContent();
        }
      } else {
        this.restoreOverlayFocus(el, hostEl);
      }
    }

    this.dispatchVisibilityEvent(el, isOpen);
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
    if (this.mode.includes('rove') && POPOVER_ROVING_KEYS.has(e.key) && !this.open) {
      e.preventDefault();
      this.show();
      return;
    }

    if (this.mode.includes('combo') && POPOVER_ROVING_KEYS.has(e.key)) {
      e.preventDefault();

      if (this.open) {
        this.focusPopupContent();
      } else {
        this.show();
      }

      return;
    }

    this.handleDismissKey(e);
  }

  protected handleDismissKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      if (this.autofocus) {
        const restoreTarget = this.previousFocused ?? this.target?.current;
        if (restoreTarget && document.contains(restoreTarget)) {
          this.refocus(restoreTarget);
        }
      }
    }
  }

  private focusPopupContent(): void {
    const el = this.element!;
    const entries = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    let toFocus: HTMLElement | undefined;

    for (const candidate of Array.from(entries)) {
      if (candidate.getAttribute('aria-selected') === 'true') {
        toFocus = candidate;
        break;
      }
    }

    toFocus ??= entries[0];

    if (toFocus) {
      toFocus.focus();
    } else if (el.tabIndex >= 0) {
      el.focus();
    }
  }

  protected restoreOverlayFocus(panel: HTMLElement, hostEl?: HTMLElement | null): void {
    if (this.mode.includes('combo') && !panel.contains(document.activeElement)) {
      this.previousFocused = null;
      return;
    }

    const restoreTarget = this.previousFocused ?? hostEl;
    if (restoreTarget && document.contains(restoreTarget)) {
      this.refocus(restoreTarget);
    }
    this.previousFocused = null;
  }

  protected refocus(target: HTMLElement): void {
    this.restoring = true;
    target.focus();
    this.restoring = false;
  }

  protected createTriggerAttributes(): Record<string, unknown> {
    return {
      'aria-haspopup': 'dialog',
      'aria-expanded': this.open ? 'true' : 'false',
      'aria-controls': this.id,
    };
  }

  protected dispatchedState = false;
  protected dispatchVisibilityEvent(el: HTMLElement, isOpen: boolean): void {
    if (this.dispatchedState === isOpen) return;
    this.dispatchedState = isOpen;

    if (isOpen) {
      const openEvent = new CustomEvent('open', { bubbles: true, detail: isOpen });
      el.dispatchEvent(openEvent);
      this.properties.onopen?.(openEvent);
    } else {
      const closeEvent = new CustomEvent('close', { bubbles: true, detail: isOpen });
      el.dispatchEvent(closeEvent);
      this.properties.onclose?.(closeEvent);
    }

    const event: PopoverEvent = new CustomEvent('toggle', { bubbles: false, detail: isOpen });
    el.dispatchEvent(event);
    this.properties.ontoggle?.(event);
  }

  protected ensureTrigger(element?: HTMLElement | null) {
    if (this.target || !element) return;

    this.target = new Aria();
    this.target.current = element;
    this.attachTrigger();
  }

  protected attachTrigger() {
    if (!this.target) return () => {};

    const unRefine = this.target.refine(() => {
      const attrs: AriaAttributes = {
        ...this.createTriggerAttributes(),
        style: this.open
          ? ({
              anchorName: `--${this.anchorPrefix}-anchor-${this.id}`,
            } as StyleInput)
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
      if (this.mode.includes('combo')) {
        attrs.onclick = () => {
          if (!this.restoring) this.show();
        };
        attrs.onfocus = () => {
          if (!this.restoring) this.show();
        };
      }
      attrs.onkeydown = (e: KeyboardEvent) => this.handleKeyDown(e);

      return attrs;
    });

    this.cleanups.add(unRefine);

    return () => {
      this.cleanups.delete(unRefine);
    };
  }
}
