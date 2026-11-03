import { type AnyType, createContext, effect } from '@airlib/core';
import type { KeyboardEvent } from 'react';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement } from '../../types.js';
import { readFloat } from '../../utils/input.js';
import { clampRange } from '../../utils/range.js';

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
 * Compiled HTML and ARIA attributes for the stepper container.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface StepperAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
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
   * Retrieves the current numeric value with bounds applied.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min ?? 0, this.min, this.max);
  }

  /**
   * Sets the current numeric value with bounds applied.
   * @param step - Incremental step value
   * @returns The clamped value
   */
  public set value(step: string | number | undefined) {
    const value = readFloat(step) ?? 0;
    this.commit(value);
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
    // The field is what a tooltip inside it describes: hovering or focusing anywhere in it shows one.
    this.markActionable();
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
  protected notify(type: string): void {
    const event = new CustomEvent(type, { bubbles: true, detail: this.value, cancelable: true });
    this.element?.dispatchEvent(event);
    this.dispatch(event);
  }
}
