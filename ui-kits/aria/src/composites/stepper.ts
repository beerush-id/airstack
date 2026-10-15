import { type AnyType, createContext, effect } from '@airlib/core';
import type { KeyboardEvent } from 'react';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
} from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { focusSelect, maintainCursor, readFloat } from '../utils/input.js';
import { clampRange } from '../utils/range.js';

/**
 * Ambient instance context for the enclosing Stepper coordinator.
 */
export const stepperCtx = createContext<StepperAria>();

/**
 * Controller-dispatched stepper event carrying the committed value in `detail`.
 */
export type StepperInputEvent = AriaEvent<string | number | undefined | null>;
export type StepperChangeEvent = AriaEvent<number | undefined>;

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
  oninput?: AriaEventHandler<StepperInputEvent>;

  /**
   * Called with the committed value when the interaction ends.
   */
  onchange?: AriaEventHandler<StepperChangeEvent>;
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
  min?: number;
  max?: number;
  type?: 'number';
  role?: 'spinbutton';
  step?: number;
  value?: number;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  tabindex?: number;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-readonly'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
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
   * @param props - Reactive properties
   */
  public constructor(props: Partial<T> = {}) {
    super(props);

    this.omittedAttrs.push('value', 'min', 'max', 'step', 'page', 'valuetext', 'readonly', 'required');

    this.on('keydown', this.handleStepping as AnyType);

    effect.client((e) => {
      void this.value;
      if (e.type === 'init') return;
      this.notify('change');
    });

    stepperCtx.set(this as unknown as StepperAria);
    this.update();
  }

  /**
   * Commit a value to the stepper by clamping it to bounds and notifying listeners if the value changed.
   *
   * @param raw - Uncommitted value reading
   * @param notify - Whether to notify listeners of the commit
   * @returns Whether the commit changed the value
   */
  public commit(raw: number, notify?: 'input' | 'change'): boolean {
    const next = clampRange(raw, this.min, this.max);
    if (next === this.value) return false;
    this.properties.value = next;
    if (notify) this.notify(notify);
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

  /**
   * Handles keydown events on the stepper element.
   *
   * @param e - Keydown event
   */
  protected handleStepping = (e: KeyboardEvent<HTMLInputElement>) => {
    if (this.disabled || this.readonly || e.defaultPrevented) return;

    let value: number | undefined;
    let shouldPrevent = true;

    if (e.key === 'ArrowUp') {
      value = this.value + this.step;
    } else if (e.key === 'ArrowDown') {
      value = this.value - this.step;
    } else if (e.key === 'PageUp') {
      value = this.value + this.page;
    } else if (e.key === 'PageDown') {
      value = this.value - this.page;
    } else if (e.key === 'Home') {
      if (this.min === undefined) return;
      value = this.min;
    } else if (e.key === 'End') {
      if (this.max === undefined) return;
      value = this.max;
    } else {
      shouldPrevent = false;
    }

    if (shouldPrevent) e.preventDefault();
    if (value != null) {
      this.commit(value);
      this.notify('input');
    }
  };

  /**
   * Notifies listeners of the given event type with the current value.
   *
   * @param type - Event type
   */
  protected notify(type = 'input'): void {
    const event = new CustomEvent(type, { bubbles: true, detail: this.value, cancelable: true });
    this.element?.dispatchEvent(event);
    this.dispatch(event);
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

  /**
   * Current numeric value with bounds applied.
   */
  public get value(): number {
    return (this.stepper?.value ?? 0) as number;
  }

  /**
   * @param props - Reactive properties
   * @param options - Controller options
   */
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
      clickable: true,
    });

    this.omittedAttrs.push('oninput', 'onchange');

    this.on('blur', this.parseChanges as AnyType);
    this.on('input', this.parseInputs as AnyType);
    this.on('keydown', this.bypassKeys as AnyType);

    if (!this.isNative) {
      let fromPointer = false;

      this.on('pointerenter', () => {
        fromPointer = true;
      });

      this.on('focus', () => {
        if (!fromPointer) {
          focusSelect(this.element);
        }

        fromPointer = false;
      });
    }

    this.update();
  }

  /**
   * Applies value changes to the host element.
   *
   * @returns Detach function
   */
  protected override attach(): DetachFn | void {
    if (this.isNative) return;
    return effect(() => {
      maintainCursor(() => (this.element!.textContent = (this.stepper?.value ?? '0').toString()));
    });
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the stepper input.
   *
   * @returns Input attributes dictionary
   */
  protected override createAttributes(): A {
    const attrs = super.createAttributes();
    const stepper = this.stepper;
    const isDisabled = stepper?.disabled || stepper?.readonly;

    if (this.isNative) {
      Object.assign(attrs, {
        type: 'text',
        value: stepper?.value,
        tabindex: isDisabled ? -1 : undefined,
        readonly: stepper?.readonly,
        disabled: isDisabled,
        required: stepper?.properties.required === true,
      });
    } else {
      Object.assign(attrs, {
        tabindex: isDisabled ? -1 : 0,
        contenteditable: !isDisabled ? 'true' : undefined,
        'plaintext-only': 'true',
        'aria-readonly': stepper?.readonly,
        'aria-disabled': ariaBoolean(isDisabled),
        'aria-required': stepper?.properties.required,
      });
    }

    return Object.assign(attrs, {
      role: 'spinbutton',
      'aria-valuenow': stepper?.value,
      'aria-valuemin': stepper?.min,
      'aria-valuemax': stepper?.max,
      'aria-valuetext': stepper?.properties.valuetext,
    }) as A;
  }

  /**
   * Bypass Enter and space to prevent default form submission and invalid number input.
   *
   * @param e - Keydown event
   */
  private readonly bypassKeys = (e: KeyboardEvent<HTMLInputElement>): void => {
    const { disabled, readonly } = this.stepper ?? {};
    if (disabled || readonly || e.defaultPrevented) return;
    if (['Enter', ' '].includes(e.key)) e.preventDefault();
  };

  /**
   * Validates and commits the input value on every keystroke.
   *
   * @param e - Input event
   */
  private readonly parseInputs = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!this.stepper || this.stepper.disabled || this.stepper.readonly) return;

    const raw = this.isNative ? e.currentTarget.value : e.currentTarget.textContent;
    const value = readFloat(raw);

    if (value != null) this.stepper?.commit(value);

    const event = new CustomEvent('input', { bubbles: true, detail: this.stepper!.value });
    this.dispatch(event);
  };

  /**
   * Validate and commit the input value on blur.
   *
   * @param e - Input event
   */
  private readonly parseChanges = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!this.stepper || this.stepper.disabled || this.stepper.readonly) return;

    const raw = this.isNative ? e.currentTarget.value : e.currentTarget.textContent;
    const value = readFloat(raw);

    if (value != null) {
      this.stepper?.commit(value);
    } else {
      const element = this.element as never as HTMLInputElement;

      if (this.isNative) {
        element.value = (this.stepper.value ?? '0').toString();
      } else {
        element.textContent = (this.stepper.value ?? '0').toString();
      }
    }
  };
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
   * @param props - Reactive properties
   * @param options - Controller options
   */
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      clickable: true,
    });

    this.on('click', () => this.handleStepping());
    this.update();
  }

  /**
   * Activates the step button programmatically.
   */
  public click(): void {
    this.handleStepping();
  }

  /**
   * Computes the HTML and event handler attributes for the step button.
   *
   * @returns Button attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled || this.stepper?.disabled || this.stepper?.readonly;

    return Object.assign(super.createAttributes(), {
      type: 'button',
      tabindex: -1,
      disabled: this.isNative ? isDisabled : undefined,
      'aria-disabled': this.isNative ? undefined : ariaBoolean(isDisabled),
    }) as A;
  }

  /**
   * Handles the click event, stepping the stepper in the appropriate direction.
   */
  protected readonly handleStepping = (): void => {
    const stepper = this.stepper;
    if (!stepper || stepper.disabled) return;
    stepper.commit(stepper.value + this.direction * stepper.step, 'input');
  };
}
