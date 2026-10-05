import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Orientation } from '../types.js';
import { clampRange } from '../utils/range.js';

/**
 * Reactive input properties for DividerAria.
 */
export interface DividerProps extends AriaProps {
  /**
   * Divider axis (defaults to 'horizontal').
   */
  orientation?: Orientation;
}

/**
 * Behavioral configuration options for DividerAria.
 */
export interface DividerOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a divider element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface DividerAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'separator';
  'aria-orientation'?: Orientation;
}

/**
 * Reactive input properties for SplitterAria.
 */
export interface SplitterProps extends DividerProps {
  /**
   * Current partition position.
   */
  value?: number;

  /**
   * Minimum partition position (defaults to 0).
   */
  min?: number;

  /**
   * Maximum partition position (defaults to 100).
   */
  max?: number;
}

/**
 * Behavioral configuration options for SplitterAria.
 */
export interface SplitterOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a splitter element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SplitterAttributes<E extends BaseElement = HTMLElement> extends DividerAttributes<E> {
  tabindex?: number;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
}

/**
 * Headless static structural divider compiling the separator role. A divider owns no
 * focus, no value, and no keyboard behavior; it only exposes an axis for direction.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class DividerAria<
  E extends BaseElement = HTMLElement,
  T extends DividerProps = DividerProps,
  A extends DividerAttributes<E> = DividerAttributes<E>,
  O extends DividerOptions = DividerOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      ...options,
      native: false,
    });

    this.omittedAttrs.push('aria-orientation');
    this.update();
  }

  /**
   * Visual axis of the divider.
   */
  public get orientation(): Orientation {
    return this.properties.orientation ?? 'horizontal';
  }

  /**
   * Computes the HTML and ARIA attributes for the divider.
   *
   * @returns Divider attributes dictionary
   */
  protected override createAttributes(): A {
    const attrs = Object.assign(super.createAttributes(), {
      'aria-orientation': this.orientation === 'vertical' ? 'vertical' : undefined,
    });

    attrs.role = 'separator';
    return attrs as A;
  }
}

/**
 * Headless interactive movable splitter compiling the separator role with range
 * semantics. A splitter always owns a tab stop and arrow-key position adjustment
 * over the partition it divides.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class SplitterAria<
  E extends BaseElement = HTMLElement,
  T extends SplitterProps = SplitterProps,
  A extends SplitterAttributes<E> = SplitterAttributes<E>,
  O extends SplitterOptions = SplitterOptions,
> extends DividerAria<E, T, A, O> {
  /**
   * Position delta applied per arrow keystroke. Fixed at class-definition level so
   * subclasses can re-scale it to their partition unit without exposing a JSX prop.
   */
  protected readonly step = 1;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    this.omittedAttrs.push('aria-valuenow', 'aria-valuemin', 'aria-valuemax');
    this.update();
  }

  /**
   * Current partition position, clamped to the inclusive range.
   */
  public get value(): number {
    return clampRange(this.properties.value ?? this.min, this.min, this.max);
  }

  public set value(next: number) {
    this.properties.value = clampRange(next, this.min, this.max);
  }

  /**
   * Minimum partition position.
   */
  public get min(): number {
    return this.properties.min ?? 0;
  }

  /**
   * Maximum partition position.
   */
  public get max(): number {
    return this.properties.max ?? 100;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the splitter.
   *
   * @returns Splitter attributes dictionary
   */
  protected override createAttributes(): A {
    const attrs = Object.assign(super.createAttributes(), {
      'aria-orientation': this.orientation === 'vertical' ? 'vertical' : undefined,
    });

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
