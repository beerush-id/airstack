import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { type DialogAria, dialogCtx } from './dialog.js';

/**
 * Compiled HTML and ARIA attributes for a Dialog title.
 */
export interface DialogTitleAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}
/**
 * Title element controller providing accessible labeling for a dialog panel.
 */
export class DialogTitleAria<E extends HTMLElement = HTMLElement> extends Aria<E, AriaProps, DialogTitleAttributes<E>> {
  protected dialog?: DialogAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id');
    this.update();
  }

  protected createAttributes(): DialogTitleAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    return {
      id: `${parentId}-title`,
    };
  }
}
