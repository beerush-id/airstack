import type { ComponentStyles } from '@airlib/aui/utils';
import { createContext } from '@airlib/react';

/** One row of an `items` shorthand: `name` is the token the composite reports, `label` what it shows. */
export type ItemEntry = { name: string; label?: string; disabled?: boolean };

/** The `items` shorthand a composite accepts: full entries, or a name-to-label map. */
export type ItemsInput = Array<ItemEntry> | Record<string, string>;

/**
 * Normalizes the `items` shorthand of a composite (menu, tabs, ...) into entries.
 *
 * @param {ItemsInput | undefined} items - Entries, or a name-to-label map.
 * @returns {ItemEntry[]} One entry per item, in the given order.
 */
export function toEntries(items?: ItemsInput): ItemEntry[] {
  if (Array.isArray(items)) return items;
  return Object.entries(items ?? {}).map(([name, label]) => ({ name, label }));
}

/**
 * Whether a composite received the `items` shorthand and should render its own parts.
 *
 * @param {unknown} items - The `items` prop as given.
 * @returns {boolean} `true` for an entry array or a name-to-label map.
 */
export function hasEntries(items: unknown): items is ItemsInput {
  return Array.isArray(items) || (typeof items === 'object' && items !== null);
}

/** One destination of a `links` shorthand (navigation, breadcrumb). */
export type LinkEntry = { href: string; label: string; current?: boolean; disabled?: boolean };

/** One choice of an `options` shorthand: `key` is the committed token, `label` what it shows. */
export type OptionEntry = { key: string; label?: string };

/** The `options` shorthand a picker accepts: full entries, or a token-to-text map. */
export type OptionsInput = Array<OptionEntry> | Record<string, string | number | undefined>;

/**
 * Normalizes the `options` shorthand of a picker (select, combobox, listbox) into entries.
 *
 * @param {OptionsInput | undefined} options - Entries, or a token-to-text map.
 * @returns {OptionEntry[]} One entry per choice, labels stringified.
 */
export function toOptions(options?: OptionsInput): OptionEntry[] {
  if (Array.isArray(options)) return options;
  return Object.entries(options ?? {}).map(([key, label]) => ({ key, label: label === undefined ? undefined : String(label) }));
}

export type StyleScope<T extends ComponentStyles = ComponentStyles> = {
  provide: (props: T) => void;
  get: () => T | undefined;
  inherit: (props: ComponentStyles) => ComponentStyles;
};

/**
 * Ambient style scope for a compound component: the root publishes its own
 * `size`, `color`, and `variant`, and every part falls back to them, so a
 * caller styles the whole composite once on the root.
 *
 * Precedence, highest first: the part's own prop, the nearest root's prop,
 * the part's configured default, the built-in default. The last two are
 * applied by `$families` from the part's registered styles.
 *
 * @returns {StyleScope<T>} `provide` for the root's `setup()` body, `get` and `inherit` for a part's.
 */
export function createStyleScope<T extends ComponentStyles = ComponentStyles>(): StyleScope<T> {
  const ctx = createContext<T>();

  return {
    provide(props) {
      ctx.set(props);
    },
    get() {
      return ctx.get();
    },
    inherit(props) {
      const root = ctx.get();

      // Getters keep both sides live: a root re-styled later re-styles its parts.
      return {
        get size() {
          return props.size ?? root?.size;
        },
        get color() {
          return props.color ?? root?.color;
        },
        get variant() {
          return props.variant ?? root?.variant;
        },
        get className() {
          return props.className;
        },
      };
    },
  };
}
