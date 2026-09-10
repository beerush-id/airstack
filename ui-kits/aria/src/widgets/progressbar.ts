import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Reactive input properties for ProgressbarAria.
 */
export interface ProgressbarProps extends AriaProps {
  /**
   * Current progress value; null or undefined renders the bar indeterminate.
   */
  value?: number | null;

  /**
   * Lower bound of the progress range (defaults to 0).
   */
  min?: number;

  /**
   * Upper bound of the progress range (defaults to 100).
   */
  max?: number;

  /**
   * Human-readable representation of the current progress.
   */
  valuetext?: string;
}

/**
 * Behavioral configuration options for ProgressbarAria.
 */
export interface ProgressbarOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a progressbar element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface ProgressbarAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'progressbar';
  value?: number;
  max?: number;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
}

/**
 * Headless WAI-ARIA progressbar controller compiling determinate and indeterminate
 * progress semantics. Non-interactive by contract: it takes no focus, owns no
 * keyboard behavior, and never mutates its own value.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ProgressbarAria<
  E extends BaseElement = HTMLElement,
  T extends ProgressbarProps = ProgressbarProps,
  A extends ProgressbarAttributes<E> = ProgressbarAttributes<E>,
  O extends ProgressbarOptions = ProgressbarOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
    });

    this.omittedAttrs.push('value', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext');
    this.update();
  }

  /**
   * Current progress value, or null when progress is indeterminate.
   */
  public get value(): number | null {
    return this.props.value ?? null;
  }

  public set value(next: number | null) {
    this.props.value = next;
  }

  /**
   * Whether progress is unmeasurable, which omits the current-value projection.
   */
  public get indeterminate(): boolean {
    return this.value === null;
  }

  /**
   * Lower bound of the progress range.
   */
  public get min(): number {
    return this.props.min ?? 0;
  }

  /**
   * Upper bound of the progress range.
   */
  public get max(): number {
    return this.props.max ?? 100;
  }

  /**
   * Computes the HTML and ARIA attributes for the progressbar.
   *
   * @returns Progressbar attributes dictionary
   */
  protected override createAttributes(): A {
    const value = this.indeterminate ? undefined : (this.value as number);
    const attrs = Object.assign(super.createAttributes(), {
      'aria-valuetext': this.props.valuetext,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        value,
        max: this.max,
      }) as A;
    }

    return Object.assign(attrs, {
      role: 'progressbar',
      'aria-valuenow': value,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
    }) as A;
  }
}
