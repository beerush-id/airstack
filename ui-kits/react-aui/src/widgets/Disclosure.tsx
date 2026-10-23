import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowDown } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';

export type DisclosureSlots = {
  trigger: () => ReactNode;
};

export type DisclosureProps = ComponentStyles & {
  id?: string;
  expanded?: Bindable<boolean>;
  disabled?: boolean;
  label?: string;
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

register('disclosure', { size: SIZES.MD, color: COLORS.PRIMARY });
register('disclosureTrigger', { size: SIZES.MD, color: COLORS.PRIMARY });
register('disclosurePanel', {});

const disclosureScope = createStyleScope();

/**
 * Single collapsible section. One state drives the trigger's
 * `aria-expanded` and the panel's `hidden`, both derived from one id.
 * With `label` it renders the trigger and the panel for you, and the
 * children become the panel content.
 */
export const Disclosure = setup<DisclosureProps, DisclosureSlots>((props, slots) => {
  const disclosure = aria(DISCLOSURE_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.SCALE, AUI_CLASS.COLLAPSIBLE, AUI_CLASS.DISCLOSURE], props, auiConfig.disclosure);

  disclosureScope.provide(props);

  return () => (
    <div ref={disclosure.ref} {...disclosure.restProps(OMIT_KEYS)} className={className()}>
      {props.label === undefined ? (
        props.children
      ) : (
        <>
          <DisclosureTrigger>
            <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
          </DisclosureTrigger>
          <DisclosurePanel>{props.children}</DisclosurePanel>
        </>
      )}
    </div>
  );
}, 'Disclosure');

/**
 * Control that opens the enclosing disclosure. Announces expansion,
 * commits one toggle per pointer, Enter, or Space gesture.
 */
export const DisclosureTrigger = setup<DisclosureTriggerProps>((props) => {
  const styles = disclosureScope.inherit(props);
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families(
      [AUI_CLASS.ITEM, AUI_CLASS.COLLAPSIBLE_HEADER, AUI_CLASS.DISCLOSURE_TRIGGER],
      styles,
      auiConfig.disclosureTrigger
    );

  return () => (
    <button
      ref={trigger.ref}
      {...trigger.restProps(OMIT_KEYS as Parameters<typeof trigger.restProps>[0])}
      className={className()}
    >
      {props.children}
      <ArrowDown aria-hidden="true" />
    </button>
  );
}, 'DisclosureTrigger');

/**
 * Content behind the trigger. Keeps `role="region"` while collapsed
 * and hides through `hidden`, never by dropping semantics.
 */
export const DisclosurePanel = setup<DisclosurePanelProps>((props) => {
  const panel = aria(PANEL_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.COLLAPSIBLE_BODY, AUI_CLASS.DISCLOSURE_PANEL], props, auiConfig.disclosurePanel);

  return () => (
    <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'DisclosurePanel');
