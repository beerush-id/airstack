import { aria, type OptionAria, type SelectAria, type SelectPanelAria, type SelectTriggerAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import {
  $families,
  type AuiFieldProps,
  type AuiPrimitive,
  type AuiProps,
  auiConfig,
  type ComponentStyles,
  type FieldStyles,
  OMIT_KEYS,
} from '../config.js';
import { ArrowDown, CheckIcon } from '../icons/index.js';
import { createStyleScope, hasEntries, type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';

export type SelectValue = AuiPrimitive | AuiPrimitive[];
export type SelectItem = OptionEntry;

export type SelectSlots = {
  option: (entry: OptionEntry, option: OptionAria) => ReactNode;
  trigger: (value?: AuiPrimitive | AuiPrimitive[]) => ReactNode;
};

export type SelectProps = FieldStyles & {
  open?: Bindable<boolean>;
  value?: Bindable<SelectValue>;
  label?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;

  options?: OptionsInput;
  children?: ReactNode | ((instance: SelectAria) => ReactNode);

  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  oninput?: (event: CustomEvent<string | undefined>) => void;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
};

export type SelectTriggerProps = AuiFieldProps<'button'> & {
  label?: string;
  disabled?: boolean;
  children?: ReactNode | ((trigger: SelectTriggerAria) => ReactNode);
  placeholder?: string;
};

export type SelectPanelProps = AuiProps<'div'> & {
  id?: string;
  children?: ReactNode | ((panel: SelectPanelAria) => ReactNode);
};

export type SelectOptionProps = AuiProps<'div'> & {
  value: string;
  children?: ReactNode | ((option: OptionAria) => ReactNode);
  disabled?: boolean;
};

const SELECT_ROLE = 'select';
const SELECT_PANEL_ROLE = 'select-panel';
const SELECT_OPTION_ROLE = 'option';
const SELECT_TRIGGER_ROLE = 'select-trigger';

const selectStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('select', selectStyles);
register('selectPanel', selectStyles);
register('selectOption', selectStyles);
register('selectTrigger', selectStyles);

const selectScope = createStyleScope<SelectProps>();

export const Select = setup<SelectProps, SelectSlots>((props, slots) => {
  const select = aria(SELECT_ROLE, props as AnyType);

  selectScope.provide(props);

  return () => {
    if (hasEntries(props.options)) {
      return (
        <>
          <SelectTrigger label={props.label} placeholder={props.placeholder}>
            <Slot for={() => slots.trigger?.(select.value)}>{select.label || props.placeholder}</Slot>
          </SelectTrigger>
          <SelectPanel>
            <For each={() => toOptions(props.options)}>
              {(entry) => (
                <SelectOption value={entry.key}>
                  {(option) => <Slot for={() => slots.option?.(entry, option)}>{entry.label ?? entry.key}</Slot>}
                </SelectOption>
              )}
            </For>
          </SelectPanel>
        </>
      );
    }

    const className = () => $families(AUI_CLASS.SELECT, props as ComponentStyles, auiConfig.select);
    return (
      <div ref={select.ref} {...select.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, select)}
      </div>
    );
  };
}, 'Select');

export const SelectTrigger = setup<SelectTriggerProps>((props) => {
  const styles = selectScope.inherit(props as ComponentStyles);
  const trigger = aria(SELECT_TRIGGER_ROLE, props);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.SELECT_TRIGGER], styles, auiConfig.selectTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.label && <span className={AUI_CLASS.SELECT_PLACEHOLDER}>{props.label}</span>}
      {renderDynamic(props.children || trigger.label || props.placeholder, trigger)}
      <ArrowDown className={AUI_CLASS.SELECT_CARET} aria-hidden="true" />
    </button>
  );
}, 'SelectTrigger');

export const SelectPanel = setup<SelectPanelProps>((props) => {
  const styles = selectScope.inherit(props);
  const panel = aria(SELECT_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.PANEL, AUI_CLASS.SELECT_PANEL], styles, auiConfig.selectPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'SelectPanel');

export const SelectOption = setup<SelectOptionProps>((props) => {
  const styles = selectScope.inherit(props);
  const option = aria(SELECT_OPTION_ROLE, props);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.SELECT_OPTION], styles, auiConfig.selectOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
      {option.selected && <CheckIcon />}
    </div>
  );
}, 'SelectOption');
