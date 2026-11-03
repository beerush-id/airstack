import { $symbol, createContext, type StyleInput } from '@airlib/core';
import type { Aria } from '../../core.js';
import type { BaseElement } from '../../types.js';
import { triggerAnchorName } from '../../utils/overlay.js';
import {
  MenuAria,
  type MenuCloseEvent,
  type MenuCommandEvent,
  type MenuOpenEvent,
  type MenuProps,
} from '../menu/menu.js';
import { MenuPanelAria, type MenuPanelProps } from '../menu/panel.js';
import { ContextMenuPanelAria, type ContextMenuPanelProps } from './panel.js';

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
 * Ambient context reader resolving the enclosing ContextMenu orchestrator.
 */
export const contextMenuCtx = createContext<ContextMenuAria>();

const CONTEXT_MENU_SYMBOL = $symbol('context-menu');

/**
 * Coordinator for a context menu, which belongs to the part it is placed in.
 *
 * It finds that part — its host — in its own scope, and never renders an element
 * of its own: it listens for `contextmenu` and `Shift + F10` / `ContextMenu` on
 * the host's element, anchors the panel there, and lets every command bubble to
 * the host's `oncommand`. A context menu with no host has nothing to act on and
 * stays inert.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ContextMenuAria<E extends BaseElement = HTMLElement> extends MenuAria<E> {
  /**
   * The part this menu belongs to: the scope it was placed in.
   */
  public readonly target?: Aria;

  /**
   * Captured pointer X coordinate, from the host's top-left.
   */
  public anchorX?: number;

  /**
   * Captured pointer Y coordinate, from the host's top-left.
   */
  public anchorY?: number;

  /**
   * The host's element: the menu renders none of its own, and its panel dismisses and returns focus
   * against the part it belongs to.
   */
  public override get current(): E | null {
    return (this.target?.current as E | null | undefined) ?? null;
  }

  public override set current(element: E | null) {
    super.current = element;
  }

  /**
   * @param props - User-provided context menu properties.
   */
  public constructor(props: ContextMenuProps = {}) {
    super(props);
    this.options.name = 'context-menu';
    this.options.symbol = CONTEXT_MENU_SYMBOL;
    this.target = this.scope as Aria | undefined;

    contextMenuCtx.set(this as never);

    if (!this.target) {
      console.warn('[ARIA] A context menu has no part to belong to; place it inside the part it acts on.');
      return;
    }

    // The menu stands as its panel's trigger; without one, the panel takes the page as its host, so a
    // press anywhere counts as inside and other menus never close.
    this.actionable = this as never;

    const release = this.target.refine(() => ({
      'aria-haspopup': this.open ? 'menu' : undefined,
      'aria-expanded': this.open ? 'true' : undefined,
      'aria-controls': this.open ? this.panelId : undefined,
      style: { anchorName: triggerAnchorName(`--popover-anchor-${this.id}`) } as StyleInput,
      oncontextmenu: this.handleContextMenu,
      onclick: this.handleClick,
      onkeydown: this.handleKeyDown,
    }));
    this.cleanups.add(() => release(true));
  }

  /**
   * Opens the menu at the pointer.
   *
   * @param event - The host's `contextmenu` event.
   */
  protected handleContextMenu = (event: MouseEvent): void => {
    const host = this.target?.element;
    if (this.disabled || !host) return;
    event.preventDefault();
    // A menu nested deeper in the host owns the event; the host's own menu stays shut.
    event.stopPropagation();

    const { top, left } = host.getBoundingClientRect();
    this.anchorX = event.clientX - left;
    this.anchorY = event.clientY - top;

    this.open = true;
  };

  /**
   * Shuts the menu on a primary click on its host: the host counts as inside for the panel's
   * outside-press dismissal, so a click there would otherwise leave it open.
   */
  protected handleClick = (): void => {
    if (this.open) this.open = false;
  };

  /**
   * Opens the menu under the focused element on `Shift + F10` or the context-menu key.
   *
   * @param event - The host's `keydown` event.
   */
  protected handleKeyDown = (event: KeyboardEvent): void => {
    const host = this.target?.element;
    if (this.disabled || !host) return;
    if (!(event.key === 'F10' && event.shiftKey) && event.key !== 'ContextMenu') return;
    event.preventDefault();
    event.stopPropagation();

    const { top: hostTop, left: hostLeft } = host.getBoundingClientRect();
    const { top, left, height, width } = (event.target as HTMLElement).getBoundingClientRect();
    this.anchorX = left + width / 2 - hostLeft;
    this.anchorY = top + height - hostTop;

    this.open = true;
  };

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
