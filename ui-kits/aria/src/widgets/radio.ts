import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement, Primitive } from '../types.js';

/**
 * Reactive input properties for RadioAria.
 *
 * @template T - Candidate value type
 */
export interface RadioProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Called with the committed state when the selection changes.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;
  /**
   * Choice candidate value matching parent group value.
   */
  value?: T;

  /**
   * Native HTML form field name pass-through.
   */
  name?: string;

  /**
   * Whether the radio option is currently checked.
   */
  checked?: boolean;

  /**
   * Whether the radio button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Configuration options for RadioAria.
 */
export interface RadioOptions extends AriaOptions {
  /**
   * Whether bound to native <input type="radio">.
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a radio element.
 *
 * @template E - Target Element type
 */
export interface RadioAttributes<E extends BaseElement = HTMLInputElement | HTMLButtonElement>
  extends SelectionAttributes<E> {
  role?: 'radio';
  type?: 'radio';
  checked?: boolean;
  'aria-checked'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA Radio controller managing mutually exclusive selection states,
 * native radio input synchronization, and group coordination.
 *
 * @template E - Target Element type (defaults to HTMLInputElement | HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class RadioAria<
  E extends BaseElement = HTMLInputElement | HTMLButtonElement,
  T extends RadioProps = RadioProps,
  A extends RadioAttributes<E> = RadioAttributes<E>,
  O extends RadioOptions = RadioOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'radio',
      idempotent: true,
      key: 'checked',
      allowKeys: [' '],
      clickable: true,
    });

    this.omittedAttrs.push('value', 'name', 'onchange', 'aria-checked');
    this.update();
  }

  /**
   * Whether the radio button is currently checked.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Computes HTML and ARIA attributes for the radio element.
   *
   * @returns Radio attributes dictionary
   */
  protected override createAttributes(): A {
    const isChecked = this.checked;

    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        type: 'radio',
        checked: isChecked,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'radio',
      tabindex: this.disabled ? -1 : this.group ? (isChecked ? 0 : -1) : 0,
      'aria-checked': isChecked ? 'true' : 'false',
    }) as A;
  }
}
