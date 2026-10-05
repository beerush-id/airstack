import { createContext } from '@airlib/core';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../../types.js';
import { MenuContainerAria } from './container.js';

/**
 * Ambient instance context for the enclosing Menubar orchestrator.
 */
export const menubarCtx = createContext<MenubarAria>();

/**
 * Reactive input properties for the menubar container.
 */
export interface MenubarProps extends AriaProps {
  /**
   * Accessible label.
   */
  label?: string;

  /**
   * Container axis orientation.
   */
  orientation?: Orientation;
}

/**
 * Compiled HTML and ARIA attributes for a menubar container.
 *
 * @template E - Target Element type
 */
export interface MenubarAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'menubar';
  'aria-orientation'?: Orientation;
  'aria-label'?: string;
}

/**
 * Headless WAI-ARIA Menubar coordinator managing a horizontal command bar
 * with single-tab-stop roving focus across top-level menus.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class MenubarAria<
  E extends BaseElement = HTMLElement,
  T extends MenubarProps = MenubarProps,
  A extends MenubarAttributes<E> = MenubarAttributes<E>,
> extends MenuContainerAria<E, T, A> {
  protected override readonly containerRole: 'menubar' = 'menubar';
  protected override readonly defaultOrientation: Orientation = 'horizontal';

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.omittedAttrs.push('aria-orientation');
    this.update();
    menubarCtx.set(this as unknown as MenubarAria);
  }

  /**
   * Visual and keyboard navigation orientation of the bar.
   */
  public get orientation(): Orientation {
    return this.properties.orientation ?? this.defaultOrientation;
  }

  /**
   * Computes HTML and ARIA attributes for the menubar container.
   *
   * @returns Compiled menubar attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      'aria-orientation': this.orientation,
      'aria-label': this.properties.label,
    }) as A;
  }
}
