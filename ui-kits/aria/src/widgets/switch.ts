import { SelectionAria, type SelectionAttributes } from '../selection.js';
import type { AriaProps, BaseElement } from '../types.js';

/**
 * Reactive inputs for SwitchAria.
 */
export interface SwitchProps extends AriaProps {
  /**
   * Whether the switch is currently toggled on.
   */
  checked?: boolean;

  /**
   * Whether the switch is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Semantic identity key or field name on the parent settings group.
   */
  name?: string;
}

/**
 * Compiled HTML and ARIA attributes for a switch element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface SwitchAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role?: 'switch';
  'aria-checked'?: 'true' | 'false';
}

/**
 * Universal WAI-ARIA switch controller managing binary on/off states and keyboard toggles.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 */
export class SwitchAria<
  E extends BaseElement = HTMLButtonElement,
  T extends SwitchProps = SwitchProps,
  A extends SwitchAttributes<E> = SwitchAttributes<E>,
> extends SelectionAria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props, {
      key: 'checked',
      toggle: true,
    });

    this.omittedAttrs.push('role', 'aria-checked');
    this.update();
  }

  /**
   * Whether the switch is currently toggled on.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the switch.
   *
   * @returns Switch attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: 'switch',
      'aria-checked': this.checked ? 'true' : 'false',
    }) as A;
  }
}
