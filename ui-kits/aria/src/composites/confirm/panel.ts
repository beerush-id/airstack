import type { AriaOptions, AriaProps } from '../../types.js';
import { DialogPanelAria, type DialogPanelAttributes } from '../dialog/panel.js';
import { type ConfirmAria, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm panel.
 */
export interface ConfirmPanelAttributes<E extends HTMLElement = HTMLElement> extends DialogPanelAttributes<E> {}

/**
 * Confirm overlay panel controller carrying role="alertdialog", modal locking, and accessibility linkages.
 */
export class ConfirmPanelAria<E extends HTMLElement = HTMLElement> extends DialogPanelAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    if (props && 'native' in props && options.native === undefined) {
      options.native = props.native as boolean;
    }
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmPanelAttributes<E> {
    const confirm = this.confirm;
    const parentId = confirm?.id ?? 'confirm';

    const attrs = super.createAttributes() as ConfirmPanelAttributes<E>;
    attrs.id = `${parentId}-panel`;
    attrs.role = 'alertdialog';
    attrs['aria-modal'] = 'true';
    attrs['aria-labelledby'] = `${parentId}-title`;
    attrs['aria-describedby'] = `${parentId}-description`;

    if (!this.isNative) {
      attrs.hidden = !this.open;
    }

    return attrs;
  }
}
