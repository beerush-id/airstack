import type { AnyType } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Reactive input properties for an individual Option widget.
 */
export interface OptionProps extends AriaProps {
  /**
   * Explicit DOM identifier.
   */
  id?: string;

  /**
   * Value payload or distinct identity of this option within the group.
   */
  value?: AnyType;

  /**
   * Initial or controlled selection state.
   */
  selected?: boolean;

  /**
   * Whether this individual option is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Controller configuration options for OptionAria.
 */
export interface OptionOptions extends AriaOptions {
  /**
   * Whether clicking an active option can deselect it in single-select mode.
   */
  toggle?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for an option element.
 *
 * @template E - Target Element type
 */
export interface OptionAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'option';
  tabindex?: number;
  'aria-selected'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

const ROLE_OPTION = 'option';

/**
 * Headless WAI-ARIA Option item used in listbox, combobox, and select popups.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class OptionAria<
  E extends BaseElement = HTMLElement,
  T extends OptionProps = OptionProps,
  A extends OptionAttributes<E> = OptionAttributes<E>,
  O extends OptionOptions = OptionOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props, { native: false, ...options, role: ROLE_OPTION, key: 'selected' });
    this.omittedAttrs.push('role', 'aria-selected');
    this.update();
  }

  /**
   * Whether the option is currently selected.
   */
  public override get selected(): boolean {
    return super.selected;
  }

  public override set selected(value: boolean) {
    super.selected = value;
  }

  /**
   * Computes HTML and ARIA attributes for the option.
   */
  protected override createAttributes(): A {
    const attrs = super.createAttributes();
    const isDisabled = this.disabled;
    const isSelected = this.selected;

    return Object.assign(attrs, {
      role: ROLE_OPTION,
      tabindex: isDisabled ? -1 : isSelected ? 0 : -1,
      'aria-selected': isSelected ? 'true' : 'false',
    }) as A;
  }
}
