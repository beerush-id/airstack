import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type DisclosureProps = ComponentStyles & {
  id?: string;
  expanded?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode;
  ontoggle?: (event: CustomEvent<boolean>) => void;
};

export type DisclosureTriggerProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type DisclosurePanelProps = ComponentStyles & {
  children?: ReactNode;
};

const DISCLOSURE_ROLE = 'disclosure';
const TRIGGER_ROLE = 'disclosure-trigger';
const PANEL_ROLE = 'disclosure-panel';

const disclosureStyles: ComponentStyles = {};

register('disclosure', disclosureStyles);
register('disclosureTrigger', disclosureStyles);
register('disclosurePanel', disclosureStyles);

/**
 * Single collapsible section. One state drives the trigger's
 * `aria-expanded` and the panel's `hidden`, both derived from one id.
 */
export const Disclosure = setup<DisclosureProps>((props) => {
  const disclosure = aria(DISCLOSURE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DISCLOSURE, props, auiConfig.disclosure);

  return () => (
    <div ref={disclosure.ref} {...disclosure.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'Disclosure');

/**
 * Control that opens the enclosing disclosure. Announces expansion,
 * commits one toggle per pointer, Enter, or Space gesture.
 */
export const DisclosureTrigger = setup<DisclosureTriggerProps>((props) => {
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DISCLOSURE_TRIGGER, props, auiConfig.disclosureTrigger);

  return () => (
    <button
      ref={trigger.ref}
      {...trigger.restProps(OMIT_KEYS as Parameters<typeof trigger.restProps>[0])}
      className={className()}
    >
      {props.children}
    </button>
  );
}, 'DisclosureTrigger');

/**
 * Content behind the trigger. Keeps `role="region"` while collapsed
 * and hides through `hidden`, never by dropping semantics.
 */
export const DisclosurePanel = setup<DisclosurePanelProps>((props) => {
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DISCLOSURE_PANEL, props, auiConfig.disclosurePanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DisclosurePanel');
