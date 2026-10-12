import type { BaseElement, Orientation } from '../../types.js';
import { ToolbarAria, type ToolbarAttributes, type ToolbarProps } from '../toolbar.js';

/**
 * Reactive input properties for the Menubar command bar.
 */
export interface MenubarProps extends ToolbarProps {
  /**
   * Element ID providing the accessible name.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for a menubar container.
 *
 * @template E - Target Element type
 */
export interface MenubarAttributes<E extends BaseElement = HTMLElement> extends ToolbarAttributes<E> {
  'aria-labelledby'?: string;
}

/**
 * Horizontal command bar compiling `role="menubar"`.
 * Inherits single-tab-stop roving focus from the toolbar controller;
 * always horizontal.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MenubarAria<E extends BaseElement = HTMLElement> extends ToolbarAria<
  E,
  MenubarProps,
  MenubarAttributes<E>
> {
  public constructor(props: MenubarProps = {}) {
    super(props as ToolbarProps);
    this.omittedAttrs.push('labelledby');
    this.update();
  }

  /**
   * A menubar always navigates horizontally.
   */
  public override get orientation(): Orientation {
    return 'horizontal';
  }

  protected override createAttributes() {
    return Object.assign(super.createAttributes(), {
      role: 'menubar',
      'aria-orientation': 'horizontal',
      'aria-labelledby': this.properties.labelledby,
    });
  }
}
