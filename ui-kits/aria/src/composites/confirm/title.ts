import type { AriaOptions, AriaProps } from '../../types.js';
import { DialogTitleAria, type DialogTitleAttributes } from '../dialog/title.js';
import { type ConfirmAria, confirmCtx } from './confirm.js';

/**
 * Compiled HTML and ARIA attributes for a Confirm title.
 */
export interface ConfirmTitleAttributes<E extends HTMLElement = HTMLElement> extends DialogTitleAttributes<E> {}
/**
 * Title element controller providing accessible labeling for a confirmation dialog.
 */
export class ConfirmTitleAria<E extends HTMLElement = HTMLElement> extends DialogTitleAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmTitleAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    return {
      id: `${parentId}-title`,
    };
  }
}
