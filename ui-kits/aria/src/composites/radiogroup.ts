import { $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';
import { RadioAria, type RadioAttributes, type RadioOptions, type RadioProps } from '../widgets/radio.js';

export { RadioAria, type RadioAttributes, type RadioOptions, type RadioProps };

/**
 * Ambient instance context for the enclosing RadioGroup orchestrator.
 */
export const radioGroupCtx = createContext<RadioGroupAria>();

const RADIO_SELECTORS = [
  '[role="radio"]:not([aria-disabled="true"]):not([disabled])',
  'input[type="radio"]:not(:disabled)',
].join(', ');

/**
 * Reactive input properties for RadioGroupAria.
 */
export interface RadioGroupProps extends AriaProps {
  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Currently selected radio value within the group.
   */
  value?: string;

  /**
   * Whether user interaction is disabled across the entire group.
   */
  disabled?: boolean;

  /**
   * Visual and keyboard navigation orientation of the radio options.
   */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Compiled HTML and ARIA attributes for a radio group container.
 *
 * @template E - Target Element type
 */
export interface RadioGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'radiogroup';
  'aria-orientation'?: 'horizontal' | 'vertical';
  'aria-disabled'?: boolean;
}

/**
 * Headless WAI-ARIA RadioGroup coordinator managing mutual exclusivity,
 * roving tabindex, and ambient selectionGroup context.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class RadioGroupAria<
  E extends BaseElement = HTMLElement,
  T extends RadioGroupProps = RadioGroupProps,
  A extends RadioGroupAttributes<E> = RadioGroupAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);
    this.props.id = this.props.id ?? `radiogroup-${uIndex($symbol('radiogroup'), true)}`;
    radioGroupCtx.set(this as unknown as RadioGroupAria);
    selectionGroup.set(this.props as Record<string, unknown>);

    this.omittedAttrs.push('role', 'aria-orientation', 'aria-disabled');
    this.update();
  }

  /**
   * Spawns a RadioAria option controller bound to this radio group.
   *
   * @param props - Reactive radio properties
   * @param options - Controller configuration options
   * @returns Configured RadioAria instance
   */
  public radio<TE extends BaseElement = HTMLInputElement | HTMLButtonElement>(
    props?: Partial<RadioProps>,
    options?: Partial<RadioOptions>
  ): RadioAria<TE> {
    return new RadioAria<TE>(props, options);
  }

  /**
   * Whether user interaction is disabled across the entire group.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Layout orientation of the radio group.
   */
  public get orientation(): NonNullable<RadioGroupProps['orientation']> {
    return this.props.orientation ?? 'vertical';
  }

  /**
   * Computes HTML and ARIA attributes for the radiogroup container.
   */
  protected override createAttributes(): A {
    const disabled = this.disabled;
    const orientation = this.orientation;

    return Object.assign(super.createAttributes(), {
      id: this.props.id,
      role: 'radiogroup',
      'aria-orientation': orientation,
      'aria-disabled': disabled,
      onkeydown: (e: KeyboardEvent) => {
        if (disabled) return;

        handleRovingKey(this.element, e, {
          selector: RADIO_SELECTORS,
          orientation,
        });
      },
    }) as A;
  }
}
