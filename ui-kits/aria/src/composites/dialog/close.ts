import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { type DialogAria, dialogCtx } from './dialog.js';

/**
 * Compiled HTML and ARIA attributes for a Dialog close trigger.
 */
export interface DialogCloseAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  type?: string;
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: boolean | 'true' | 'false';
}
/**
 * Close button controller committing dialog open = false.
 */
export class DialogCloseAria<E extends HTMLElement = HTMLElement> extends Aria<E, AriaProps, DialogCloseAttributes<E>> {
  protected dialog?: DialogAria;

  public get open() {
    return !!this.dialog?.open;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id', 'role', 'type', 'disabled', 'tabindex', 'aria-disabled');
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected createAttributes(): DialogCloseAttributes<E> {
    const attrs: DialogCloseAttributes<E> = {
      onclick: (e: MouseEvent) => this.handleClick(e),
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

  protected handleClick(e: MouseEvent): void {
    if (this.disabled || e.defaultPrevented) return;
    this.dialog?.close();
  }
}
