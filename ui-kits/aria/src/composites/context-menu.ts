import { $static, $symbol, createContext } from '@airlib/core';
import type { BaseElement } from '../types.js';
import type { ListboxAttributes } from './listbox.js';
import {
  MenuAria,
  type MenuCloseEvent,
  type MenuCommandEvent,
  type MenuOpenEvent,
  type MenuProps,
} from './menu/menu.js';
import { MenuPanelAria, type MenuPanelProps } from './menu/panel.js';

/**
 * Controller-dispatched event announced when the context menu opens.
 */
export type ContextMenuOpenEvent = MenuOpenEvent;

/**
 * Controller-dispatched event announced when the context menu closes.
 */
export type ContextMenuCloseEvent = MenuCloseEvent;

/**
 * Controller-dispatched command event bubbled from an activated item.
 */
export type ContextMenuCommandEvent = MenuCommandEvent;

/**
 * Reactive input properties for the ContextMenu host surface.
 */
export interface ContextMenuProps extends MenuProps {}

/**
 * Reactive input properties for the ContextMenu panel.
 */
export interface ContextMenuPanelProps extends MenuPanelProps {}

/**
 * Ambient context reader resolving the enclosing ContextMenu orchestrator.
 */
export const contextMenuCtx = createContext<ContextMenuAria>();

const CONTEXT_MENU_SYMBOL = $symbol('context-menu');

/**
 * Host surface and coordinator for context menus.
 *
 * Listens for `contextmenu` and `Shift + F10` / `ContextMenu` keyboard shortcuts
 * on the host surface, captures anchor coordinates into the panel's custom
 * properties, and composes the Menu coordinator contract.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ContextMenuAria<E extends BaseElement = HTMLElement> extends MenuAria<E> {
  /**
   * Captured pointer X coordinate.
   */
  public anchorX?: number;

  /**
   * Captured pointer Y coordinate.
   */
  public anchorY?: number;

  /**
   * @param props - User-provided context menu properties.
   */
  public constructor(props: ContextMenuProps = {}) {
    super(props);
    this.options.name = 'context-menu';
    this.options.symbol = CONTEXT_MENU_SYMBOL;

    contextMenuCtx.set(this as never);

    this.on('contextmenu', (event: MouseEvent) => {
      if (this.disabled) return;
      event.preventDefault();

      const { top, left } = this.element!.getBoundingClientRect();
      this.anchorX = event.clientX - left;
      this.anchorY = event.clientY - top;

      this.open = true;
    });

    this.on('keydown', (event: KeyboardEvent) => {
      if (this.disabled) return;

      const isF10 = event.key === 'F10' && event.shiftKey;
      const isContextMenu = event.key === 'ContextMenu';

      if (isF10 || isContextMenu) {
        event.preventDefault();

        const { top: anchorTop, left: anchorLeft } = this.element!.getBoundingClientRect();
        const { top, left, height, width } = (event.target as HTMLElement).getBoundingClientRect();
        this.anchorX = left + width / 2 - anchorLeft;
        this.anchorY = top + height - anchorTop;

        this.open = true;
      }
    });
  }

  protected override createAttributes() {
    return Object.assign(super.createAttributes(), {
      'aria-haspopup': this.open ? 'menu' : undefined,
      'aria-expanded': this.open ? 'true' : undefined,
      'aria-controls': this.open ? this.panelId : undefined,
      style: {
        anchorName: `--popover-anchor-${this.id}`,
      },
    });
  }

  /**
   * Creates a paired ContextMenuPanelAria instance.
   *
   * @param props - User-provided panel properties.
   * @returns Configured panel instance.
   */
  public override panel(props?: ContextMenuPanelProps): ContextMenuPanelAria {
    return new ContextMenuPanelAria(props);
  }
}

/**
 * Anchored panel for context menus.
 *
 * Inherits MenuPanelAria (vertical roving focus, typeahead, item activation,
 * and internal popover dismissal).
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ContextMenuPanelAria<E extends BaseElement = HTMLElement> extends MenuPanelAria<E> {
  public declare host?: ContextMenuAria;

  /**
   * Unique panel identifier, preferring user-provided ID or falling back to namespaced root ID.
   */
  public override get id(): string {
    return this.host?.id ?? this.properties.id!;
  }

  /**
   * @param props - User-provided panel properties.
   */
  public constructor(props: ContextMenuPanelProps = {}) {
    super(props);

    $static(() => {
      this.popup.properties.mode = ['click'];
    });

    this.popup.refine((_, attrs) => {
      if (this.host?.anchorX !== undefined && this.host?.anchorY !== undefined) {
        return {
          style: {
            ...attrs.style,
            '--anchor-x': `${this.host.anchorX}px`,
            '--anchor-y': `${this.host.anchorY}px`,
          },
        };
      }
    });
  }

  /**
   * Compiles the panel attributes, ensuring pointer coordinates are reflected in style.
   */
  protected override createAttributes(): ListboxAttributes<E> {
    const attrs = super.createAttributes();
    if (this.host?.anchorX !== undefined && this.host?.anchorY !== undefined) {
      attrs.style = {
        ...attrs.style,
        '--anchor-x': `${this.host.anchorX}px`,
        '--anchor-y': `${this.host.anchorY}px`,
      };
    }
    return attrs;
  }
}
