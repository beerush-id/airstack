import type { OptionAria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { $bind, type AnyType, type Bindable, For, mutable, Slot, setup } from '@airlib/react';
import { derived } from '@airlib/react/core';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, type FieldStyles } from '../config.js';
import { type OptionEntry, type OptionsInput, toOptions } from '../utils/common.js';
import { Chip } from '../widgets/Chip.js';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxPanel } from './Combobox.js';

export type TagInputSlots = {
  /** Content of each chosen value's chip. */
  chip: (entry: OptionEntry) => ReactNode;
  /** Content of each row in the list. */
  option: (entry: OptionEntry, option: OptionAria) => ReactNode;
};

export type TagInputProps = FieldStyles & {
  id?: string;
  /** The chosen tokens. */
  value?: Bindable<string[]>;
  /** The choices: entries, or a token-to-text map — the same shape Select and Combobox take. */
  options?: OptionsInput;
  /** Accessible name of the field. */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Accessible name of each chip's remove button, built from the chip's text, e.g. `(text) => \`Remove ${text}\``. */
  removeLabel?: (text: string) => string;
  onchange?: (event: CustomEvent<string[]>) => void;
};

const TAG_INPUT = branded('tag-input');
const TAG_INPUT_FIELD = branded('tag-input-field');
const TAG_INPUT_QUERY = branded('tag-input-query');
const TAG_INPUT_PANEL = branded('tag-input-panel');

register('tagInput', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.FILLED });

/**
 * Several values from a list, typed and picked like a combobox and shown as
 * removable chips inside the field. Picking an option adds it, picking it
 * again or removing its chip takes it out; the list stays open while you pick.
 */
export const TagInput = setup<TagInputProps, TagInputSlots>((props, slots) => {
  const state = mutable({ query: '' });
  const entries = derived(() => toOptions(props.options));
  const matches = derived(() => {
    const q = state.query.trim().toLowerCase();
    return entries.value.filter(({ key, label }) => key.toLowerCase().includes(q) || label?.toLowerCase().includes(q));
  });
  const styles = (): ComponentStyles => ({ size: props.size, color: props.color, variant: props.variant });
  const fieldClass = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, TAG_INPUT_FIELD], styles(), auiConfig.tagInput);
  const entryOf = (key: string): OptionEntry => entries.value.find((entry) => entry.key === key) ?? { key };
  const remove = (key: string) => {
    props.value = (props.value ?? []).filter((token) => token !== key);
  };

  return () => (
    <Combobox
      id={props.id}
      multiple
      value={$bind(props, 'value') as AnyType}
      query={$bind(state, 'query')}
      disabled={props.disabled}
      required={props.required}
      size={props.size}
      color={props.color}
      variant={props.variant}
      className={TAG_INPUT}
      onchange={props.onchange as AnyType}
    >
      <div className={fieldClass()}>
        <For each={() => props.value ?? []}>
          {(key) => {
            const entry = entryOf(key);
            const text = entry.label ?? entry.key;

            return (
              <Chip
                removable
                size={props.size}
                color={props.color}
                disabled={props.disabled}
                removeLabel={props.removeLabel?.(text)}
                onremove={() => remove(key)}
              >
                <Slot for={() => slots.chip?.(entry)}>{text}</Slot>
              </Chip>
            );
          }}
        </For>
        {/* The chips show what's chosen, so the field holds only what's being typed; the list lines up with the whole field. */}
        <ComboboxInput label={props.label} echo={false} anchor="parent">
          {(input) => (
            <input
              ref={input.ref}
              {...input.props}
              placeholder={props.value?.length ? undefined : props.placeholder}
              className={TAG_INPUT_QUERY}
            />
          )}
        </ComboboxInput>
      </div>
      <ComboboxPanel className={TAG_INPUT_PANEL}>
        <For each={() => matches.value}>
          {(entry) => (
            <ComboboxOption value={entry.key}>
              {(option) => <Slot for={() => slots.option?.(entry, option)}>{entry.label ?? entry.key}</Slot>}
            </ComboboxOption>
          )}
        </For>
      </ComboboxPanel>
    </Combobox>
  );
}, 'TagInput');
