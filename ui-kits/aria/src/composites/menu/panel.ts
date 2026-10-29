import { selectionGroup } from '../../selection.js';
import type { AriaEvent, AriaProps, BaseElement } from '../../types.js';
import { ENABLED_QUERY } from '../../utils/attributes.js';
import type { PopoverAria } from '../../widgets/popover.js';
import { ListboxAria, type ListboxAttributes } from '../listbox.js';
import { bindPanel, type PopupPanel } from '../popup/panel.js';
import { type MenuAria, menuCtx } from './menu.js';

const ROLE_PANEL = 'menu';
const ITEM_SELECTOR = ['[role="menuitem"]', '[role="menuitemcheckbox"]', "[role='menuitemradio']"];
const ENABLED_ITEM_SELECTOR = ITEM_SELECTOR.map((s) => `${s}${ENABLED_QUERY}`).join(',');

/**
 * Reactive input properties for the Menu popup panel.
 */
export interface MenuPanelProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Accessible name announced for the menu.
   */
  label?: string;

  /**
   * Element ID providing the accessible name.
   */
  labelledby?: string;
}

/**
 * Popup menu container inheriting listbox mechanics and proxying overlay
 * dismissal, positioning, and focus management through an internal popover.
 * Always vertical; roves across menu item roles with arrows, Home/End,
 * typeahead, and activates the focused item on Enter/Space.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MenuPanelAria<E extends BaseElement = HTMLElement> extends ListboxAria<E> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  public host?: MenuAria;

  /**
   * Internal popover proxying overlay dismissal, positioning, and focus management.
   */
  public popup!: PopoverAria;

  protected override selector = ITEM_SELECTOR.join(',');
  protected override enabledSelector = ENABLED_ITEM_SELECTOR;

  /**
   * Unique panel identifier derived from the paired root namespace.
   */
  public override get id() {
    return this.host ? `${this.host.id}-menu` : this.properties.id;
  }

  /**
   * Whether the popup is currently open.
   */
  public get open() {
    return this.popup.open;
  }

  /**
   * Sets the internal panel element reference and delegates to the popup.
   *
   * @param element - Element to track.
   */
  /* istanbul ignore next: no flow assigns panel.current; popup tracks the element through its own ref */
  public override set current(element: E | null) {
    super.current = element;
    this.popup.current = element as unknown as HTMLElement;
  }

  /**
   * Leaves a command to its menu: the panel shares the menu's properties, so answering it here as
   * well would run the menu's `oncommand` twice for one command.
   *
   * @param event - The event to capture.
   */
  protected override capture(event: AriaEvent): void {
    if (event.type === 'command') return;
    super.capture(event);
  }

  /**
   * Compiles the panel attributes with the menu role and vertical orientation.
   */
  protected override createAttributes(): ListboxAttributes<E> {
    return Object.assign((this.popup as unknown as this).attrs, super.createAttributes(), {
      role: ROLE_PANEL,
      'aria-orientation': 'vertical',
    });
  }

  /**
   * @param props - User-provided panel properties.
   */
  public constructor(props: MenuPanelProps = {}) {
    super(props, true);

    this.host = menuCtx.get();
    this.omittedAttrs.push('labelledby', 'oncommand');
    bindPanel(this as unknown as PopupPanel);

    selectionGroup.set(undefined);
    this.update();
  }
}
