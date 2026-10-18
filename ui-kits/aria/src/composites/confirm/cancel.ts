import type { AriaOptions, AriaProps, DetachFn } from '../../types.js';
import { DialogCloseAria, type DialogCloseAttributes } from '../dialog/close.js';
import { type CancelEvent, type ConfirmAria, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm cancel button.
 */
export interface ConfirmCancelAttributes<E extends HTMLElement = HTMLElement> extends DialogCloseAttributes<E> {}
/**
 * Safe cancel button controller for dismissing the confirmation dialog.
 * Emits a bubbling 'cancel' event upon activation, lands initial autofocus, and closes.
 */
export class ConfirmCancelAria<E extends HTMLElement = HTMLElement> extends DialogCloseAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.confirm = confirmCtx.get();
  }

  protected override attach(): DetachFn {
    const el = this.element!;
    el.setAttribute('autofocus', '');
    return () => {
      el.removeAttribute('autofocus');
    };
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    const evt: CancelEvent = new CustomEvent('cancel', { bubbles: true, cancelable: true });
    this.element?.dispatchEvent(evt);
    this.confirm?.properties.oncancel?.(evt);
    if (!evt.defaultPrevented) {
      this.confirm?.close();
    }
  }
}
