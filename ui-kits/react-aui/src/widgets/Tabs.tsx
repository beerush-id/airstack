import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type TabsProps = ComponentStyles & {
  id?: string;
  value?: Bindable<string>;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<string>) => void;
};

export type TabListProps = ComponentStyles & {
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

export type TabButtonProps = ComponentStyles & {
  name: string;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export type TabPanelProps = ComponentStyles & {
  name: string;
  children?: ReactNode;
};

const TAB_ROLE = 'tab';
const LIST_ROLE = 'tab-list';
const BUTTON_ROLE = 'tab-button';
const TAB_PANEL_ROLE = 'tab-panel';

const tabsStyles: ComponentStyles = {};

register('tab', tabsStyles);
register('tabList', tabsStyles);
register('tabButton', tabsStyles);
register('tabPanel', tabsStyles);

/**
 * Tabbed interface showing one panel at a time. One tab stays open;
 * arrows move focus along the strip without swapping panels behind
 * the user, and selection commits on click, Enter, or Space.
 */
export const Tabs = setup<TabsProps>((props) => {
  const tabs = aria(TAB_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TAB, props, auiConfig.tab);

  return () => (
    <div ref={tabs.ref} {...tabs.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Tabs');

/**
 * Strip of triggers kept at a single tab stop. Names the strip for
 * screen readers so sibling groups stay distinguishable.
 */
export const TabList = setup<TabListProps>((props) => {
  const list = aria(LIST_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TAB_LIST, props, auiConfig.tabList);

  return () => (
    <div ref={list.ref} {...list.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'TabList');

/**
 * One trigger linked to its panel by a shared `name`. Disabled members
 * are skipped by arrow travel and refuse to switch.
 */
export const TabButton = setup<TabButtonProps>((props) => {
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TAB_BUTTON, props, auiConfig.tabButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'TabButton');

/**
 * Content behind one trigger. On screen only while its `name` is open.
 */
export const TabPanel = setup<TabPanelProps>((props) => {
  const panel = aria(TAB_PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TAB_PANEL, props, auiConfig.tabPanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'TabPanel');
