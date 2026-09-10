import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean, ariaRequired } from '../utils/attributes.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for SpinbuttonAria.
 */
export interface SpinbuttonProps extends AriaProps {
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
 * Behavioral configuration options for SpinbuttonAria.
 */
export interface SpinbuttonOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a spinbutton element.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface SpinbuttonAttributes<E extends BaseElement = HTMLInputElement> extends AriaAttributes<E> {
  role?: 'spinbutton';
  type?: 'number';
  value?: number;
  defaultValue?: number;
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
 * Headless WAI-ARIA spinbutton controller owning a discrete numeric value within an
 * optional range. On a native `<input type="number">` it synchronizes typed input and
 * leaves stepping to the browser; on a custom host it compiles the range announcements
 * and polyfills arrow, page, and boundary stepping itself.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class SpinbuttonAria<
  E extends BaseElement = HTMLInputElement,
  T extends SpinbuttonProps = SpinbuttonProps,
  A extends SpinbuttonAttributes<E> = SpinbuttonAttributes<E>,
  O extends SpinbuttonOptions = SpinbuttonOptions,
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

  public override get attributes(): Record<string, unknown> {
    // Only a native input has a browser-owned live value to hand over as defaultValue.
    if (!this.isNative) return super.attributes;

    const { value, ...rest } = super.attributes as Record<string, unknown>;
    return { ...rest, defaultValue: value };
  }

  /**
   * Current numeric value, clamped to the declared bounds and falling back to the
   * minimum when no value has been entered.
   */
  public get value(): number {
    return clampRange(this.props.value ?? this.min ?? 0, this.min, this.max);
  }

  public set value(next: number) {
    this.props.value = clampRange(next, this.min, this.max);
  }

  /**
   * Minimum allowable value, or undefined when unbounded below.
   */
  public get min(): number | undefined {
    return this.props.min;
  }

  /**
   * Maximum allowable value, or undefined when unbounded above.
   */
  public get max(): number | undefined {
    return this.props.max;
  }

  /**
   * Increment applied per arrow keystroke.
   */
  public get step(): number {
    return this.props.step ?? 1;
  }

  /**
   * Whether the value is user-immutable while still focusable and announced.
   */
  public get readonly(): boolean {
    return !!this.props.readonly;
  }

  /**
   * Whether the field is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Whether a value is required for validation.
   */
  public get required(): boolean {
    return !!this.props.required;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the spinbutton.
   *
   * @returns Spinbutton attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-valuetext': this.props.valuetext,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        type: 'number',
        value: this.value,
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
      'aria-readonly': this.readonly ? 'true' : undefined,
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
      this.props.value = undefined;
      return;
    }

    const next = Number(raw);
    if (Number.isNaN(next)) return;

    this.value = next;
  };
}
