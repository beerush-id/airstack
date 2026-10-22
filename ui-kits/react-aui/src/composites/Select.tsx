import { aria, type OptionAria, type SelectAria, type SelectPanelAria, type SelectTriggerAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, setup, shadowPortal, Slot } from '@airlib/react';
import { isObjectLike } from '@airlib/react/core';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowDown } from '../icons/index.js';

export type SelectValue = AuiPrimitive | AuiPrimitive[];

export type SelectSlots = {
  option: (key: string, value: AuiPrimitive) => ReactNode;
  trigger: (value?: AuiPrimitive | AuiPrimitive[]) => ReactNode;
};

export type SelectProps = ComponentStyles & {
  open?: Bindable<boolean>;
  value?: Bindable<SelectValue>;
  label?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;

  options?: Record<string, AuiPrimitive>;
  children?: ReactNode | ((instance: SelectAria) => ReactNode);

  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  oninput?: (event: CustomEvent<string | undefined>) => void;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
};

export type SelectTriggerProps = AuiProps<'button'> & {
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

export const Select = setup<SelectProps, SelectSlots>((props, slots) => {
  const select = aria(SELECT_ROLE, props as AnyType);

  return () => {
    if (isObjectLike(props.options)) {
      return (
        <>
          <SelectTrigger
            size={props.size}
            color={props.color}
            variant={props.variant}
            label={props.label}
            placeholder={props.placeholder}
          >
            <Slot for={() => slots.trigger?.(select.value)}>{select.label || props.placeholder}</Slot>
          </SelectTrigger>
          <SelectPanel size={props.size} color={props.color} variant={props.variant}>
            <For each={() => Object.entries(props.options!)}>
              {([key, value]) => (
                <SelectOption size={props.size} color={props.color} variant={props.variant} value={key}>
                  <Slot for={() => slots.option?.(key, value)}>{value}</Slot>
                </SelectOption>
              )}
            </For>
          </SelectPanel>
        </>
      );
    }

    const className = () => $families(AUI_CLASS.SELECT, props, auiConfig.select);
    return (
      <div ref={select.ref} {...select.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, select)}
      </div>
    );
  };
}, 'Select');

export const SelectTrigger = setup<SelectTriggerProps>((props) => {
  const trigger = aria(SELECT_TRIGGER_ROLE, props);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.SELECT_TRIGGER], props, auiConfig.selectTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.label && <span className={AUI_CLASS.SELECT_PLACEHOLDER}>{props.label}</span>}
      {renderDynamic(props.children || trigger.label || props.placeholder, trigger)}
      <ArrowDown className={AUI_CLASS.SELECT_CARET} aria-hidden="true" />
    </button>
  );
}, 'SelectTrigger');

export const SelectPanel = setup<SelectPanelProps>((props) => {
  const panel = aria(SELECT_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.MENU_PANEL, AUI_CLASS.SELECT_PANEL], props, auiConfig.selectPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'SelectPanel');

export const SelectOption = setup<SelectOptionProps>((props) => {
  const option = aria(SELECT_OPTION_ROLE, props);
  const className = () => $families([AUI_CLASS.MENU_ITEM, AUI_CLASS.SELECT_OPTION], props, auiConfig.selectOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
    </div>
  );
}, 'SelectOption');
