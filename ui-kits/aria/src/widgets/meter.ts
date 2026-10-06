import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for MeterAria.
 */
export interface MeterProps extends AriaProps {
  /**
   * Numeric measurement value, clamped to the declared interval.
   */
  value?: number;

  /**
   * Lower bound in original units.
   */
  min?: number;

  /**
   * Upper bound in original units.
   */
  max?: number;

  /**
   * Accessible name.
   */
  label: string;

  /**
   * Human-readable value label.
   */
  valuetext?: string;
}

/**
 * Behavioral configuration options for MeterAria.
 */
export interface MeterOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a meter element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface MeterAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  value?: number;
  min?: number;
  max?: number;
  role?: 'meter';
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-label'?: string;
}

/**
 * Headless bounded-gauge controller reporting a scalar measurement within a
 * known range. Non-interactive by contract: it takes no focus, owns no
 * keyboard behavior, and never mutates its own reading.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class MeterAria<
  E extends BaseElement = HTMLElement,
  T extends MeterProps = MeterProps,
  A extends MeterAttributes<E> = MeterAttributes<E>,
  O extends MeterOptions = MeterOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });
    this.omittedAttrs.push(
      'value',
      'min',
      'max',
      'label',
      'aria-valuenow',
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuetext',
      'aria-label'
    );
    this.update();
  }

  /**
   * Current measurement, clamped to the declared interval.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min, this.min, this.max);
  }

  public set value(next: number) {
    this.properties.value = clampRange(next, this.min, this.max);
  }

  /**
   * Lower bound in original units.
   */
  public get min(): number {
    return this.properties.min ?? 0;
  }

  /**
   * Upper bound in original units.
   */
  public get max(): number {
    return this.properties.max ?? 100;
  }

  /**
   * Reading as a percentage along the declared interval, matching the numeric
   * content of the published offset variable.
   */
  public get offset(): number {
    const span = this.max - this.min;
    if (span <= 0) return 0;
    return Number((((this.value - this.min) / span) * 100).toFixed(4));
  }

  /**
   * Computes the HTML and ARIA attributes for the meter.
   *
   * @returns Meter attributes dictionary
   */
  protected override createAttributes(): A {
    const reading = this.value;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-valuetext': this.properties.valuetext,
      'aria-label': this.properties.label,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        value: reading,
        min: this.min,
        max: this.max,
      }) as A;
    }

    const span = this.max - this.min;
    const ratio = span <= 0 ? 0 : (reading - this.min) / span;

    return Object.assign(attrs, {
      role: 'meter',
      'aria-valuenow': reading,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
      style: { '--aria-meter-offset': `${Number((ratio * 100).toFixed(4))}%` },
    }) as A;
  }
}
