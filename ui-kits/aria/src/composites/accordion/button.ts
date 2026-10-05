import {
  SelectionAria,
  type SelectionAttributes,
  type SelectionOptions,
  type SelectionProps,
} from '../../selection.js';
import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { ROLE_ACCORDION, ROLE_REGION } from './accordion.js';

/**
 * Reactive input properties for an AccordionButton trigger header.
 */
export interface AccordionButtonProps extends AriaProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity key matching paired AccordionPanel.
   */
  name?: string;

  /**
   * Whether the accordion section is initially expanded when parent is uncontrolled.
   */
  expanded?: boolean;

  /**
   * Whether the accordion trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Controller configuration options for AccordionButton.
 */
export interface AccordionButtonOptions extends AriaOptions {
  /**
   * Whether bound to a native button element.
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Accordion trigger button.
 *
 * @template E - Target Element type
 */
export interface AccordionButtonAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  id: string;
  type?: 'button';
  role?: 'button';
  'aria-expanded': 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-controls': string;
  tabindex?: number;
}

/**
 * Interactive accordion trigger button that toggles paired panel visibility.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class AccordionButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends AccordionButtonProps = AccordionButtonProps,
  A extends AccordionButtonAttributes<E> = AccordionButtonAttributes<E>,
  O extends AccordionButtonOptions = AccordionButtonOptions,
> extends SelectionAria<E, SelectionProps, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props as SelectionProps, {
      native: true,
      ...options,
      role: 'button',
      valueKey: 'name',
    });
    this.omittedAttrs.push('aria-expanded', 'aria-controls');
    this.update();
  }

  /**
   * Whether the accordion section is currently expanded.
   */
  public get expanded(): boolean {
    return this.selected;
  }

  public set expanded(value: boolean) {
    this.selected = value;
  }

  /**
   * Compiles HTML and ARIA attributes for the accordion trigger button.
   *
   * @returns AccordionButton attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const value = this.value;
    const isExpanded = this.expanded;

    return Object.assign(super.createAttributes(), {
      id: this.properties.id ?? `${scope}${ROLE_ACCORDION}-${value}`,
      type: this.isNative ? 'button' : undefined,
      role: this.isNative ? undefined : 'button',
      'aria-expanded': ariaBoolean(isExpanded),
      'aria-disabled': ariaBoolean(this.disabled),
      'aria-controls': `${scope}${ROLE_REGION}-${value}`,
      tabindex: this.isNative ? undefined : this.disabled ? -1 : 0,
    }) as A;
  }
}
