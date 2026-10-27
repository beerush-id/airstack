import { aria, type ListboxAria, type OptionAria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, createContext, For, renderDynamic, Slot, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type AuiPrimitive, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CheckIcon } from '../icons/index.js';
import { createStyleScope, hasEntries, type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';
import { type PickModeProps, pickModes } from './pick-modes.js';

export type ListboxValue = AuiPrimitive | AuiPrimitive[] | null;

export type ListboxSlots = {
  option: (entry: OptionEntry, option: OptionAria) => ReactNode;
};

export type ListboxProps = ComponentStyles & {
  id?: string;
  label?: string;
  value?: Bindable<ListboxValue>;
  /** Whether several rows are picked at once. With `checkable`, the listbox switches it itself; bind it to follow. */
  multiple?: Bindable<boolean>;
  /**
   * Puts a check at the start of each row, as file browsers do. A click picks one row, without a
   * check; checking a row, or Ctrl/Cmd- or Shift-clicking one, switches to picking several,
   * carrying the picked row along. Then a click checks or unchecks, and Shift-click checks a
   * range. Unchecking the last row, Escape, or pressing the listbox's background switches back to
   * picking one, with none picked.
   */
  checkable?: boolean;
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
/** The listbox its rows belong to, for whether they carry a leading check. */
const listboxCtx = createContext<ListboxProps>();
const CHECK_CLASS = branded('listbox-check');

/**
 * Always-visible option list. With `options` it renders one row per entry;
 * the `option` slot refines each row's content.
 */
export const Listbox = setup<ListboxProps, ListboxSlots>((props, slots) => {
  const listbox = aria(LISTBOX_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.LISTBOX, { className: props.className }, auiConfig.listbox);

  listboxScope.provide(props);
  listboxCtx.set(props);

  const modes = pickModes(props as PickModeProps, `.${CHECK_CLASS}`);

  return () => (
    <div
      ref={listbox.ref}
      {...listbox.restProps([...OMIT_KEYS, 'options', 'checkable'])}
      className={className()}
      {...modes}
    >
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

/**
 * One row. A picked row ends with a check; in a `checkable` listbox the check leads the row
 * instead, an empty circle until the row is checked while several are picked.
 */
export const ListboxOption = setup<ListboxOptionProps>((props) => {
  const styles = listboxScope.inherit(props);
  const listbox = listboxCtx.get();
  const option = aria(OPTION_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.ITEM, AUI_CLASS.LISTBOX_OPTION], styles, auiConfig.listboxOption);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {listbox?.checkable && (
        <span
          className={CHECK_CLASS}
          aria-hidden="true"
          data-checked={listbox.multiple && option.selected ? 'true' : undefined}
        >
          <CheckIcon />
        </span>
      )}
      {renderDynamic(props.children, option)}
      {!listbox?.checkable && option.selected && <CheckIcon />}
    </div>
  );
}, 'ListboxOption');
