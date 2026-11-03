import type { AriaOptions, AriaProps } from '../../types.js';
import { DialogDescriptionAria, type DialogDescriptionAttributes } from '../dialog/description.js';
import { type ConfirmAria, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm description.
 */
export interface ConfirmDescriptionAttributes<E extends HTMLElement = HTMLElement>
  extends DialogDescriptionAttributes<E> {}
/**
 * Description element controller providing accessible description for a confirmation dialog.
 */
export class ConfirmDescriptionAria<E extends HTMLElement = HTMLElement> extends DialogDescriptionAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmDescriptionAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    return {
      id: `${parentId}-description`,
    };
  }
}
