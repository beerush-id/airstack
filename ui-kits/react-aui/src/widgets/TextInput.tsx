import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type Bindable, setup } from '@airlib/react';
import type { ComponentProps } from 'react';
import { $families, auiConfig, FIELD_STYLES, type FieldStyles, OMIT_KEYS } from '../config.js';

export type TextInputKind = 'text' | 'password' | 'search' | 'email' | 'tel' | 'url';

export interface TextInputProps extends Omit<ComponentProps<'input'>, 'className' | 'color' | 'value' | 'size'>,
  FieldStyles {
  value?: Bindable<string>;
  kind?: TextInputKind;
  /** Takes several lines, wrapping as it goes: a reply, a note, a description. */
  multiline?: boolean;
  /** How many lines a multiline field shows before it scrolls. */
  rows?: number;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean | 'grammar' | 'spelling';
  placeholder?: string;
  label?: string;
  onchange?: (event: CustomEvent<string>) => void;
}

export type SearchInputProps = TextInputProps;

const TEXT_INPUT_ROLE = 'text-input';
const SEARCH_INPUT_ROLE = 'search-input';

register('textInput', { ...FIELD_STYLES });
register('searchInput', { ...FIELD_STYLES });

/**
 * Live string on a native input, or a text area when `multiline`. Typing
 * copies into props without rewriting the element, so the caret stays where
 * the user put it.
 */
export const TextInput = setup<TextInputProps>((props) => {
  const input = aria(TEXT_INPUT_ROLE, props);
  const multiline = $static(() => !!props.multiline);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.TEXT_INPUT], props, auiConfig.textInput);
  const omit = [...OMIT_KEYS, 'kind', 'multiline', 'readonly', 'disabled', 'required', 'invalid', 'label', 'value', 'onchange'];

  return () =>
    multiline ? (
      <textarea ref={input.ref as never} {...input.restProps([...omit, 'rows'] as never)} rows={props.rows ?? 3} className={className()} />
    ) : (
      <input ref={input.ref} {...input.restProps(omit as never)} className={className()} />
    );
}, 'TextInput');

/**
 * Same live string with the searchbox role and search type.
 */
export const SearchInput = setup<SearchInputProps>((props) => {
  const input = aria(SEARCH_INPUT_ROLE, props);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.SEARCH_INPUT], props, auiConfig.searchInput);

  return () => (
    <input ref={input.ref} {...input.restProps([...OMIT_KEYS, 'kind', 'multiline', 'readonly', 'disabled', 'required', 'invalid', 'label', 'value', 'onchange'])} className={className()} />
  );
}, 'SearchInput');
