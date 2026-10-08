import { createContext } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { clampRange } from '../utils/range.js';

/**
 * Ambient instance context for the enclosing Stepper coordinator.
 */
export const stepperCtx = createContext<StepperAria>();

/**
 * Controller-dispatched stepper event carrying the committed value in `detail`.
 */
export type StepperEvent = AriaEvent<number>;

/**
 * Reactive input properties for StepperAria.
 */
export interface StepperProps extends AriaProps {
  /**
   * Current numeric value.
   */
  value?: number;

  /**
   * Minimum allowable value.
   */
  min?: number;

  /**
   * Maximum allowable value.
   */
  max?: number;

  /**
   * Step increment applied per button activation or arrow keystroke.
   */
  step?: number;

  /**
   * Large increment applied per page key in value units.
   */
  page?: number;

  /**
   * Whether the stepper is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Read-only flag; blocks edits while keeping focusability.
   */
  readonly?: boolean;

  /**
   * Required validation indicator.
   */
  required?: boolean;

  /**
   * Human-readable string representation of the value.
   */
  valuetext?: string;
}

/**
 * Behavioral configuration options for StepperInputAria.
 */
/**
 * Reactive input properties for the stepper's spinbutton input.
 */
export interface StepperInputProps extends AriaProps {
  /**
   * Called with the committed value after each step or typed commit.
   */
  oninput?: AriaEventHandler<StepperEvent>;

  /**
   * Called with the committed value when the interaction ends.
   */
  onchange?: AriaEventHandler<StepperEvent>;
}

export interface StepperInputOptions extends AriaOptions {}

/**
 * Behavioral configuration options for StepperButtonAria.
 */
export interface StepperButtonOptions extends AriaOptions {
  /**
   * Stepping direction: increment or decrement.
   */
  direction: 1 | -1;
}

/**
 * Compiled HTML and ARIA attributes for the stepper container.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface StepperAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
}

/**
 * Compiled HTML and ARIA attributes for the stepper input element.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface StepperInputAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'spinbutton';
  type?: 'number';
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  readonly?: boolean;
  disabled?: boolean;
  tabindex?: number;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-readonly'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Compiled HTML and ARIA attributes for stepper increment and decrement buttons.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface StepperButtonAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  type?: 'button';
  disabled?: boolean;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless stepper container coordinator owning the shared value, bounds, and
 * stepping increments for its input and step button parts.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 */
