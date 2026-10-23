import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowDown } from '../icons/index.js';
import { hasEntries, type ItemEntry, type ItemsInput, toEntries } from '../utils/common.js';
import { withTabIndex } from './attributes.js';
import { menuScope } from './scopes.js';

/** One command row of an `items` menu: `name` is what `oncommand` receives. */
export type MenuEntry = ItemEntry;

export type MenuSlots = {
  trigger: () => ReactNode;
  item: (entry: MenuEntry) => ReactNode;
};

export type MenuProps = ComponentStyles & {
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

export type MenuButtonProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type MenuPanelProps = ComponentStyles & {
  children?: ReactNode;
};

export type MenuItemProps = ComponentStyles & {
  name?: string;
  disabled?: boolean;
  children?: ReactNode;
  oncommand?: (event: CustomEvent<string>) => void;
};

export type MenuItemCheckboxProps = ComponentStyles & {
  checked?: Bindable<boolean>;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  children?: ReactNode;
  oninput?: (event: CustomEvent<boolean>) => void;
  onchange?: (event: CustomEvent<boolean>) => void;
};

export type MenuItemRadioProps = ComponentStyles & {
  value?: string;
  name?: string;
  checked?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<boolean>) => void;
};

export type MenuItemGroupProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  value?: Bindable<string>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export type MenuBarProps = ComponentStyles & {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  labelledby?: string;
  disabled?: boolean;
  children?: ReactNode;
};

const MENU_ROLE = 'menu';
const BUTTON_ROLE = 'menu-button';
const PANEL_ROLE = 'menu-panel';
const ITEM_ROLE = 'menu-item';
const ITEM_CHECKBOX_ROLE = 'menu-item-checkbox';
const ITEM_RADIO_ROLE = 'menu-item-radio';
const ITEM_GROUP_ROLE = 'menu-item-group';
const BAR_ROLE = 'menu-bar';

const menuStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('menu', {});
register('menuButton', { ...menuStyles });
register('menuPanel', { size: SIZES.MD, color: COLORS.PRIMARY });
register('menuItem', { size: SIZES.MD, color: COLORS.PRIMARY });
register('menuItemCheckbox', { size: SIZES.MD, color: COLORS.PRIMARY });
register('menuItemRadio', { size: SIZES.MD, color: COLORS.PRIMARY });
register('menuItemGroup', {});
register('menuBar', {});

/**
 * Root of a menu tree. The trigger, the panel, and the items find it
 * through ambient scope, and every dismissal path lands on one `open`.
 * With `items` it renders the trigger, panel, and rows itself; `label`
 * becomes the trigger text and the `trigger` / `item` slots refine them.
 */
export const Menu = setup<MenuProps, MenuSlots>((props, slots) => {
  const menu = aria(MENU_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU, props, auiConfig.menu);

  // Chain through an enclosing menu bar so a styled bar styles every menu in it.
  menuScope.provide(menuScope.inherit(props));

  return () => (
    <div ref={menu.ref} {...menu.restProps([...OMIT_KEYS, 'items'])} className={className()}>
      {hasEntries(props.items) ? (
        <>
          <MenuButton>
            <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
            <ArrowDown aria-hidden="true" />
          </MenuButton>
          <MenuPanel>
            <For each={() => toEntries(props.items)}>
              {(entry) => (
                <MenuItem name={entry.name} disabled={entry.disabled}>
                  <Slot for={() => slots.item?.(entry)}>{entry.label ?? entry.name}</Slot>
                </MenuItem>
              )}
            </For>
          </MenuPanel>
        </>
      ) : (
        props.children
      )}
    </div>
  );
}, 'Menu');

/**
 * Trigger that carries the popup contract and opens the panel.
 */
export const MenuButton = setup<MenuButtonProps>((props) => {
  const styles = menuScope.inherit(props);
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.MENU_BUTTON], styles, auiConfig.menuButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'MenuButton');

/**
 * Popup that holds the items, roves them with the arrows, and dismisses
 * itself on `Escape`, an outside press, or a command.
 */
export const MenuPanel = setup<MenuPanelProps>((props) => {
  const styles = menuScope.inherit(props);
  const panel = aria(PANEL_ROLE, props as AnyType);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.PANEL, AUI_CLASS.MENU_PANEL], styles, auiConfig.menuPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...withTabIndex(panel.restProps(OMIT_KEYS))} className={className()}>
        {props.children}
      </div>
    );
}, 'MenuPanel');

/**
 * Command item. Activating it dispatches `command` with its `name` and
 * closes the menu.
 */
export const MenuItem = setup<MenuItemProps>((props) => {
  const styles = menuScope.inherit(props);
  const item = aria(ITEM_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.MENU_ITEM], styles, auiConfig.menuItem);

  return () => (
    <button ref={item.ref} {...withTabIndex(item.restProps(OMIT_KEYS))} className={className()}>
      {renderDynamic(props.children, item)}
    </button>
  );
}, 'MenuItem');

/**
 * Item that holds a checked state, with an indeterminate third state.
 */
export const MenuItemCheckbox = setup<MenuItemCheckboxProps>((props) => {
  const styles = menuScope.inherit(props);
  const item = aria(ITEM_CHECKBOX_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.ITEM, AUI_CLASS.MENU_ITEM_CHECKBOX], styles, auiConfig.menuItemCheckbox);

  return () => (
    <div ref={item.ref} {...withTabIndex(item.restProps(OMIT_KEYS))} className={className()}>
      {renderDynamic(props.children, item)}
    </div>
  );
}, 'MenuItemCheckbox');

/**
 * Item that selects one value inside its group.
 */
export const MenuItemRadio = setup<MenuItemRadioProps>((props) => {
  const styles = menuScope.inherit(props);
  const item = aria(ITEM_RADIO_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.MENU_ITEM_RADIO], styles, auiConfig.menuItemRadio);

  return () => (
    <div ref={item.ref} {...withTabIndex(item.restProps(OMIT_KEYS))} className={className()}>
      {renderDynamic(props.children, item)}
    </div>
  );
}, 'MenuItemRadio');

/**
 * Named group that coordinates its radio items around one value.
 */
export const MenuItemGroup = setup<MenuItemGroupProps>((props) => {
  const group = aria(ITEM_GROUP_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_ITEM_GROUP, props, auiConfig.menuItemGroup);

  return () => (
    <div ref={group.ref} {...group.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'MenuItemGroup');

/**
 * Horizontal or vertical strip of menu buttons. Its size, color, and
 * variant reach every menu inside it.
 */
export const MenuBar = setup<MenuBarProps>((props) => {
  const bar = aria(BAR_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_BAR, props, auiConfig.menuBar);

  menuScope.provide(props);

  return () => (
    <div ref={bar.ref} {...bar.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'MenuBar');
