import { createContext } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';

/**
 * Ambient instance context for the enclosing Pagination coordinator.
 */
export const paginationCtx = createContext<PaginationAria>();

/**
 * Reactive input properties for PaginationAria.
 */
export interface PaginationProps extends AriaProps {
  /**
   * Accessible name for the navigation landmark (default: 'Pagination').
   */
  label?: string;
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
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}, options: AriaOptions = { native: true }) {
    super(props, options);

    paginationCtx.set(this as unknown as PaginationAria);
    this.omittedAttrs.push('label');

    this.on('keydown', (event) => {
      handleRovingKey(this.element, event, {
        manual: true,
        selector: PAGINATION_SELECTORS,
        orientation: 'horizontal',
      });
    });

    this.update();
  }

  /**
   * Accessible name for the navigation landmark.
   */
  public get label(): string {
    return this.properties.label ?? 'Pagination';
  }

  /**
   * Computes HTML and ARIA attributes for the pagination container.
   */
  protected override createAttributes(): A {
    return {
      role: this.isNative ? undefined : 'navigation',
      'aria-label': this.label,
    } as A;
  }
}

const PAGINATION_SELECTORS = ['a[href]', '[role="link"]'].map((s) => `${s}:not([aria-disabled="true"])`).join(',');
