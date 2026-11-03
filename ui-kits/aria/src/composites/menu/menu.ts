import { $static, $symbol, type ContextReader } from '@airlib/core';
import type { AriaEvent, AriaEventHandler, BaseElement } from '../../types.js';
import { type ListboxProps, listboxCtx } from '../listbox.js';
import { PopupAria, type PopupCloseEvent, type PopupOpenEvent, type PopupProps, popupCtx } from '../popup/popup.js';
import { MenuButtonAria, type MenuButtonProps } from './button.js';
import type { MenuItemOptions } from './item.js';
import { MenuPanelAria, type MenuPanelProps } from './panel.js';

/**
 * Controller-dispatched event announced after the menu popup opens.
 */
export type MenuOpenEvent = PopupOpenEvent;

/**
 * Controller-dispatched event announced after the menu popup closes.
 */
export type MenuCloseEvent = PopupCloseEvent;

/**
 * Controller-dispatched command event carrying the acting item's name.
 */
export type MenuCommandEvent = AriaEvent<string>;

/**
 * Ambient context reader resolving the enclosing menu orchestrator for descendants.
 */
export const menuCtx = popupCtx as ContextReader<MenuAria>;

/**
 * Reactive input properties for the Menu root orchestrator.
 */
export interface MenuProps extends Omit<PopupProps, 'query' | 'required' | 'onopen' | 'onclose'> {
  /**
   * Called after the popup opens.
   */
  onopen?: AriaEventHandler<MenuOpenEvent>;

  /**
   * Called after the popup closes, through every dismissal path.
   */
  onclose?: AriaEventHandler<MenuCloseEvent>;

  /**
   * Root-level command listener; item `command` events bubble here.
   */
  oncommand?: AriaEventHandler<MenuCommandEvent>;

  /**
   * Pointer-hover transition delay in ms (default: 150).
   */
  delay?: number;
}

const MENU_SYMBOL = $symbol('menu');

/**
 * Root orchestrator hosting menu popup visibility.
 * Compiles no role; publishes ambient context for trigger, panel, and items.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MenuAria<E extends BaseElement = HTMLElement> extends PopupAria<E, MenuProps> {
  protected declare host?: MenuAria;

  /**
   * Deterministic panel identifier shared with the trigger's aria-controls.
   */
  public override get panelId(): string {
    return `${this.properties.id}-menu`;
  }

  /**
   * Whether the menu popup is currently open.
   */
  public get open() {
    return !!this.properties.open;
  }

  /**
   * Sets whether the menu popup is currently open.
   *
   * @param open - Visibility flag to apply.
   */
  public set open(open: boolean) {
    this.properties.open = open;
  }

  /**
   * Whether this menu is nested as a submenu of an enclosing menu.
   *
   * @returns True when an enclosing menu orchestrator was discovered.
   */
  public isSubmenu() {
    return !!this.host;
  }

  /**
   * @param props - User-provided root properties.
   */
  public constructor(props: MenuProps = {}) {
    super(props, { name: 'menu', symbol: MENU_SYMBOL, panelRole: 'menu' });

    this.host = menuCtx.get();
    this.omittedAttrs.push('delay', 'oncommand');

    $static(() => {
      if (this.host) {
        this.properties.id = `${this.host}-${this.properties.id}`;
      }
    });

    menuCtx.set(this as never);
    listboxCtx.set(this.properties as ListboxProps);

    this.update();
  }

  /**
   * Creates a new MenuButtonAria instance paired to this root.
   *
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   * @returns - Configured trigger instance.
   */
  public button(props?: MenuButtonProps, options?: MenuItemOptions): MenuButtonAria {
    return new MenuButtonAria(props, options);
  }

  /**
   * Creates a new MenuPanelAria instance paired to this root.
   *
   * @param props - User-provided panel properties.
   * @returns - Configured panel instance.
   */
  public panel(props?: MenuPanelProps): MenuPanelAria {
    return new MenuPanelAria(props);
  }
}
