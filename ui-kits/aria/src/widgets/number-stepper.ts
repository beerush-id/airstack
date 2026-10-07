import { $static } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, RefineFn } from '../types.js';
import { ariaBoolean, ariaRequired } from '../utils/attributes.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for NumberStepperAria.
 */
export interface NumberStepperProps extends AriaProps {
  /**
   * Current numeric value.
   */
  value?: number;

  /**
   * Minimum allowable value, or undefined when unbounded below.
   */
  min?: number;

  /**
   * Maximum allowable value, or undefined when unbounded above.
   */
  max?: number;

  /**
   * Step increment applied per arrow keystroke (defaults to 1).
   */
  step?: number;

  /**
   * Human-readable representation of the current value.
   */
  valuetext?: string;

  /**
   * Readonly indicator.
   */
  readonly?: boolean;

  /**
   * Whether the field is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Required validation indicator.
   */
  required?: boolean;
}

/**
 * Behavioral configuration options for NumberStepperAria.
 */
export interface NumberStepperOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a number-stepper element.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface NumberStepperAttributes<E extends BaseElement = HTMLInputElement> extends AriaAttributes<E> {
  role?: 'spinbutton';
  type?: 'number';
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  tabindex?: number;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-readonly'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless number-stepper controller owning a discrete numeric value within an
 * optional range. On a native `<input type="number">` it synchronizes typed input and
 * leaves stepping to the browser; on a custom host it compiles the spinbutton role
 * announcements and polyfills arrow, page, and boundary stepping itself.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class NumberStepperAria<
  E extends BaseElement = HTMLInputElement,
  T extends NumberStepperProps = NumberStepperProps,
  A extends NumberStepperAttributes<E> = NumberStepperAttributes<E>,
  O extends NumberStepperOptions = NumberStepperOptions,
> extends Aria<E, T, A, O> {
  /**
   * Multiplier turning `step` into the page-sized increment. Fixed at class-definition
   * level so subclasses can rescale it without exposing a JSX prop.
   */
  protected readonly pageStep = 10;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });

    this.omittedAttrs.push(
      'value',
      'defaultValue',
      'min',
      'max',
      'step',
      'readonly',
      'required',
      'aria-valuenow',
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuetext',
      'aria-readonly',
      'aria-required'
    );
    this.update();
  }

  protected override update(reinit = true, refine?: RefineFn<T, A>): void {
    $static(() => {
      const stored = this.properties.value;
      const clamped = clampRange(stored as number, this.min, this.max);
      if (!Object.is(clamped, stored)) this.properties.value = clamped;
    });
    super.update(reinit, refine);
  }

  /**
   * Current numeric value, clamped to the declared bounds and falling back to the
   * minimum when no value has been entered.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min ?? 0, this.min, this.max);
  }

  public set value(next: number) {
    this.properties.value = clampRange(next, this.min, this.max);
  }

  /**
   * Minimum allowable value, or undefined when unbounded below.
   */
  public get min(): number | undefined {
    return this.properties.min;
  }

  /**
   * Maximum allowable value, or undefined when unbounded above.
   */
  public get max(): number | undefined {
    return this.properties.max;
  }

  /**
   * Increment applied per arrow keystroke.
   */
  public get step(): number {
    return this.properties.step ?? 1;
  }

  /**
   * Whether the value is user-immutable while still focusable and announced.
   */
  public get readonly(): boolean {
    return !!this.properties.readonly;
  }

  /**
   * Whether the field is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Whether a value is required for validation.
   */
  public get required(): boolean {
    return !!this.properties.required;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the number-stepper.
   *
   * @returns Number-stepper attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-valuetext': this.properties.valuetext,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        type: 'number',
        defaultValue: this.value,
        min: this.min,
        max: this.max,
        step: this.step,
        readonly: this.readonly,
        disabled: isDisabled,
        required: this.required,
        oninput: this.handleInput,
      }) as A;
    }

    return Object.assign(attrs, {
      role: 'spinbutton',
      tabindex: isDisabled ? -1 : 0,
      'aria-valuenow': this.value,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
      'aria-readonly': this.properties.readonly === undefined ? undefined : ariaBoolean(this.readonly),
      'aria-required': ariaRequired(this.required),
      'aria-disabled': ariaBoolean(isDisabled),
      onkeydown: this.handleKey,
    }) as A;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (this.disabled || this.readonly) return;

    const step = this.step;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.value += step;
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.value -= step;
        break;
      case 'PageUp':
        event.preventDefault();
        this.value += step * this.pageStep;
        break;
      case 'PageDown':
        event.preventDefault();
        this.value -= step * this.pageStep;
        break;
      case 'Home':
        if (this.min === undefined) return;
        event.preventDefault();
        this.value = this.min;
        break;
      case 'End':
        if (this.max === undefined) return;
        event.preventDefault();
        this.value = this.max;
        break;
    }
  };

  private readonly handleInput = (event: Event): void => {
    if (this.disabled) return;

    const raw = (event.currentTarget as HTMLInputElement).value;

    // A cleared number input is an empty string, which Number() would read as zero.
    if (raw.trim() === '') {
      this.properties.value = undefined;
      return;
    }

    const next = Number(raw);
    if (Number.isNaN(next)) return;

    this.value = next;
  };
}
