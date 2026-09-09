import {
  SelectionAria,
  type SelectionAttributes,
  type SelectionOptions,
  type SelectionProps,
} from '../../selection.js';
import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { ROLE_TAB, ROLE_TABPANEL } from './tab.js';

/**
 * Reactive input properties for TabButton triggers.
 */
export interface TabButtonProps extends AriaProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity matching paired TabPanel name.
   */
  name: string;

  /**
   * Initial selection hint when parent is uncontrolled.
   */
  selected?: boolean;

  /**
   * Whether this tab button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for TabButton triggers.
 */
export interface TabButtonOptions extends AriaOptions {
  /**
   * Whether bound to a native button element.
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for TabButton triggers.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface TabButtonAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  id: string;
  role: typeof ROLE_TAB;
  type?: 'button';
  'aria-selected': 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-controls': string;
  tabindex?: number;
}

/**
 * Interactive tab header trigger that activates an associated panel.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Options dictionary type
 */
export class TabButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends TabButtonProps = TabButtonProps,
  A extends TabButtonAttributes<E> = TabButtonAttributes<E>,
  O extends TabButtonOptions = TabButtonOptions,
> extends SelectionAria<E, SelectionProps, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props as SelectionProps, {
      native: true,
      ...options,
      role: ROLE_TAB,
      valueKey: 'name',
    });
    this.omittedAttrs.push('aria-controls');
    this.update();
  }

  /**
   * Compiles HTML and ARIA attributes for the tab trigger button.
   *
   * @returns TabButton attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const value = this.value;
    const isSelected = this.selected;

    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? `${scope}${ROLE_TAB}-${value}`,
      role: ROLE_TAB,
      type: this.isNative ? 'button' : undefined,
      'aria-selected': ariaBoolean(isSelected),
      'aria-disabled': ariaBoolean(this.disabled),
      'aria-controls': `${scope}${ROLE_TABPANEL}-${value}`,
      tabindex: this.isNative ? (isSelected ? undefined : -1) : this.disabled ? -1 : isSelected ? 0 : -1,
    }) as A;
  }
}
