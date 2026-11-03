import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { type StepperAria, stepperCtx } from './stepper.js';

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
