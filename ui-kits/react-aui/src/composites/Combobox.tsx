import { aria, type ComboboxAria, type ComboboxInputAria, type ComboboxPanelAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup, shadowPortal } from '@airlib/react';
import { derived, isObjectLike } from '@airlib/react/core';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { $families, type AuiPrimitive, type AuiProps, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon } from '../icons/Check.js';

export type ComboboxValue = AuiPrimitive | AuiPrimitive[];
export type ComboboxRef = {
  ref: RefObject<HTMLInputElement>;
  input: ComboboxInputAria;
  props: ComponentProps<'input'>;
  className: string;
};
export type ComboboxItem = { key: string; label?: string };

export type ComboboxSlots = {
  input: (value: AuiPrimitive | AuiPrimitive[] | undefined, input: ComboboxRef) => ReactNode;
  option: (item: ComboboxItem, option: OptionAria) => ReactNode;
};

export type ComboboxProps = ComponentStyles & {
  id?: string;
  query?: Bindable<string>;
  open?: Bindable<boolean>;
  value?: Bindable<ComboboxValue>;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;

  options?: Array<ComboboxItem> | Record<string, AuiPrimitive>;
  children?: ReactNode | ((instance: ComboboxAria) => ReactNode);

  onopen?: (event: CustomEvent<boolean>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
  oninput?: (event: CustomEvent<string | undefined>) => void;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
};

export type ComboboxInputProps = AuiProps<'input'> & {
  id?: string;
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

register('combobox', {});
register('comboboxInput', {});
register('comboboxPanel', {});
register('comboboxOption', {});

export const Combobox = setup<ComboboxProps, ComboboxSlots>((props, slots) => {
  const combobox = aria(COMBOBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.COMBOBOX, props, auiConfig.combobox);

  const options = derived(() => {
    if (!Array.isArray(props.options) && !isObjectLike(props.options)) return [];

    const q = (props.query ?? '').toLocaleLowerCase();
    const items = Array.isArray(props.options)
      ? (props.options as Array<ComboboxItem>)
      : Object.entries(props.options).map(([key, label]) => ({ key, label: String(label) }) as ComboboxItem);

    return items.filter(({ key, label }) => {
      return key.toLowerCase().includes(q) || label?.toLowerCase().includes(q);
    });
  });

  return () => {
    if (Array.isArray(props.options) || isObjectLike(props.options)) {
      return (
        <>
          <ComboboxInput size={props.size} placeholder={props.placeholder}>
            {(input) => (
              <Slot for={() => slots.input?.(combobox.value as AuiPrimitive, input)}>
                <input ref={input.ref} {...input.props} className={input.className} />
              </Slot>
            )}
          </ComboboxInput>
          <ComboboxPanel size={props.size}>
            <For each={() => options.value}>
              {(item) => (
                <ComboboxOption size={props.size} value={item.key}>
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
  const input = aria(COMBOBOX_INPUT_ROLE, props);
  const className = () => $families([AUI_CLASS.TEXT_INPUT, AUI_CLASS.COMBOBOX_INPUT], props, auiConfig.comboboxInput);

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
  const panel = aria(COMBOBOX_PANEL_ROLE, props);
  const shadow = shadowPortal(() => panel.open);
  const className = () => $families([AUI_CLASS.MENU_PANEL, AUI_CLASS.COMBOBOX_PANEL], props, auiConfig.comboboxPanel);

  return () =>
    shadow(
      <div ref={panel.ref} {...panel.restProps(OMIT_KEYS)} className={className()}>
        {renderDynamic(props.children, panel)}
      </div>
    );
}, 'ComboboxPanel');

export const ComboboxOption = setup<ComboboxOptionProps>((props) => {
  const option = aria(OPTION_ROLE, props);
  const className = () => $families([AUI_CLASS.MENU_ITEM, AUI_CLASS.COMBOBOX_OPTION], props, auiConfig.comboboxOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
      {option.selected && <CheckIcon />}
    </div>
  );
}, 'ComboboxOption');
