import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type AccordionValue = string | string[] | null;

export type AccordionProps = ComponentStyles & {
  id?: string;
  value?: Bindable<AccordionValue>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  manual?: boolean;
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

const accordionStyles: ComponentStyles = {};

register('accordion', accordionStyles);
register('accordionButton', accordionStyles);
register('accordionPanel', accordionStyles);

/**
 * Stacked collapsible sections with header focus travel. Single expansion
 * collapses freely unless `required`; `multiple` toggles each name alone.
 */
export const Accordion = setup<AccordionProps>((props) => {
  const accordion = aria(ACCORDION_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.ACCORDION, props, auiConfig.accordion);

  return () => (
    <div ref={accordion.ref} {...accordion.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Accordion');

/**
 * One header paired to its panel by a shared `name`. Stays in the tab
 * order; arrows travel across headers without leaving the group.
 */
export const AccordionButton = setup<AccordionButtonProps>((props) => {
  const button = aria(BUTTON_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.ACCORDION_BUTTON, props, auiConfig.accordionButton);

  return () => (
    <button ref={button.ref} {...button.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'AccordionButton');

/**
 * Content under one header. Visible only while its `name` is open.
 */
export const AccordionPanel = setup<AccordionPanelProps>((props) => {
  const panel = aria(ACCORDION_PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.ACCORDION_PANEL, props, auiConfig.accordionPanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'AccordionPanel');
