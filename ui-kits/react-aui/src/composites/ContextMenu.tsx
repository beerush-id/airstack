import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { withTabIndex } from './attributes.js';

export type ContextMenuProps = ComponentStyles & {
  id?: string;
  label?: string;
  open?: Bindable<boolean>;
  disabled?: boolean;
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
register('contextMenuPanel', {});

/**
 * Surface that turns a secondary click or the keyboard shortcut into an
 * anchored panel. It compiles no role; the menu role lives on the panel.
 */
export const ContextMenu = setup<ContextMenuProps>((props) => {
  const menu = aria(CONTEXT_MENU_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONTEXT_MENU, props, auiConfig.contextMenu);

  return () => (
    <div ref={menu.ref} {...menu.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'ContextMenu');

/**
 * Anchored popup that carries the menu role, roves its items, and
 * records the pointer offset for CSS to place it with.
 */
export const ContextMenuPanel = setup<ContextMenuPanelProps>((props) => {
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.CONTEXT_MENU_PANEL, props, auiConfig.contextMenuPanel);

  return () => (
    <div ref={panel.ref} {...withTabIndex(panel.restProps(OMIT_KEYS))} className={className()}>
      {props.children}
    </div>
  );
}, 'ContextMenuPanel');
