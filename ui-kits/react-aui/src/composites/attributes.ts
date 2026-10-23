import type { AnyType } from '@airlib/react';

const TAB_INDEX_KEY = 'tabindex';

const INPUT_ATTRIBUTE_NAMES: Record<string, string> = {
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  inputmode: 'inputMode',
  autocomplete: 'autoComplete',
};

/**
 * The controller emits the HTML attribute spelling, which React rejects on a
 * native host. Rename it so the tab stop survives without a warning.
 */
export function withTabIndex(attrs: Record<string, unknown> & { tabindex?: number }): AnyType {
  const { [TAB_INDEX_KEY]: tabIndex, ...rest } = attrs;

  return { ...rest, tabIndex };
}

/**
 * Renames the attribute spellings a native input controller emits into the
 * props React expects, leaving every other key untouched.
 */
export function withInputAttributes(attrs: Record<string, unknown>): AnyType {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attrs)) {
    result[INPUT_ATTRIBUTE_NAMES[key] ?? key] = value;
  }

  return result;
}
