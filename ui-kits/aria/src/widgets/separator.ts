import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Orientation } from '../types.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for SeparatorAria.
 */
export interface SeparatorProps extends AriaProps {
  /**
   * Whether the separator is an interactive movable splitter.
   */
  movable?: boolean;

  /**
   * Current partition position when movable.
   */
  value?: number;

  /**
   * Divider axis (defaults to 'horizontal').
   */
  orientation?: Orientation;

  /**
   * Minimum partition position when movable (defaults to 0).
   */
  min?: number;

  /**
   * Maximum partition position when movable (defaults to 100).
   */
  max?: number;
}

/**
 * Behavioral configuration options for SeparatorAria.
 */
export interface SeparatorOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a separator element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SeparatorAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'separator';
  tabindex?: number;
  'aria-orientation'?: Orientation;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
}

/**
 * Headless WAI-ARIA separator controller compiling either a static structural
 * divider or an interactive movable splitter. Static separators stay unfocusable
 * and value-less; only `movable` promotes the divider into a range widget owning
 * a tab stop and arrow-key position adjustment.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class SeparatorAria<
  E extends BaseElement = HTMLElement,
  T extends SeparatorProps = SeparatorProps,
  A extends SeparatorAttributes<E> = SeparatorAttributes<E>,
  O extends SeparatorOptions = SeparatorOptions,
> extends Aria<E, T, A, O> {
  /**
   * Position delta applied per arrow keystroke. Fixed at class-definition level so
   * subclasses can re-scale it to their partition unit without exposing a JSX prop.
   */
  protected readonly step = 1;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.omittedAttrs.push('aria-orientation', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax');
    this.update();
  }

  /**
   * Whether the separator is an interactive movable splitter.
   */
  public get movable(): boolean {
    return !!this.props.movable;
  }

  /**
   * Current partition position, clamped to the inclusive range.
   */
  public get value(): number {
    return clampRange(this.props.value ?? this.min, this.min, this.max);
  }

  public set value(next: number) {
    this.props.value = clampRange(next, this.min, this.max);
  }

  /**
   * Visual and keyboard navigation axis of the divider.
   */
  public get orientation(): Orientation {
    return this.props.orientation ?? 'horizontal';
  }

  /**
   * Minimum partition position.
   */
  public get min(): number {
    return this.props.min ?? 0;
  }

  /**
   * Maximum partition position.
   */
  public get max(): number {
    return this.props.max ?? 100;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the separator.
   *
   * @returns Separator attributes dictionary
   */
  protected override createAttributes(): A {
    const attrs = Object.assign(super.createAttributes(), {
      'aria-orientation': this.orientation === 'vertical' ? 'vertical' : undefined,
    });

    if (!this.movable) {
      // A native <hr> carries the separator role implicitly; custom elements must declare it.
      if (!this.isNative) attrs.role = 'separator';
      return attrs as A;
    }

    return Object.assign(attrs, {
      role: 'separator',
      tabindex: 0,
      'aria-valuenow': this.value,
      'aria-valuemin': this.min,
      'aria-valuemax': this.max,
      onkeydown: this.handleKey,
    }) as A;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    // Right and Down always advance the partition regardless of divider axis.
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) return;

    event.preventDefault();
    this.value += forward ? this.step : -this.step;
  };
}
