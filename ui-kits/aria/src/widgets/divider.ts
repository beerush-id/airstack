import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Orientation } from '../types.js';

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
