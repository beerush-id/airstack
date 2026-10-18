import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import {
  PopupTriggerAria,
  type PopupTriggerAttributes,
  type PopupTriggerOptions,
} from '../popup/trigger.js';
import type { SelectAria, SelectProps } from './select.js';

export interface SelectTriggerProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Whether this trigger is disabled from user interaction.
   */
  disabled?: boolean;
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
  SelectProps,
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
    this.omittedAttrs.push('value', 'text');
    this.update();
  }
}

