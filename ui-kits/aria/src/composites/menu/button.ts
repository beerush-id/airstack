import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { menuCtx, ROLE_MENU } from './container.js';
import type { MenuItemOptions } from './item.js';

/**
 * Reactive input properties for MenuButtonAria.
 */
export interface MenuButtonProps extends AriaProps {
  /**
   * Whether the trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a menu trigger button.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface MenuButtonAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  role?: 'button';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
  'aria-haspopup': 'menu';
  'aria-expanded': 'true' | 'false';
  'aria-controls'?: string;
}

/**
 * Headless menu trigger button toggling the paired popup panel.
 * Activation flips root open state; panel visibility belongs to the consumer.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class MenuButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends MenuButtonProps = MenuButtonProps,
  A extends MenuButtonAttributes<E> = MenuButtonAttributes<E>,
  O extends MenuItemOptions = MenuItemOptions,
> extends Aria<E, T, A, O> {
  private root = menuCtx.get();

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.omittedAttrs.push('aria-haspopup', 'aria-expanded', 'aria-controls');
    this.update();
  }

  /**
   * Whether the paired popup panel is open.
   */
  public get open(): boolean {
    return !!this.root?.open;
  }

  public set open(value: boolean) {
    if (this.root) this.root.open = value;
  }

  /**
   * Whether the trigger is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the menu trigger.
   *
   * @returns Menu trigger attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const isOpen = this.open;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-haspopup': 'menu',
      'aria-expanded': ariaBoolean(isOpen),
      'aria-controls': this.root ? `${this.root.properties.id}-${ROLE_MENU}` : undefined,
      onclick: () => {
        if (isDisabled) return;
        if (this.root) this.root.open = !this.root.open;
      },
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        type: 'button',
        disabled: isDisabled,
      }) as A;
    }

    return Object.assign(attrs, {
      role: 'button',
      tabindex: isDisabled ? -1 : 0,
      'aria-disabled': ariaBoolean(isDisabled),
      onkeydown: (e: KeyboardEvent) => {
        if (isDisabled) return;

        if (e.key === ' ') {
          e.preventDefault();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLElement)?.click?.();
        }
      },
      onkeyup: (e: KeyboardEvent) => {
        if (isDisabled) return;

        if (e.key === ' ') {
          (e.currentTarget as HTMLElement)?.click?.();
        }
      },
    }) as A;
  }
}