export class StepperAria<
  E extends BaseElement = HTMLElement,
  T extends StepperProps = StepperProps,
  A extends StepperAttributes<E> = StepperAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);
    stepperCtx.set(this as unknown as StepperAria);

    this.omittedAttrs.push('value', 'min', 'max', 'step', 'page', 'valuetext', 'readonly', 'required');
    this.update();
  }

  /**
   * Current numeric value with bounds applied.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min ?? 0, this.min, this.max);
  }

  /**
   * Inclusive lower bound.
   */
  public get min(): number | undefined {
    return this.properties.min;
  }

  /**
   * Inclusive upper bound.
   */
  public get max(): number | undefined {
    return this.properties.max;
  }

  /**
   * Step increment applied per button activation or arrow keystroke.
   */
  public get step(): number {
    return this.properties.step ?? 1;
  }

  /**
   * Large increment applied per page key in value units.
   */
  public get page(): number {
    return this.properties.page ?? 10;
  }

  /**
   * Whether the stepper is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Whether the value is user-immutable while still focusable.
   */
  public get readonly(): boolean {
    return !!this.properties.readonly;
  }

  /**
   * Commits a raw value through bounds.
   *
   * @param raw - Uncommitted value reading
   * @returns Whether the commit changed the value
   */
  public commit(raw: number): boolean {
    const next = clampRange(raw, this.min, this.max);
    if (next === this.value) return false;
    this.properties.value = next;
    return true;
  }

  /**
   * Computes the HTML and ARIA attributes for the stepper container.
   *
   * @returns Container attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: 'group' as const,
    }) as A;
  }
}

/**
 * Headless stepper input controller discovering its coordinator from ambient
 * scope, owning spinbutton announcements, full arrow-key stepping, and
 * interaction events.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class StepperInputAria<
  E extends BaseElement = HTMLInputElement,
  T extends StepperInputProps = StepperInputProps,
  A extends StepperInputAttributes<E> = StepperInputAttributes<E>,
  O extends StepperInputOptions = StepperInputOptions,
> extends Aria<E, T, A, O> {
  private readonly stepper: StepperAria | null = stepperCtx.get() ?? null;

  private dirty = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });
    this.omittedAttrs.push('oninput', 'onchange');
    this.update();
  }

  /**
   * Current value read from the coordinator.
   */
  public get value(): number {
    return this.stepper ? this.stepper.value : 0;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the stepper input.
   *
   * @returns Input attributes dictionary
   */
  protected override createAttributes(): A {
    const stepper = this.stepper;
    if (!stepper) {
      return Object.assign(super.createAttributes(), {
        role: 'spinbutton',
        tabindex: 0,
        'aria-disabled': 'false',
      }) as A;
    }

    const isDisabled = stepper.disabled;
    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        type: 'number',
        value: stepper.value,
        min: stepper.min,
        max: stepper.max,
        step: stepper.step,
        readonly: stepper.readonly,
        disabled: isDisabled,
        oninput: this.handleNativeInput,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'spinbutton',
      tabindex: isDisabled ? -1 : 0,
      'aria-valuenow': stepper.value,
      'aria-valuemin': stepper.min,
      'aria-valuemax': stepper.max,
      'aria-valuetext': stepper.properties.valuetext,
      'aria-readonly': stepper.properties.readonly === undefined ? undefined : ariaBoolean(stepper.readonly),
      'aria-disabled': ariaBoolean(isDisabled),
      onkeydown: this.handleKeyDown,
      onkeyup: this.handleKeyUp,
      onblur: this.handleBlur,
    }) as A;
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const stepper = this.stepper;
    if (!stepper || stepper.disabled || stepper.readonly || e.defaultPrevented) return;

    let raw: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') raw = stepper.value + stepper.step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') raw = stepper.value - stepper.step;
    else if (e.key === 'PageUp') raw = stepper.value + stepper.page;
    else if (e.key === 'PageDown') raw = stepper.value - stepper.page;
    else if (e.key === 'Home') {
      if (stepper.min === undefined) return;
      raw = stepper.min;
    } else if (e.key === 'End') {
      if (stepper.max === undefined) return;
      raw = stepper.max;
    }
    if (raw === undefined) return;

    e.preventDefault();
    if (stepper.commit(raw)) {
      this.dirty = true;
      this.notifyInput();
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    if (!HANDLED_KEYS.includes(e.key)) return;
    this.commitChange();
  };

  private readonly handleBlur = (): void => {
    this.commitChange();
  };

  private readonly handleNativeInput = (e: Event): void => {
    const raw = (e.currentTarget as HTMLInputElement).value;
    if (raw.trim() === '') return;
    this.stepper!.commit(Number(raw));
  };

  private commitChange(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const event: StepperEvent = new CustomEvent('change', { bubbles: true, detail: this.stepper!.value });
    this.element!.dispatchEvent(event);
    this.properties.onchange?.(event);
  }

  private notifyInput(): void {
    const event: StepperEvent = new CustomEvent('input', { bubbles: true, detail: this.stepper!.value });
    this.element!.dispatchEvent(event);
    this.properties.oninput?.(event);
  }
}

/**
 * Headless stepper button controller discovering its coordinator from ambient
 * scope, stepping the shared value on activation and disabling itself at the
 * bound it has nowhere left to go.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class StepperButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends AriaProps = AriaProps,
  A extends StepperButtonAttributes<E> = StepperButtonAttributes<E>,
  O extends StepperButtonOptions = StepperButtonOptions,
> extends Aria<E, T, A, O> {
  private readonly stepper: StepperAria | null = stepperCtx.get() ?? null;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.update();
  }

  /**
   * Whether the button is disabled from user interaction: coordinator-less,
   * container-disabled, or already at its bound.
   */
  public get disabled(): boolean {
    const stepper = this.stepper;
    if (!stepper || stepper.disabled) return true;
    const value = stepper.value;
    return this.direction === 1
      ? stepper.max !== undefined && value >= stepper.max
      : stepper.min !== undefined && value <= stepper.min;
  }

  /**
   * Stepping direction carried by the role options.
   */
  private get direction(): 1 | -1 {
    return this.options.direction;
  }

  /**
   * Activates the step button programmatically.
   */
  public click(): void {
    this.handleClick();
  }

  /**
   * Computes the HTML and event handler attributes for the step button.
   *
   * @returns Button attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    return Object.assign(super.createAttributes(), {
      type: 'button',
      disabled: isDisabled,
      'aria-disabled': ariaBoolean(isDisabled),
      onclick: this.handleClick,
    }) as A;
  }

  private readonly handleClick = (): void => {
    const stepper = this.stepper;
    if (!stepper || stepper.disabled) return;
    stepper.commit(stepper.value + this.direction * stepper.step);
  };
}

const HANDLED_KEYS = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
