import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { NavigationBase } from './navigation.js';

/**
 * Reactive input properties for PaginationAria.
 */
export interface PaginationProps extends AriaProps {
  /**
   * Accessible name for the navigation landmark (default: 'Pagination').
   */
  label?: string;

  /**
   * Current page position (default: 1).
   */
  page?: number;

  /**
   * Last page position. Absent means the forward bound is unknown.
   */
  total?: number;
}

/**
 * Compiled HTML and ARIA attributes for a pagination container.
 *
 * @template E - Target Element type
 */
export interface PaginationAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  'aria-label'?: string;
}

/**
 * Headless page-list navigation coordinator: labels the landmark and moves
 * DOM focus across enabled page links, wrapping at both ends.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class PaginationAria<
  E extends BaseElement = HTMLElement,
  T extends PaginationProps = PaginationProps,
  A extends PaginationAttributes<E> = PaginationAttributes<E>,
> extends NavigationBase<E, T, A> {
  public constructor(props: Partial<T> = {}, options: AriaOptions = { native: true }) {
    super(props, options);

    this.omittedAttrs.push('page', 'total');
    this.update();
  }

  /**
   * Current page position.
   */
  public get page(): number {
    return this.properties.page ?? 1;
  }

  public set page(page: number) {
    this.properties.page = page;
  }

  /**
   * Last page position, or undefined when the forward bound is unknown.
   */
  public get total(): number | undefined {
    return this.properties.total;
  }

  /**
   * Whether a page exists before the current one.
   */
  public get canBackward(): boolean {
    return this.page > 1;
  }

  /**
   * Whether a page exists after the current one.
   */
  public get canForward(): boolean {
    return this.total !== undefined && this.page < this.total;
  }

  /**
   * Steps to the previous page where one exists.
   */
  public prev(): void {
    if (this.canBackward) this.page -= 1;
  }

  /**
   * Steps to the next page where one exists.
   */
  public next(): void {
    if (this.canForward) this.page += 1;
  }

  protected override get defaultLabel(): string {
    return 'Pagination';
  }
}
