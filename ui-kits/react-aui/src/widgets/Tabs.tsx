import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { createStyleScope, hasEntries, type ItemEntry, type ItemsInput, toEntries } from '../utils/common.js';

/** One tab of an `items` strip: `name` links the trigger to its panel. */
export type TabEntry = ItemEntry;

export type TabsSlots = {
  tab: (entry: TabEntry) => ReactNode;
  panel: (entry: TabEntry) => ReactNode;
};

export type TabsProps = ComponentStyles & {
  id?: string;
  value?: Bindable<string>;
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  items?: ItemsInput;
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

register('tab', {});
register('tabList', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });
register('tabButton', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });
register('tabPanel', {});

const tabsScope = createStyleScope();

/**
 * Tabbed interface showing one panel at a time. One tab stays open;
 * arrows move focus along the strip without swapping panels behind
 * the user, and selection commits on click, Enter, or Space.
 * With `items` it renders the strip and one panel per entry; the `panel`
 * slot fills each panel and the `tab` slot refines each trigger.
 */
export const Tabs = setup<TabsProps, TabsSlots>((props, slots) => {
  const tabs = aria(TAB_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TAB, { className: props.className }, auiConfig.tab);

  tabsScope.provide(props);

  return () => (
    <div ref={tabs.ref} {...tabs.restProps([...OMIT_KEYS, 'items'])} className={className()}>
      {hasEntries(props.items) ? (
        <>
          <TabList label={props.label}>
            <For each={() => toEntries(props.items)}>
              {(entry) => (
                <TabButton name={entry.name} disabled={entry.disabled}>
                  <Slot for={() => slots.tab?.(entry)}>{entry.label ?? entry.name}</Slot>
                </TabButton>
              )}
            </For>
          </TabList>
          <For each={() => toEntries(props.items)}>
            {(entry) => <TabPanel name={entry.name}>{slots.panel?.(entry)}</TabPanel>}
          </For>
        </>
      ) : (
        props.children
      )}
    </div>
  );
}, 'Tabs');

/**
 * Strip of triggers kept at a single tab stop. Names the strip for
 * screen readers so sibling groups stay distinguishable.
 */
export const TabList = setup<TabListProps>((props) => {
  const styles = tabsScope.inherit(props);
  const list = aria(LIST_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.TAB_LIST], styles, auiConfig.tabList);

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
  const styles = tabsScope.inherit(props);
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.TAB_BUTTON], styles, auiConfig.tabButton);

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
