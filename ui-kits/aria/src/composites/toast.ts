import { $static, createContext, isBrowser } from '@airlib/core';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
} from '../types.js';

/**
 * Ambient instance context for the enclosing Toast coordinator.
 */
export const toastCtx = createContext<ToastAria>();

/**
 * Controller-dispatched toast event for removal notifications.
 */
export type ToastEvent = AriaEvent<void>;

/**
 * Reactive input properties for ToastAria.
 * A toast is always born alive; removal is internal lifecycle state,
 * never an input property.
 */
export interface ToastProps extends AriaProps {
  /**
   * Critical urgency (default: false) — `true` interrupts (`alert`),
   * `false` waits its turn (`status`).
   */
  critical?: boolean;

  /**
   * Visible lifetime in milliseconds. No timer arms unless given;
   * without it the toast lives until dismissed.
   */
  duration?: number;

  /**
   * Handler for toast dismissal events.
   */
  ondismiss?: AriaEventHandler<ToastEvent>;
}

/**
 * Compiled HTML and ARIA attributes for a toast live region.
 *
 * @template E - Target Element type
 */
export interface ToastAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'status' | 'alert';
  'aria-live'?: 'polite' | 'assertive';
  'aria-atomic'?: 'false';
}

/**
 * Compiled HTML and ARIA attributes for a toast close button.
 *
 * @template E - Target Element type
 */
export interface ToastCloseAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  role?: 'button';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Instance-local lifecycle state for ToastAria.
 */
export type ToastState = {
  dismissed: boolean;
  remaining?: number;
  startedAt?: number;
};

/**
 * Headless one-shot toast controller: the toast itself is the live region.
 * It announces once on mount, stays visible for a timed lifetime with
 * pause-on-interaction, then commits a single removal announced as `dismiss`.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class ToastAria<
  E extends BaseElement = HTMLElement,
  T extends ToastProps = ToastProps,
  A extends ToastAttributes<E> = ToastAttributes<E>,
> extends Aria<E, T, A> {
  private state: ToastState;
  private timer?: ReturnType<typeof setTimeout>;

  /**
   * Visible lifetime in milliseconds, or `undefined` when the toast
   * lives until dismissed.
   */
  public get duration(): number | undefined {
    return this.properties.duration;
  }

  /**
   * Time left before expiry, or `undefined` when no timer is armed.
   */
  public get remaining(): number | undefined {
    return this.state.remaining;
  }

  /**
   * Timestamp in milliseconds when the toast was armed, or `undefined`
   * when it has not yet been armed.
   */
  public get startedAt(): number | undefined {
    return this.state.startedAt;
  }

  /**
   * Removal state — reading reports internal lifecycle state, writing `true`
   * commits removal early through the same exactly-once path. Never re-arms.
   */
  public get dismissed(): boolean {
    return this.state.dismissed;
  }

  public constructor(props: Partial<T> = {}) {
    super(props);

    this.state = {
      dismissed: false,
      remaining: $static(() => this.duration),
    };

    this.omittedAttrs.push('critical', 'duration', 'ondismiss');
    toastCtx.set(this as unknown as ToastAria);

    this.on('pointerenter', () => this.pause());
    this.on('pointerleave', () => this.start());
    this.on('focusin', () => this.pause());
    this.on('focusout', (event: FocusEvent) => {
      if (this.element!.contains(event.relatedTarget as Node | null)) return;
      this.start();
    });

    this.update();

    $static(() => this.start());
  }

  /**
   * Commits toast removal exactly once: cancels the timer, flags state,
   * dispatches `dismiss`, and invokes `ondismiss`.
   */
  public dismiss() {
    this.cancel();
    if (this.dismissed) return;

    this.state.dismissed = true;
    const event = new CustomEvent('dismiss', { bubbles: true });

    this.element?.dispatchEvent(event);
    this.properties.ondismiss?.(event as unknown as ToastEvent);
  }

  /**
   * Computes the live region attributes for the toast element.
   */
  protected override createAttributes(): A {
    const critical = !!this.properties.critical;

    return {
      role: critical ? 'alert' : 'status',
      'aria-live': critical ? 'assertive' : 'polite',
      'aria-atomic': 'false',
    } as A;
  }

  /**
   * Keeps a pending visibility timer from outliving the toast.
   */
  protected override attach(): DetachFn | void {
    return () => {
      this.cancel();
    };
  }

  private start(): void {
    if (!isBrowser() || !this.duration || this.dismissed) return;

    this.cancel();
    this.state.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.dismiss();
    }, this.remaining);
  }

  private pause(): void {
    if (!this.timer || !this.duration) return;
    this.state.remaining = Math.max(0, this.remaining! - (Date.now() - this.startedAt!));
    this.cancel();
  }

  private cancel(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/**
 * Close button controller committing toast removal.
 */
export class ToastCloseAria<E extends BaseElement = HTMLButtonElement> extends Aria<
  E,
  AriaProps,
  ToastCloseAttributes<E>
> {
  protected toast = toastCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.omittedAttrs.push('id', 'role', 'type', 'disabled', 'tabindex', 'aria-disabled', 'ondismiss');
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected override createAttributes(): ToastCloseAttributes<E> {
    const attrs: ToastCloseAttributes<E> = {
      onclick: (event: MouseEvent) => this.handleClick(event),
    };

    if (this.isNative) {
      attrs.type = 'button';
      if (this.disabled) {
        attrs.disabled = true;
      }
    } else {
      attrs.role = 'button';
      attrs.tabindex = this.disabled ? -1 : 0;
      if (this.disabled) {
        attrs['aria-disabled'] = 'true';
      }
    }

    return attrs;
  }

  protected handleClick(event: MouseEvent): void {
    if (this.disabled || event.defaultPrevented) return;
    this.toast?.dismiss();
  }
}
