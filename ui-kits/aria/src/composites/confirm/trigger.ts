import type { AriaOptions, AriaProps } from '../../types.js';
import { DialogTriggerAria, type DialogTriggerAttributes } from '../dialog/trigger.js';
import { type ConfirmAria, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm trigger.
 */
export interface ConfirmTriggerAttributes<E extends HTMLElement = HTMLElement> extends DialogTriggerAttributes<E> {}
/**
 * Interactive trigger button for opening a confirmation alertdialog.
 */
export class ConfirmTriggerAria<E extends HTMLElement = HTMLElement> extends DialogTriggerAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, { ...options, clickable: true });
    this.confirm = confirmCtx.get();
  }

  protected override createAttributes(): ConfirmTriggerAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    const attrs = super.createAttributes() as ConfirmTriggerAttributes<E>;
    attrs['aria-controls'] = `${parentId}-panel`;
    return attrs;
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    super.handleClick(e);
  }
}
