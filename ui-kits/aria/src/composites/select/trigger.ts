import { isEmpty } from '@airlib/core';
import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { PopupTriggerAria, type PopupTriggerAttributes, type PopupTriggerOptions } from '../popup/trigger.js';
import type { SelectAria } from './select.js';

export interface SelectTriggerProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Whether this trigger is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Optional placeholder text when no value is selected.
   */
  placeholder?: string;
}

export interface SelectTriggerOptions extends PopupTriggerOptions {}

/**
 * Compiled HTML and ARIA attributes for a Select combobox trigger.
 *
 * @template E - Target Element type
 */
export interface SelectTriggerAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {}

/**
 * Combobox trigger opening the select listbox. Compiles attributes only;
 * click and arrow-key activation come from the composed popover modes.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SelectTriggerAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  SelectTriggerProps,
  SelectTriggerAttributes<E>,
  SelectTriggerOptions
> {
  /**
   * Enclosing select orchestrator discovered from ambient context.
   */
  public declare host?: SelectAria;

  /**
   * Get the currently selected value(s).
   */
  public get value(): string | string[] | undefined {
    return this.host?.value;
  }

  /**
   * Get the currently selected text(s).
   */
  public get text(): string {
    return this.host?.text ?? '';
  }

  /**
   * Get the label of the current choice(s).
   */
  public get label() {
    return this.host?.label ?? '';
  }

  /**
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   */
  public constructor(props: Partial<SelectTriggerProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.omittedAttrs.push('value', 'text', 'placeholder');
    this.update();
  }

  protected override createAttributes(): SelectTriggerAttributes<E> {
    return Object.assign(super.createAttributes(), {
      'data-placeholder': this.properties.placeholder,
      'data-placeholder-visible': isEmpty(this.host?.label),
    });
  }
}
