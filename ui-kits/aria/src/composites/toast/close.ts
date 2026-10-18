import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { toastCtx } from './toast.js';

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
