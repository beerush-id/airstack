import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';

/**
 * Compiled HTML and ARIA attributes for a breadcrumb separator.
 *
 * @template E - Target Element type
 */
export interface BreadcrumbSeparatorAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'aria-hidden'?: 'true';
}

/**
 * Decorative trail delimiter, hidden from assistive technology.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class BreadcrumbSeparatorAria<
  E extends BaseElement = HTMLElement,
  A extends BreadcrumbSeparatorAttributes<E> = BreadcrumbSeparatorAttributes<E>,
> extends Aria<E, AriaProps, A> {
  public constructor(props: Partial<AriaProps> = {}) {
    super(props, { native: false });
    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the breadcrumb separator.
   */
  protected override createAttributes(): A {
    return {
      role: 'separator',
      'aria-hidden': 'true' as const,
    } as A;
  }
}
