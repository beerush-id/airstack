import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps } from '../../types.js';
import { type DialogAria, dialogCtx } from './dialog.js';

/**
 * Compiled HTML and ARIA attributes for a Dialog trigger.
 */
export interface DialogTriggerAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  type?: string;
  disabled?: boolean;
  tabindex?: number;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean | 'true' | 'false';
  'aria-controls'?: string;
  'aria-disabled'?: boolean | 'true' | 'false';
}
/**
 * Interactive trigger button for opening and toggling a dialog.
 */
export class DialogTriggerAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DialogTriggerAttributes<E>
> {
  protected dialog?: DialogAria;

  public get open() {
    return !!this.dialog?.open;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, { ...options, clickable: true });
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push(
      'id',
      'role',
      'type',
      'open',
      'disabled',
      'tabindex',
      'aria-haspopup',
      'aria-expanded',
      'aria-controls',
      'aria-disabled'
    );
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected createAttributes(): DialogTriggerAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    const isOpen = this.dialog?.open ?? false;

    const attrs: DialogTriggerAttributes<E> = {
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': `${parentId}-panel`,
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
    this.dialog?.toggle();
  }
}
