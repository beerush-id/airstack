import type { AriaOptions, AriaProps } from '../../types.js';
import { DialogCloseAria, type DialogCloseAttributes } from '../dialog/close.js';
import { type ConfirmAria, type ConfirmEvent, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm action button.
 */
export interface ConfirmActionAttributes<E extends HTMLElement = HTMLElement> extends DialogCloseAttributes<E> {}
/**
 * Action button controller for confirming and executing the action.
 * Emits a bubbling 'confirm' event upon activation before closing.
 */
export class ConfirmActionAria<E extends HTMLElement = HTMLElement> extends DialogCloseAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.confirm = confirmCtx.get();
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    const evt: ConfirmEvent = new CustomEvent('confirm', { bubbles: true, cancelable: true });
    this.element?.dispatchEvent(evt);
    this.confirm?.properties.onconfirm?.(evt);
    if (!evt.defaultPrevented) {
      this.confirm?.close();
    }
  }
}
