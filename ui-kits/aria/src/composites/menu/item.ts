import { Aria } from '../../core.js';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../../selection.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Primitive } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';

/**
 * Reactive input properties for MenuItemAria.
 */
export interface MenuItemProps extends AriaProps {
  /**
   * Optional semantic identifier or action name.
   */
  name?: string;

  /**
   * Whether the item is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for menu item widgets.
 */
export interface MenuItemOptions extends AriaOptions {
  /**
   * Whether bound to a native <button> (default: true).
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a menu item element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface MenuItemAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  role?: 'menuitem';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA MenuItem controller invoking a command action.
 * Activation behavior belongs to the consumer; the controller owns
 * role semantics, disabled lockout, and non-native keyboard polyfills.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class MenuItemAria<
  E extends BaseElement = HTMLButtonElement,
  T extends MenuItemProps = MenuItemProps,
  A extends MenuItemAttributes<E> = MenuItemAttributes<E>,
  O extends MenuItemOptions = MenuItemOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.update();
  }

  /**
   * Whether the item is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the menu item.
   *
   * @returns Menu item attributes dictionary
   */
  protected override createAttributes(): A {
    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        role: 'menuitem',
        type: 'button',
        disabled: this.disabled,
      }) as A;
    }

    const isDisabled = this.disabled;

    return Object.assign(super.createAttributes(), {
      role: 'menuitem',
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

/**
 * Reactive input properties for MenuItemCheckboxAria.
 */
export interface MenuItemCheckboxProps extends MenuItemProps {
  /**
   * Whether the item is checked ('mixed' for tri-state).
   */
  checked?: boolean | 'mixed';
}

/**
 * Compiled HTML and ARIA attributes for a checkable menu item.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface MenuItemCheckboxAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role?: 'menuitemcheckbox';
  type?: 'button';
  'aria-checked'?: 'true' | 'false' | 'mixed';
}

/**
 * Headless WAI-ARIA MenuItemCheckbox controller managing a standalone
 * toggle state. Keeps `checked` on its own props and never binds to
 * a group value.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class MenuItemCheckboxAria<
  E extends BaseElement = HTMLButtonElement,
  T extends MenuItemCheckboxProps = MenuItemCheckboxProps,
  A extends MenuItemCheckboxAttributes<E> = MenuItemCheckboxAttributes<E>,
  O extends MenuItemOptions = MenuItemOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'menuitemcheckbox',
      key: 'checked',
      valueKey: 'value',
    });

    this.update();
  }

  /**
   * Whether the item is currently checked.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Toggles the item, resolving a tri-state condition
   * into a definitive checked state.
   */
  public override toggle(): void {
    if (this.disabled) return;

    if (this.properties.checked === 'mixed') {
      this.select();
      return;
    }

    super.toggle();
  }

  /**
   * Computes HTML and ARIA attributes for the checkable menu item.
   *
   * @returns Menu item checkbox attributes dictionary
   */
  protected override createAttributes(): A {
    const state = this.properties.checked === 'mixed' ? 'mixed' : ariaBoolean(this.checked);
    const attrs = Object.assign(super.createAttributes(), {
      role: 'menuitemcheckbox',
      'aria-checked': state,
    });

    if (this.isNative) {
      attrs.type = 'button';
    }

    return attrs as A;
  }
}

/**
 * Reactive input properties for MenuItemRadioAria.
 *
 * @template T - Candidate value type
 */
export interface MenuItemRadioProps<T extends Primitive = Primitive> extends MenuItemProps {
  /**
   * Choice candidate value matching enclosing subgroup value.
   */
  value: T;
}

/**
 * Compiled HTML and ARIA attributes for a radio menu item.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface MenuItemRadioAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role?: 'menuitemradio';
  type?: 'button';
  'aria-checked'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA MenuItemRadio controller managing mutually exclusive
 * selection inside a `multiple: false` subgroup. Active when the subgroup
 * value equals the item value; activation assigns it. Always idempotent
 * and never deselects.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class MenuItemRadioAria<
  E extends BaseElement = HTMLButtonElement,
  T extends MenuItemRadioProps = MenuItemRadioProps,
  A extends MenuItemRadioAttributes<E> = MenuItemRadioAttributes<E>,
  O extends MenuItemOptions = MenuItemOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'menuitemradio',
      idempotent: true,
      key: 'checked',
      valueKey: 'value',
    });

    this.update();
  }

  /**
   * Whether the item is currently checked.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Computes HTML and ARIA attributes for the radio menu item.
   *
   * @returns Menu item radio attributes dictionary
   */
  protected override createAttributes(): A {
    const isChecked = this.checked;
    const attrs = Object.assign(super.createAttributes(), {
      role: 'menuitemradio',
      'aria-checked': ariaBoolean(isChecked),
    });

    if (this.isNative) {
      attrs.type = 'button';
    } else {
      attrs.tabindex = this.disabled ? -1 : this.group ? (isChecked ? 0 : -1) : 0;
    }

    return attrs as A;
  }
}
