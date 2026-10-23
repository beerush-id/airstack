import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, Slot, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { hasEntries, type ItemsInput, toEntries } from '../utils/common.js';
import { withTabIndex } from './attributes.js';
import { type MenuEntry, MenuItem } from './Menu.js';
import { menuScope } from './scopes.js';

export type ContextMenuSlots = {
  item: (entry: MenuEntry) => ReactNode;
};

export type ContextMenuProps = ComponentStyles & {
  id?: string;
  label?: string;
  open?: Bindable<boolean>;
  disabled?: boolean;
  items?: ItemsInput;
  children?: ReactNode;
  onopen?: (event: CustomEvent<true>) => void;
  onclose?: (event: CustomEvent<false>) => void;
  oncommand?: (event: CustomEvent<string>) => void;
};

export type ContextMenuPanelProps = ComponentStyles & {
  children?: ReactNode;
};

const CONTEXT_MENU_ROLE = 'context-menu';
const PANEL_ROLE = 'context-menu-panel';

register('contextMenu', {});
register('contextMenuPanel', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * Surface that turns a secondary click or the keyboard shortcut into an
 * anchored panel. It compiles no role; the menu role lives on the panel.
 * With `items` the children are the target and the panel is rendered for
 * you, one row per entry; the `item` slot refines each row.
 */
export const ContextMenu = setup<ContextMenuProps, ContextMenuSlots>((props, slots) => {
  const menu = aria(CONTEXT_MENU_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONTEXT_MENU, props, auiConfig.contextMenu);

  menuScope.provide(menuScope.inherit(props));

  return () => (
    <div ref={menu.ref} {...menu.restProps([...OMIT_KEYS, 'items'])} className={className()}>
      {props.children}
      {hasEntries(props.items) && (
        <ContextMenuPanel>
          <For each={() => toEntries(props.items)}>
            {(entry) => (
              <MenuItem name={entry.name} disabled={entry.disabled}>
                <Slot for={() => slots.item?.(entry)}>{entry.label ?? entry.name}</Slot>
              </MenuItem>
            )}
          </For>
        </ContextMenuPanel>
      )}
    </div>
  );
}, 'ContextMenu');

/**
 * Anchored popup that carries the menu role, roves its items, and
 * records the pointer offset for CSS to place it with.
 */
export const ContextMenuPanel = setup<ContextMenuPanelProps>((props) => {
  const styles = menuScope.inherit(props);
  const panel = aria(PANEL_ROLE, props as AnyType);
  const shadow = shadowPortal(() => panel.open);
  const className = () =>
    $families([AUI_CLASS.PANEL, AUI_CLASS.CONTEXT_MENU_PANEL], styles, auiConfig.contextMenuPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...withTabIndex(panel.restProps(OMIT_KEYS))} className={className()}>
        {props.children}
      </div>
    );
}, 'ContextMenuPanel');
