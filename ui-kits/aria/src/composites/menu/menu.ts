import { $symbol, type ContextReader } from '@airlib/core';
import type { AriaEvent, AriaEventHandler, BaseElement } from '../../types.js';
import { listboxCtx, type ListboxProps } from '../listbox.js';
import { PopupAria, type PopupCloseEvent, popupCtx, type PopupOpenEvent, type PopupProps } from '../popup.js';
import { MenuButtonAria, type MenuButtonProps } from './button.js';
import type { MenuItemOptions } from './item.js';
import { MenuPanelAria, type MenuPanelProps } from './panel.js';

/**
 * Controller-dispatched menu event carrying the acting item's name or committed state.
 */
export type MenuOpenEvent = PopupOpenEvent;
export type MenuCloseEvent = PopupCloseEvent;
export type MenuCommandEvent = AriaEvent<string>;

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
  /**
   * Deterministic panel identifier shared with the trigger's aria-controls.
   */
  public override get panelId(): string {
    return `${this.properties.id}-menu`;
  }

  public get open() {
    return !!this.properties.open;
  }

  public set open(open: boolean) {
    this.properties.open = open;
  }

  public constructor(props: MenuProps = {}) {
    super(props, { name: 'menu', symbol: MENU_SYMBOL, panelRole: 'menu' });

    this.omittedAttrs.push('delay', 'oncommand');

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

  protected capture(event: AriaEvent): void {
    super.capture(event);
    if (event.type === 'command') {
      this.properties.oncommand?.(event as MenuCommandEvent);
    }
  }
}
