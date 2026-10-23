import { aria, type ComboboxAria, type ComboboxInputAria, type ComboboxPanelAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup, shadowPortal } from '@airlib/react';
import { derived } from '@airlib/react/core';
import type { ComponentProps, ReactNode, RefObject } from 'react';
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
import { CheckIcon } from '../icons/Check.js';
import { createStyleScope, hasEntries, type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';

export type ComboboxValue = AuiPrimitive | AuiPrimitive[];
export type ComboboxRef = {
  ref: RefObject<HTMLInputElement>;
  input: ComboboxInputAria;
  props: ComponentProps<'input'>;
  className: string;
};
export type ComboboxItem = OptionEntry;

export type ComboboxSlots = {
  input: (value: AuiPrimitive | AuiPrimitive[] | undefined, input: ComboboxRef) => ReactNode;
  option: (item: ComboboxItem, option: OptionAria) => ReactNode;
};

export type ComboboxProps = FieldStyles & {
  id?: string;
  query?: Bindable<string>;
  open?: Bindable<boolean>;
  value?: Bindable<ComboboxValue>;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;

  options?: OptionsInput;
  children?: ReactNode | ((instance: ComboboxAria) => ReactNode);

  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  oninput?: (event: CustomEvent<string | undefined>) => void;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
};

export type ComboboxInputProps = AuiFieldProps<'input'> & {
  id?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  children?: (input: ComboboxRef) => ReactNode;
};

export type ComboboxPanelProps = AuiProps<'div'> & {
  id?: string;
  children?: ReactNode | ((panel: ComboboxPanelAria) => ReactNode);
};

export type ComboboxOptionProps = AuiProps<'div'> & {
  value: string;
  disabled?: boolean;
  children?: ReactNode | ((option: OptionAria) => ReactNode);
};

const COMBOBOX_ROLE = 'combobox';
const COMBOBOX_INPUT_ROLE = 'combobox-input';
const COMBOBOX_PANEL_ROLE = 'combobox-panel';
const OPTION_ROLE = 'option';

const comboboxStyles: ComponentStyles = {
  size: SIZES.MD,
  color: COLORS.PRIMARY,
  variant: VARIANTS.FILLED,
};

register('combobox', comboboxStyles);
register('comboboxInput', comboboxStyles);
register('comboboxPanel', comboboxStyles);
register('comboboxOption', comboboxStyles);

const comboboxScope = createStyleScope<ComboboxProps>();

export const Combobox = setup<ComboboxProps, ComboboxSlots>((props, slots) => {
  const combobox = aria(COMBOBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.COMBOBOX, props as ComponentStyles, auiConfig.combobox);

  comboboxScope.provide(props);

  const options = derived(() => {
    const q = (props.query ?? '').toLocaleLowerCase();

    return toOptions(props.options).filter(({ key, label }) => {
      return key.toLowerCase().includes(q) || label?.toLowerCase().includes(q);
    });
  });

  return () => {
    if (hasEntries(props.options)) {
      return (
        <>
          <ComboboxInput label={props.label} placeholder={props.placeholder}>
            {(input) => (
              <Slot for={() => slots.input?.(combobox.value as AuiPrimitive, input)}>
                <input ref={input.ref} {...input.props} className={input.className} />
              </Slot>
            )}
          </ComboboxInput>
          <ComboboxPanel>
            <For each={() => options.value}>
              {(item) => (
                <ComboboxOption value={item.key}>
                  {(option) => <Slot for={() => slots.option?.(item, option)}>{item.label || item.key}</Slot>}
                </ComboboxOption>
              )}
            </For>
          </ComboboxPanel>
        </>
      );
    }

    return (
      <div ref={combobox.ref} {...combobox.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, combobox)}
      </div>
    );
  };
}, 'Combobox');

export const ComboboxInput = setup<ComboboxInputProps>((props) => {
  const styles = comboboxScope.inherit(props as ComponentStyles);
  const input = aria(COMBOBOX_INPUT_ROLE, props);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.COMBOBOX_INPUT], styles, auiConfig.comboboxInput);

  return () => {
    if (props.children) {
      return renderDynamic(props.children, {
        ref: input.ref,
        input,
        props: input.restProps(OMIT_KEYS),
        className: className(),
      });
    }

    return <input ref={input.ref} {...input.restProps(OMIT_KEYS)} className={className()} />;
  };
}, 'ComboboxInput');

export const ComboboxPanel = setup<ComboboxPanelProps>((props) => {
  const styles = comboboxScope.inherit(props);
  const panel = aria(COMBOBOX_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.PANEL, AUI_CLASS.COMBOBOX_PANEL], styles, auiConfig.comboboxPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'ComboboxPanel');

export const ComboboxOption = setup<ComboboxOptionProps>((props) => {
  const styles = comboboxScope.inherit(props);
  const option = aria(OPTION_ROLE, props);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.COMBOBOX_OPTION], styles, auiConfig.comboboxOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
      {option.selected && <CheckIcon />}
    </div>
  );
}, 'ComboboxOption');
