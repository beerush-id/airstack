import { aria, type ListboxAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon } from '../icons/index.js';
import { createStyleScope, hasEntries, type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';

export type ListboxValue = AuiPrimitive | AuiPrimitive[] | null;

export type ListboxSlots = {
  option: (entry: OptionEntry, option: OptionAria) => ReactNode;
};

export type ListboxProps = ComponentStyles & {
  id?: string;
  label?: string;
  value?: Bindable<ListboxValue>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  options?: OptionsInput;
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
register('listboxOption', { size: SIZES.MD, color: COLORS.PRIMARY });

const listboxScope = createStyleScope();

/**
 * Always-visible option list. With `options` it renders one row per entry;
 * the `option` slot refines each row's content.
 */
export const Listbox = setup<ListboxProps, ListboxSlots>((props, slots) => {
  const listbox = aria(LISTBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.LISTBOX, { className: props.className }, auiConfig.listbox);

  listboxScope.provide(props);

  return () => (
    <div ref={listbox.ref} {...listbox.restProps([...OMIT_KEYS, 'options'])} className={className()}>
      {hasEntries(props.options) ? (
        <For each={() => toOptions(props.options)}>
          {(entry) => (
            <ListboxOption value={entry.key}>
              {(option) => <Slot for={() => slots.option?.(entry, option)}>{entry.label ?? entry.key}</Slot>}
            </ListboxOption>
          )}
        </For>
      ) : (
        renderDynamic(props.children, listbox)
      )}
    </div>
  );
}, 'Listbox');

export const ListboxOption = setup<ListboxOptionProps>((props) => {
  const styles = listboxScope.inherit(props);
  const option = aria(OPTION_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.LISTBOX_OPTION], styles, auiConfig.listboxOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, option)}
      {option.selected && <CheckIcon />}
    </div>
  );
}, 'ListboxOption');
