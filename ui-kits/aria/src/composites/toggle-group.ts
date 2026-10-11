import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, Primitive } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { handleRovingKey } from '../utils/navigation.js';
import { ToggleAria, type ToggleAttributes, type ToggleOptions, type ToggleProps } from '../widgets/toggle.js';

export { ToggleAria, type ToggleAttributes, type ToggleOptions, type ToggleProps };

/**
 * Ambient instance context for the enclosing ToggleGroup orchestrator.
 */
export const toggleGroupCtx = createContext<ToggleGroupAria>();

const ROLE_TOGGLEGROUP = 'togglegroup';
const TOGGLE_SELECTORS = [
  '[role="button"]:not([aria-disabled="true"]):not([disabled])',
  'button:not([disabled]):not([aria-disabled="true"])',
].join(', ');

/**
 * Reactive input properties for single-select ToggleGroupAria.
 *
 * @template T - Member item identifier type
 */
export interface SingleToggleGroupProps<T extends Primitive = Primitive> extends AriaProps {
  multiple?: false;

  /**
   * Optional DOM element identifier and group namespace.
   */
  id?: string;

  /**
   * Active item identifier.
   */
  value?: T;

  /**
   * Called with the member change event that reaches the container.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;

  /**
   * Whether user interaction is disabled across all toggles in the group.
   */
  disabled?: boolean;
}

/**
 * Reactive input properties for multi-select ToggleGroupAria.
 *
 * @template T - Member item identifier type
 */
export interface MultipleToggleGroupProps<T extends Primitive = Primitive> extends AriaProps {
  multiple: true;

  /**
   * Optional DOM element identifier and group namespace.
   */
  id?: string;

  /**
   * Array of active item identifiers.
   */
  value?: T[];

  /**
   * Called with the member change event that reaches the container.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;

  /**
   * Whether user interaction is disabled across all toggles in the group.
   */
  disabled?: boolean;
}

/**
 * Reactive input properties for ToggleGroupAria (single or multiple selection).
 */
export type ToggleGroupProps<T extends Primitive = Primitive> = SingleToggleGroupProps<T> | MultipleToggleGroupProps<T>;

/**
 * Compiled HTML and ARIA attributes for a toggle group container.
 *
 * @template E - Target Element type
 */
export interface ToggleGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA ToggleGroup coordinator managing single or multi-select toggle state,
 * roving tabindex keyboard navigation, and ambient selectionGroup context.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class ToggleGroupAria<
  E extends BaseElement = HTMLElement,
  T extends ToggleGroupProps = ToggleGroupProps,
  A extends ToggleGroupAttributes<E> = ToggleGroupAttributes<E>,
> extends Aria<E, T, A> {
  private parentRover = roverCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_TOGGLEGROUP}-${uIndex($symbol(ROLE_TOGGLEGROUP), true)}`;
    });

    toggleGroupCtx.set(this as unknown as ToggleGroupAria);
    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.properties as Record<string, unknown>);
    this.omittedAttrs.push('id', 'value', 'multiple', 'onchange', 'aria-disabled');

    this.update();
  }

  /**
   * Spawns a ToggleAria controller bound to this toggle group.
   *
   * @param props - Reactive toggle properties
   * @param options - Controller configuration options
   * @returns Configured ToggleAria instance
   */
  public toggle<TE extends BaseElement = HTMLButtonElement>(
    props?: Partial<ToggleProps>,
    options?: Partial<ToggleOptions>
  ): ToggleAria<TE> {
    return new ToggleAria<TE>(props, options as ToggleOptions);
  }

  /**
   * Whether user interaction is disabled across the entire group.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes HTML and ARIA attributes for the toggle group container.
   */
  protected override createAttributes(): A {
    const disabled = this.disabled;

    return Object.assign(super.createAttributes(), {
      id: this.properties.id,
      role: 'group',
      'aria-disabled': ariaBoolean(disabled),
      onkeydown: (e: KeyboardEvent) => {
        if (disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: TOGGLE_SELECTORS,
          bothAxes: true,
          manual: true,
        });
      },
    }) as A;
  }
}
