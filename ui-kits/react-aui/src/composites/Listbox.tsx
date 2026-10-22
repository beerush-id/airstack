import { aria, type ListboxAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type ListboxValue = AuiPrimitive | AuiPrimitive[] | null;

export type ListboxProps = ComponentStyles & {
  id?: string;
  label?: string;
  value?: Bindable<ListboxValue>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  children?: ReactNode | ((instance: ListboxAria) => ReactNode);
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<string | string[]>) => void;
};

export type ListboxOptionProps = ComponentStyles & {
  value: string;
  selected?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode | ((option: OptionAria) => ReactNode);
  onchange?: (event: CustomEvent<boolean>) => void;
};

const LISTBOX_ROLE = 'listbox';
const OPTION_ROLE = 'option';

register('listbox', {});
register('listboxOption', {});

export const Listbox = setup<ListboxProps>((props) => {
  const listbox = aria(LISTBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.LISTBOX, props, auiConfig.listbox);

  return () => (
    <div ref={listbox.ref} {...listbox.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, listbox)}
    </div>
  );
}, 'Listbox');

export const ListboxOption = setup<ListboxOptionProps>((props) => {
  const option = aria(OPTION_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.LISTBOX_OPTION, props, auiConfig.listboxOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
    </div>
  );
}, 'ListboxOption');
