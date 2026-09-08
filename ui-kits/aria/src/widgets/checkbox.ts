import type { AnyType } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Reactive input properties for CheckboxAria.
 */
export interface CheckboxProps extends AriaProps {
  /**
   * Whether the checkbox is in a checked state.
   */
  checked?: boolean;

  /**
   * Whether the checkbox is in a tri-state indeterminate/mixed condition.
   */
  indeterminate?: boolean;

  /**
   * Whether the checkbox is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Semantic identity key or field name on the parent group or form.
   */
  name?: string;

  /**
   * Value payload for collection membership or form submission.
   */
  value?: AnyType;
}

/**
 * Configuration options for CheckboxAria.
 */
export interface CheckboxOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for Checkbox elements.
 *
 * @template E - Target Element type
 */
export interface CheckboxAttributes<E extends BaseElement = HTMLButtonElement | HTMLInputElement>
  extends SelectionAttributes<E> {
  role?: 'checkbox';
  type?: 'checkbox';
  checked?: boolean;
  indeterminate?: boolean;
  'aria-checked'?: 'true' | 'false' | 'mixed';
}

/**
 * Headless WAI-ARIA Checkbox controller managing two-state and tri-state indeterminate selections,
 * keyboard accessibility polyfills, group coordination, and native HTML input synchronization.
 *
 * @template E - Target Element type (HTMLInputElement, HTMLButtonElement, or generic BaseElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class CheckboxAria<
  E extends BaseElement = HTMLButtonElement | HTMLInputElement,
  T extends CheckboxProps = CheckboxProps,
  A extends CheckboxAttributes<E> = CheckboxAttributes<E>,
  O extends CheckboxOptions = CheckboxOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'checkbox',
      key: 'checked',
      valueKey: 'value',
      allowKeys: [' '],
    });

    this.omittedAttrs.push('role', 'type', 'checked', 'aria-checked');
    this.update();
  }

  /**
   * Whether the checkbox is currently checked.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the checkbox.
   *
   * @returns Checkbox attributes dictionary
   */
  protected override createAttributes(): A {
    const isChecked = this.checked;
    const isIndeterminate = this.props.indeterminate === true;

    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        type: 'checkbox',
        checked: isChecked,
        indeterminate: isIndeterminate,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'checkbox',
      'aria-checked': isIndeterminate ? 'mixed' : isChecked ? 'true' : 'false',
    }) as A;
  }
}
