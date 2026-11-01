import type { AnyType } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { openDragSession } from '../../utils/pointer.js';
import { type StepperAria, stepperCtx } from './stepper.js';

/** How far a pointer travels, in pixels, before a press counts as a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Reactive input properties for StepperAdjusterAria.
 */
export interface StepperAdjusterProps extends AriaProps {
  /**
   * How many of the stepper's steps a pixel of a drag moves (defaults to 1).
   */
  rate?: number;
}

/**
 * Headless handle that adjusts its stepper's value by dragging: right steps up, left steps down, at
 * its `rate` once it's a drag. It's an extra way to reach the number, so the input stays what's
 * focused and read: the handle is hidden from assistive technology.
 *
 * @template E - Target Element type (defaults to HTMLSpanElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class StepperAdjusterAria<
  E extends BaseElement = HTMLSpanElement,
  T extends StepperAdjusterProps = StepperAdjusterProps,
  A extends AriaAttributes<E> = AriaAttributes<E>,
  O extends AriaOptions = AriaOptions,
> extends Aria<E, T, A, O> {
  private readonly stepper: StepperAria | null = stepperCtx.get() ?? null;

  /**
   * @param props - Reactive properties
   * @param options - Controller options
   */
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.omittedAttrs.push('rate');
    this.on('pointerdown', this.handleDown as AnyType);
    this.update();
  }

  /**
   * Computes the HTML attributes for the handle.
   *
   * @returns Handle attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), { 'aria-hidden': 'true' }) as A;
  }

  /**
   * Starts a drag from the value the stepper holds, each move stepping from where it crossed the
   * threshold, so the value neither jumps nor drifts from the pointer. A cancelled drag puts it back.
   *
   * @param e - Pointer event
   */
  private readonly handleDown = (e: PointerEvent): void => {
    const stepper = this.stepper;
    if (!stepper || stepper.disabled || stepper.readonly || e.button !== 0) return;
    e.preventDefault();

    const { clientX } = e;
    let crossedAt: number | undefined;
    const from = stepper.value;
    // To the step's own decimals: adding a step of 0.05 can land on 1.1500000000000001.
    const digits = String(stepper.step).split('.')[1]?.length ?? 0;

    openDragSession({
      onMove: (move) => {
        if (crossedAt === undefined) {
          const travelled = move.clientX - clientX;
          if (Math.abs(travelled) < DRAG_THRESHOLD) return;
          // The threshold itself, not this move: a fast one lands well past it.
          crossedAt = clientX + Math.sign(travelled) * DRAG_THRESHOLD;
        }
        const steps = Math.round(move.clientX - crossedAt) * (this.properties.rate ?? 1);
        stepper.commit(Number((from + steps * stepper.step).toFixed(digits)), 'input');
      },
      onUp: () => {},
      onCancel: () => {
        stepper.commit(from, 'input');
      },
    });
  };
}
