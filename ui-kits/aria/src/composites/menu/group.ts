import { Aria } from '../../core.js';
import { type SelectionGroupProps, selectionGroup } from '../../selection.js';
import type { AriaAttributes, BaseElement } from '../../types.js';
import { type MenuAria, menuCtx } from './menu.js';

/**
 * Reactive input properties for the Menu item group section.
 */
export interface MenuItemGroupProps extends SelectionGroupProps {
  /**
   * Accessible name announced for the section.
   */
  label?: string;

  /**
   * Element ID providing the accessible name.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for a menu item group section.
 *
 * @template E - Target Element type
 */
export interface MenuItemGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Structural menu section compiling `role="group"`.
 * Publishes its own selection group context scoping mutually exclusive
 * radio selection strictly to this subgroup.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Scoped radio value type
 */
export class MenuGroupAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  MenuItemGroupProps,
  MenuItemGroupAttributes<E>
> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  protected declare host: MenuAria;

  /**
   * @param props - User-provided group properties.
   */
  public constructor(props: MenuItemGroupProps = {}) {
    super(props);

    this.host = menuCtx.get();
    this.omittedAttrs.push('label', 'labelledby', 'value');

    selectionGroup.set(this.properties);
    this.update();
  }

  /**
   * Compiles the section attributes and its accessible name.
   */
  protected override createAttributes(): MenuItemGroupAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'group',
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
    }) as MenuItemGroupAttributes<E>;
  }
}
