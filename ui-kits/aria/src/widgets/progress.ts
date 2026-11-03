import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for ProgressAria.
 */
export interface ProgressProps extends AriaProps {
  /**
   * Completion number, or null when indeterminate.
   */
  value?: number | null;

  /**
   * Lower bound of the progress range.
   */
  min?: number;

  /**
   * Upper bound of the progress range.
   */
  max?: number;

  /**
   * Accessible name.
   */
  label?: string;

  /**
   * Human-readable representation of the current progress.
   */
  valuetext?: string;
}

/**
 * Behavioral configuration options for ProgressAria.
 */
export interface ProgressOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a progress element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface ProgressAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  value?: number;
  max?: number;
  role?: 'progressbar';
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-label'?: string;
}

/**
 * Headless progress controller normalizing determinate and indeterminate
 * task-completion reporting across native and custom hosts.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ProgressAria<
  E extends BaseElement = HTMLElement,
  T extends ProgressProps = ProgressProps,
  A extends ProgressAttributes<E> = ProgressAttributes<E>,
  O extends ProgressOptions = ProgressOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });
    this.omittedAttrs.push(
      'value',
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
   * Clamped completion number, or null when progress is indeterminate.
   */
  public get value(): number | null {
    const raw = this.properties.value ?? null;
    if (raw === null) return null;
    return clampRange(raw, this.min, this.max);
  }

  public set value(next: number | null) {
    this.properties.value = next;
  }

  /**
   * Whether progress is unmeasurable, which omits the current-value projection.
   */
  public get indeterminate(): boolean {
    return this.value === null;
  }

  /**
   * Completion as a percentage along the declared interval, matching the
   * numeric content of the published offset variable, or null while
   * indeterminate.
   */
  public get offset(): number | null {
    const clamped = this.value;
    if (clamped === null) return null;
    const span = this.max - this.min;
    if (span <= 0) return 0;
    return Number((((clamped - this.min) / span) * 100).toFixed(4));
  }

  /**
   * Lower bound of the progress range.
   */
  public get min(): number {
    return this.properties.min ?? 0;
  }

  /**
   * Upper bound of the progress range.
   */
  public get max(): number {
    return this.properties.max ?? 100;
  }

  /**
   * Computes the HTML and ARIA attributes for the progress indicator.
   *
   * @returns Progress attributes dictionary
   */
  protected override createAttributes(): A {
    const clamped = this.value;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-valuetext': this.properties.valuetext,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        value: clamped === null ? undefined : clamped - this.min,
        max: this.max - this.min,
      }) as A;
    }

    const span = this.max - this.min;
    const ratio = clamped === null ? null : span <= 0 ? 0 : (clamped - this.min) / span;

    return Object.assign(attrs, {
      role: 'progressbar',
      'aria-valuenow': clamped === null ? undefined : clamped,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
      'aria-label': this.properties.label,
      style: ratio === null ? undefined : { '--aria-progress-offset': `${Number((ratio * 100).toFixed(4))}%` },
    }) as A;
  }
}
