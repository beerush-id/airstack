import { createContext } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaProps, BaseElement, Primitive } from '../../types.js';

/**
 * Ambient instance context for the enclosing MenuGroup coordinator.
 */
export const menuGroupCtx = createContext<MenuGroupAria>();

/**
 * Reactive input properties for MenuGroupAria.
 *
 * @template T - Member value token type
 */
export interface MenuGroupProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Accessible label.
   */
  label?: string;

  /**
   * Element ID providing accessible label.
   */
  labelledby?: string;

  /**
   * Scoped radio value for child menu-item-radio elements.
   */
  value?: T;
}

/**
 * Compiled HTML and ARIA attributes for a menu group container.
 *
 * @template E - Target Element type
 */
export interface MenuGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Headless menu subgroup container publishing an independent scoped
 * selection value for its menu-item-radio members. Non-radio members
 * are unaffected.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class MenuGroupAria<
  E extends BaseElement = HTMLElement,
  T extends MenuGroupProps = MenuGroupProps,
  A extends MenuGroupAttributes<E> = MenuGroupAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);

    menuGroupCtx.set(this as unknown as MenuGroupAria);
    selectionGroup.set(this.properties as Record<string, unknown>);
    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the menu group container.
   *
   * @returns Compiled group attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: 'group',
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
    }) as A;
  }
}
