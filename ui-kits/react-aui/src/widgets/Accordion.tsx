import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowDown } from '../icons/index.js';
import { createStyleScope, hasEntries, type ItemEntry, type ItemsInput, toEntries } from '../utils/common.js';

export type AccordionValue = string | string[] | null;

export type AccordionSlots = {
  header: (entry: ItemEntry) => ReactNode;
  panel: (entry: ItemEntry) => ReactNode;
};

export type AccordionProps = ComponentStyles & {
  id?: string;
  value?: Bindable<AccordionValue>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  manual?: boolean;
  items?: ItemsInput;
  children?: ReactNode;
  onchange?: (event: CustomEvent<string | string[] | null>) => void;
};

export type AccordionButtonProps = ComponentStyles & {
  name: string;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export type AccordionPanelProps = ComponentStyles & {
  name: string;
  children?: ReactNode;
};

const ACCORDION_ROLE = 'accordion';
const BUTTON_ROLE = 'accordion-button';
const ACCORDION_PANEL_ROLE = 'accordion-panel';

register('accordion', { size: SIZES.MD, color: COLORS.PRIMARY });
register('accordionButton', { size: SIZES.MD, color: COLORS.PRIMARY });
register('accordionPanel', {});

const accordionScope = createStyleScope();

/**
 * Stacked collapsible sections with header focus travel. Single expansion
 * collapses freely unless `required`; `multiple` toggles each name alone.
 * With `items` it renders one header and panel per entry; the `panel` slot
 * fills each panel and the `header` slot refines each header.
 */
export const Accordion = setup<AccordionProps, AccordionSlots>((props, slots) => {
  const accordion = aria(ACCORDION_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.SCALE, AUI_CLASS.COLLAPSIBLE, AUI_CLASS.ACCORDION], props, auiConfig.accordion);

  accordionScope.provide(props);

  return () => (
    <div ref={accordion.ref} {...accordion.restProps([...OMIT_KEYS, 'items'])} className={className()}>
      {hasEntries(props.items) ? (
        <For each={() => toEntries(props.items)}>
          {(entry) => (
            <>
              <AccordionButton name={entry.name} disabled={entry.disabled}>
                <Slot for={() => slots.header?.(entry)}>{entry.label ?? entry.name}</Slot>
              </AccordionButton>
              <AccordionPanel name={entry.name}>{slots.panel?.(entry)}</AccordionPanel>
            </>
          )}
        </For>
      ) : (
        props.children
      )}
    </div>
  );
}, 'Accordion');

/**
 * One header paired to its panel by a shared `name`. Stays in the tab
 * order; arrows travel across headers without leaving the group.
 */
export const AccordionButton = setup<AccordionButtonProps>((props) => {
  const styles = accordionScope.inherit(props);
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.ITEM, AUI_CLASS.COLLAPSIBLE_HEADER, AUI_CLASS.ACCORDION_BUTTON], styles, auiConfig.accordionButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
      <ArrowDown aria-hidden="true" />
    </button>
  );
}, 'AccordionButton');

/**
 * Content under one header. Visible only while its `name` is open.
 */
export const AccordionPanel = setup<AccordionPanelProps>((props) => {
  const panel = aria(ACCORDION_PANEL_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.COLLAPSIBLE_BODY, AUI_CLASS.ACCORDION_PANEL], props, auiConfig.accordionPanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'AccordionPanel');
