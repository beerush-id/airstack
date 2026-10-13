import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { NavigationBase } from './navigation.js';

/**
 * Reactive input properties for BreadcrumbAria.
 */
export interface BreadcrumbProps extends AriaProps {
  /**
   * Accessible name for the navigation landmark (default: 'Breadcrumbs').
   */
  label?: string;
}

/**
 * Compiled HTML and ARIA attributes for a breadcrumb container.
 *
 * @template E - Target Element type
 */
export interface BreadcrumbAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  'aria-label'?: string;
}

/**
 * Headless trail navigation coordinator: labels the landmark and moves
 * DOM focus across enabled crumb links, wrapping at both ends.
 * The trail roves a single tab stop on the current crumb, like pagination.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class BreadcrumbAria<
  E extends BaseElement = HTMLElement,
  T extends BreadcrumbProps = BreadcrumbProps,
  A extends BreadcrumbAttributes<E> = BreadcrumbAttributes<E>,
> extends NavigationBase<E, T, A> {
  public constructor(props: Partial<T> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.update();
  }

  protected override get defaultLabel(): string {
    return 'Breadcrumbs';
  }
}

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
