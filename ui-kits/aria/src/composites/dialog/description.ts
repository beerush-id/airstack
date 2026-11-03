import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { type DialogAria, dialogCtx } from './dialog.js';

/**
 * Compiled HTML and ARIA attributes for a Dialog description.
 */
export interface DialogDescriptionAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}
/**
 * Description element controller providing accessible advisory text for a dialog panel.
 */
export class DialogDescriptionAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DialogDescriptionAttributes<E>
> {
  protected dialog?: DialogAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id');
    this.update();
  }

  protected createAttributes(): DialogDescriptionAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    return {
      id: `${parentId}-description`,
    };
  }
}
