import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaProps, BaseElement, DetachFn } from '../types.js';
import {
  CheckboxAria,
  type CheckboxAttributes,
  type CheckboxOptions,
  type CheckboxProps,
} from '../widgets/checkbox.js';

export { CheckboxAria, type CheckboxAttributes, type CheckboxOptions, type CheckboxProps };

/**
 * Ambient instance context for enclosing CheckboxGroup coordinators.
 */
export const checkboxGroupCtx = createContext<CheckboxGroupAria>();

/**
 * Reactive input properties for CheckboxGroupAria.
 */
export interface CheckboxGroupProps extends AriaProps {
  /**
   * Array of selected member values.
   */
  value?: string[];

  /**
   * Whether the entire checkbox group is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Accessible text label applied to the grouping element.
   */
  label?: string;

  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;
}

/**
 * Compiled HTML and ARIA attributes for CheckboxGroup container elements.
 *
 * @template E - Target Element type
 */
export interface CheckboxGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-label'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA CheckboxGroup container coordinator managing multi-selection
 * state across independent checkbox items without roving focus.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class CheckboxGroupAria<
  E extends BaseElement = HTMLElement,
  T extends CheckboxGroupProps = CheckboxGroupProps,
  A extends CheckboxGroupAttributes<E> = CheckboxGroupAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);

    $static(() => {
      this.properties.id = this.properties.id ?? `checkbox-group-${uIndex($symbol('checkbox-group'), true)}`;
      if (!this.properties.value) {
        this.properties.value = [];
      }
      (this.properties as Record<string, unknown>).multiple = true;
    });

    checkboxGroupCtx.set(this as unknown as CheckboxGroupAria);
    selectionGroup.set(this.properties as Record<string, unknown>);
    this.omittedAttrs.push('value', 'onchange');
    this.update();
  }

  /**
   * Array of selected value tokens currently held in the group.
   */
  public get value(): string[] {
    return this.properties.value ?? [];
  }

  public set value(val: string[]) {
    this.properties.value = val;
  }

  /**
   * Whether user interaction is disabled across the entire group.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Spawns a CheckboxAria option controller bound to this checkbox group.
   *
   * @param props - Reactive checkbox properties
   * @param options - Controller configuration options
   * @returns Configured CheckboxAria instance
   */
  public checkbox<TE extends BaseElement = HTMLButtonElement | HTMLInputElement>(
    props?: Partial<CheckboxProps>,
    options?: Partial<CheckboxOptions>
  ): CheckboxAria<TE> {
    return new CheckboxAria<TE>(props, options);
  }

  /**
   * Computes HTML and ARIA attributes for the checkbox group container.
   */
  protected override createAttributes(): A {
    const isFieldset = this.element?.tagName === 'FIELDSET';
    const attrs: Record<string, unknown> = {};

    if (!isFieldset) {
      attrs.role = 'group';
    }

    if (this.properties.label) {
      attrs['aria-label'] = this.properties.label;
    }

    if (this.disabled) {
      attrs['aria-disabled'] = 'true';
    }

    return attrs as A;
  }

  protected override attach(): DetachFn | void {
    if (this.element?.tagName === 'FIELDSET') {
      this.element.removeAttribute('role');
    }
  }
}
