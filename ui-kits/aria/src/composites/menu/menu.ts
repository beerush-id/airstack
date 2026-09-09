import { $static, $symbol, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { MenuButtonAria, type MenuButtonProps } from './button.js';
import { menuCtx, ROLE_MENU } from './container.js';
import type { MenuItemOptions } from './item.js';
import { MenuPanelAria, type MenuPanelProps } from './panel.js';

/**
 * Reactive input properties for the Menu root orchestrator.
 */
export interface MenuProps extends AriaProps {
  /**
   * Optional DOM element identifier scoping pair linkage.
   */
  id?: string;

  /**
   * Whether the paired popup panel is open.
   */
  open?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the menu root wrapper.
 *
 * @template E - Target Element type
 */
export interface MenuAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * Root logical orchestrator pairing a menu trigger with its popup panel.
 * Owns open state and the pair id namespace; holds zero selection state.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class MenuAria<
  E extends BaseElement = HTMLElement,
  T extends MenuProps = MenuProps,
  A extends MenuAttributes<E> = MenuAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_MENU}-${uIndex($symbol(ROLE_MENU), true)}`;

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.props.id = this.props.id ?? this.id;
      this.props.open = this.props.open ?? false;
    });
    menuCtx.set(this as unknown as MenuAria);
    this.update();
  }

  /**
   * Whether the paired popup panel is open.
   */
  public get open(): boolean {
    return !!this.props.open;
  }

  public set open(value: boolean) {
    this.props.open = value;
  }

  /**
   * Spawns a MenuButtonAria trigger controller bound to this menu instance.
   *
   * @template TE - Target Element type (defaults to HTMLButtonElement)
   * @param props - MenuButton reactive properties
   * @param options - MenuButton configuration options
   * @returns Configured MenuButtonAria instance
   */
  public button<TE extends BaseElement = HTMLButtonElement>(
    props: Partial<MenuButtonProps> = {},
    options?: Partial<MenuItemOptions>
  ): MenuButtonAria<TE> {
    return new MenuButtonAria<TE>(props, options);
  }

  /**
   * Spawns a MenuPanelAria popup panel controller bound to this menu instance.
   *
   * @template PE - Target Element type (defaults to HTMLElement)
   * @param props - Menu panel reactive properties
   * @returns Configured MenuPanelAria instance
   */
  public panel<PE extends BaseElement = HTMLElement>(props: Partial<MenuPanelProps> = {}): MenuPanelAria<PE> {
    return new MenuPanelAria<PE>(props);
  }

  /**
   * Compiles base attributes for the menu root element.
   *
   * @returns Menu root attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      id: this.props.id!,
    }) as A;
  }
}
