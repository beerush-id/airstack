import { type AnyType, effect } from '@airlib/core';
import type { KeyboardEvent } from 'react';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEventHandler, AriaOptions, AriaProps, BaseElement, DetachFn } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { focusSelect, maintainCursor, readFloat } from '../../utils/input.js';
import { type StepperAria, type StepperChangeEvent, stepperCtx, type StepperInputEvent } from './stepper.js';

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
          focusSelect(this.element!);
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

    const event = new CustomEvent('input', { bubbles: true, detail: this.stepper!.value, cancelable: true });
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
        element.value = this.stepper.value.toString();
      } else {
        element.textContent = this.stepper.value.toString();
      }
    }
  };
}
