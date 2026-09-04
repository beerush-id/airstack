import type { AnyType } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Reactive inputs for ButtonAria.
 */
export interface ButtonProps extends AriaProps {
  /**
   * HTML button behavior type (defaults to 'button' to avoid accidental form submission).
   */
  type?: 'button' | 'submit' | 'reset';

  /**
   * Whether the button is in a pressed/active toggle state.
   */
  pressed?: boolean;

  /**
   * Whether the button is disabled from user interaction.
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
 * Behavioral configuration options for ButtonAria.
 */
export interface ButtonOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a button element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface ButtonAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role?: 'button';
  type?: 'button' | 'submit' | 'reset';
  'aria-pressed'?: 'true' | 'false';
}

/**
 * Universal WAI-ARIA button controller supporting action triggers, toggle states,
 * group selection sync, and native button equivalence for custom non-native elements.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends ButtonProps = ButtonProps,
  A extends ButtonAttributes<E> = ButtonAttributes<E>,
  O extends ButtonOptions = ButtonOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'button',
      key: 'pressed',
    });

    this.omittedAttrs.push('role', 'aria-pressed');
    this.update();
  }

  /**
   * The button's functional behavior type.
   */
  public get type(): 'button' | 'submit' | 'reset' {
    if (this.group) return 'button';
    return this.props.type ?? 'button';
  }

  /**
   * Whether the button is in a pressed/active toggle state.
   */
  public get pressed(): boolean {
    return this.selected;
  }

  public set pressed(value: boolean) {
    this.selected = value;
  }

  /**
   * Activates the button, executing appropriate transitions across form submission,
   * group coordination, and toggle modes.
   */
  public override select(): void {
    if (this.disabled) return;

    if (this.type === 'submit') {
      if (!this.isNative) {
        (this.element?.closest('form') as HTMLFormElement | null)?.requestSubmit();
      }
      return;
    }

    if (this.type === 'reset') {
      if (!this.isNative) {
        (this.element?.closest('form') as HTMLFormElement | null)?.reset();
      }
      return;
    }

    if (this.group || this.isToggle) {
      super.select();
    }
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the button.
   *
   * @returns Button attributes dictionary
   */
  protected override createAttributes(): A {
    const isNative = this.isNative;

    const attrs = Object.assign(super.createAttributes(), {
      type: this.type,
    });

    if (!isNative) {
      attrs.role = 'button';
    }

    if (this.group || this.isToggle) {
      attrs['aria-pressed'] = this.selected ? 'true' : 'false';
    }

    return attrs as A;
  }
}
