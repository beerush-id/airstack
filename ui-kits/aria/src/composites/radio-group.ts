import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import { selectionGroup } from '../selection.js';
import type { AriaAttributes, AriaInvalid, AriaProps, BaseElement, Orientation, Primitive } from '../types.js';
import { ariaBoolean, ariaInvalid, ariaRequired } from '../utils/attributes.js';
import { handleRovingKey } from '../utils/navigation.js';
import { RadioAria, type RadioAttributes, type RadioOptions, type RadioProps } from '../widgets/radio.js';

export { RadioAria, type RadioAttributes, type RadioOptions, type RadioProps };

/**
 * Ambient instance context for the enclosing RadioGroup orchestrator.
 */
export const radioGroupCtx = createContext<RadioGroupAria>();

const ROLE_RADIOGROUP = 'radiogroup';
const RADIO_SELECTORS = [
  '[role="radio"]:not([aria-disabled="true"]):not([disabled])',
  'input[type="radio"]:not(:disabled)',
].join(', ');

/**
 * Reactive input properties for RadioGroupAria.
 *
 * @template T - Member value token type
 */
export interface RadioGroupProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * HTML form field name forwarded to native radio inputs.
   */
  name?: string;

  /**
   * Currently selected radio value within the group.
   */
  value?: T;

  /**
   * Whether user interaction is disabled across the entire group.
   */
  disabled?: boolean;

  /**
   * Visual and keyboard navigation orientation of the radio options.
   * @default 'vertical'
   */
  orientation?: Orientation;

  /**
   * When false, arrows move focus and select immediately.
   * @default false
   */
  manual?: boolean;

  /**
   * Enforces a selection constraint requiring a non-empty value.
   */
  required?: boolean;

  /**
   * Invalid indicator compiled to aria-invalid.
   */
  invalid?: AriaInvalid;
}

/**
 * Compiled HTML and ARIA attributes for a radio group container.
 *
 * @template E - Target Element type
 */
export interface RadioGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'radiogroup';
  'aria-orientation'?: Orientation;
  'aria-required'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-invalid'?: 'true' | 'false' | 'grammar' | 'spelling';
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
  private parentRover = roverCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.props.id = this.props.id ?? `${ROLE_RADIOGROUP}-${uIndex($symbol(ROLE_RADIOGROUP), true)}`;
    });
    radioGroupCtx.set(this as unknown as RadioGroupAria);
    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.props as Record<string, unknown>);
    this.omittedAttrs.push('aria-orientation', 'aria-required', 'aria-invalid');

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
  public get orientation(): Orientation {
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
      role: ROLE_RADIOGROUP,
      'aria-orientation': orientation,
      'aria-required': ariaRequired(this.props.required),
      'aria-disabled': ariaBoolean(disabled),
      'aria-invalid': ariaInvalid(this.props.invalid),
      onkeydown: (e: KeyboardEvent) => {
        if (disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: RADIO_SELECTORS,
          orientation,
          manual: this.props.manual ?? false,
        });
      },
    }) as A;
  }
}
