import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { withTabIndex } from './attributes.js';

export type MenuProps = ComponentStyles & {
  id?: string;
  label?: string;
  open?: Bindable<boolean>;
  disabled?: boolean;
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

const menuStyles: ComponentStyles = {};

register('menu', menuStyles);
register('menuButton', menuStyles);
register('menuPanel', menuStyles);
register('menuItem', menuStyles);
register('menuItemCheckbox', menuStyles);
register('menuItemRadio', menuStyles);
register('menuItemGroup', menuStyles);
register('menuBar', menuStyles);

/**
 * Root of a menu tree. The trigger, the panel, and the items find it
 * through ambient scope, and every dismissal path lands on one `open`.
 */
export const Menu = setup<MenuProps>((props) => {
  const menu = aria(MENU_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU, props, auiConfig.menu);

  return () => (
    <div ref={menu.ref} {...menu.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Menu');

/**
 * Trigger that carries the popup contract and opens the panel.
 */
export const MenuButton = setup<MenuButtonProps>((props) => {
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.MENU_BUTTON], props, auiConfig.menuButton);

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
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_PANEL, props, auiConfig.menuPanel);

  return () => (
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
  const item = aria(ITEM_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_ITEM, props, auiConfig.menuItem);

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
  const item = aria(ITEM_CHECKBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_ITEM_CHECKBOX, props, auiConfig.menuItemCheckbox);

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
  const item = aria(ITEM_RADIO_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_ITEM_RADIO, props, auiConfig.menuItemRadio);

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
 * Horizontal or vertical strip of menu buttons.
 */
export const MenuBar = setup<MenuBarProps>((props) => {
  const bar = aria(BAR_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.MENU_BAR, props, auiConfig.menuBar);

  return () => (
    <div ref={bar.ref} {...bar.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'MenuBar');
