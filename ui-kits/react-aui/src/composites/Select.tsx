import { aria, OptionAria, type SelectAria, SelectPanelAria, SelectTriggerAria } from '@airlib/aria';
import { COLORS, MAUI_CLASS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, setup, shadowPortal, Slot } from '@airlib/react';
import { isObjectLike } from '@airlib/react/core';
import type { ReactNode } from 'react';
import { $class, auiConfig, type AuiPrimitive, type AuiProps, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type SelectValue = AuiPrimitive | AuiPrimitive[];

export type SelectSlots = {
  button: (value?: AuiPrimitive | AuiPrimitive[]) => ReactNode;
  option: (key: string, value: AuiPrimitive) => ReactNode;
};

export type SelectProps = AuiProps<'div'> & {
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
const SELECT_OPTION_CLASS = 'select-option';

const selectStyles: ComponentStyles = {
  size: SIZES.LG,
  color: COLORS.PRIMARY,
  variant: VARIANTS.OUTLINED,
  className: [MAUI_CLASS.SELECT],
};

register('select', selectStyles);
register('selectTrigger', { className: [MAUI_CLASS.ACTION, MAUI_CLASS.SELECT_TRIGGER] });
register('selectPanel', { className: [MAUI_CLASS.SELECT_PANEL] });
register('selectOption', { className: [MAUI_CLASS.SELECT_OPTION] });

export const Select = setup<SelectProps, SelectSlots>((props, slots) => {
  const select = aria(SELECT_ROLE, props as AnyType);
  const className = () => $class(SELECT_ROLE, props, auiConfig.select);

  return () => {
    if (isObjectLike(props.options)) {
      return (
        <div ref={select.ref} {...select.restProps(OMIT_KEYS)} className={className()}>
          <Slot for={() => slots.button?.(select.value)}>
            <SelectTrigger label={props.label} placeholder={props.placeholder} />
          </Slot>
          <SelectPanel>
            <For each={() => Object.entries(props.options!)}>
              {([key, value]) => (
                <Slot for={() => slots.option?.(key, value)}>
                  <SelectOption value={key}>{value}</SelectOption>
                </Slot>
              )}
            </For>
          </SelectPanel>
        </div>
      );
    }

    return (
      <div ref={select.ref} {...select.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, select)}
      </div>
    );
  };
}, 'Select');

export const SelectTrigger = setup<SelectTriggerProps>((props) => {
  const trigger = aria(SELECT_TRIGGER_ROLE, props);
  const className = () => $class(SELECT_TRIGGER_ROLE, props, auiConfig.selectTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.label && <span className={MAUI_CLASS.SELECT_PLACEHOLDER}>{props.label}</span>}
      {renderDynamic(props.children || trigger.label || props.placeholder, trigger)}
      <span className={MAUI_CLASS.SELECT_CARET} aria-hidden="true" />
    </button>
  );
}, 'SelectTrigger');

export const SelectPanel = setup<SelectPanelProps>((props) => {
  const panel = aria(SELECT_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $class(SELECT_PANEL_ROLE, props, auiConfig.selectPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'SelectPanel');

export const SelectOption = setup<SelectOptionProps>((props) => {
  const option = aria(SELECT_OPTION_ROLE, props);
  const className = () => $class(SELECT_OPTION_CLASS, props, auiConfig.selectOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
    </div>
  );
}, 'SelectOption');
