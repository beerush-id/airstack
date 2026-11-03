import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { $bind, type AnyType, type Bindable, effect, For, mutable, Show, Slot, setup } from '@airlib/react';
import { LIVE_KEYBOARD } from '@airlib/react/browser';
import { derived } from '@airlib/react/core';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, FIELD_STYLES, OMIT_KEYS } from '../config.js';
import { createStyleScope, type ItemEntry } from '../utils/common.js';
import { Dialog, DialogPanel, DialogTitle, DialogTrigger } from './Dialog.js';

/** One command: `name` is what `oncommand` receives; `group` heads a section, `hint` shows a shortcut, `keywords` widen the match. */
export type CommandEntry = ItemEntry & { group?: string; hint?: string; keywords?: string };

export type CommandPaletteSlots = {
  trigger: () => ReactNode;
  item: (entry: CommandEntry) => ReactNode;
  empty: (query: string) => ReactNode;
};

export type CommandPaletteProps = ComponentStyles & {
  open?: Bindable<boolean>;
  label?: string;
  /** The palette's accessible name, read when it opens; not shown. */
  title: string;
  placeholder?: string;
  shortcut?: boolean;
  items?: CommandEntry[];
  oncommand?: (event: CustomEvent<string>) => void;
};

type CommandSearchProps = {
  query?: Bindable<string>;
  value?: Bindable<string | undefined>;
  text?: Bindable<string>;
  open?: Bindable<boolean>;
  children?: ReactNode;
  onchange?: (event: CustomEvent<string | string[] | undefined>) => void;
  onclose?: (event: CustomEvent<boolean>) => void;
};

type CommandInputProps = { placeholder?: string; label?: string };
type CommandListProps = { children?: ReactNode };
type CommandRowProps = { value: string; disabled?: boolean; children?: ReactNode };

const PANEL_CLASS = 'aui-command-palette';
const TITLE_CLASS = 'aui-command-palette-title';
const SEARCH_CLASS = 'aui-command-palette-search';
const LIST_CLASS = 'aui-command-palette-list';
const GROUP_CLASS = 'aui-command-palette-group';
const GROUP_LABEL_CLASS = 'aui-command-palette-group-label';
const ITEM_CLASS = 'aui-command-palette-item';
const EMPTY_CLASS = 'aui-command-palette-empty';
const SEARCH_OMIT = [...OMIT_KEYS, 'query', 'value', 'open'];

register('commandPalette', { size: SIZES.MD, color: COLORS.PRIMARY });
register('commandPaletteInput', { ...FIELD_STYLES });
register('commandPaletteItem', { size: SIZES.MD, color: COLORS.PRIMARY });

const paletteScope = createStyleScope();

/** Whether a command answers the typed filter: its label, name, or keywords contain it. */
function matches(entry: CommandEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [entry.label, entry.name, entry.keywords].some((text) => text?.toLowerCase().includes(q));
}

/** Groups commands by `group`, keeping the order in which each group first appears. */
function toGroups(entries: CommandEntry[]): Array<{ name?: string; entries: CommandEntry[] }> {
  const groups = new Map<string | undefined, CommandEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }
  return [...groups].map(([name, list]) => ({ name, entries: list }));
}

/**
 * Search actions from the keyboard: a modal sheet with a filter field over a
 * list of commands. `Ctrl`/`⌘` + `K` opens it (turn off with
 * `shortcut={false}`), `label` adds a trigger button, typing narrows the list,
 * the arrows move, and `Enter` or a click runs the command through
 * `oncommand` and closes the sheet.
 */
export const CommandPalette = setup<CommandPaletteProps, CommandPaletteSlots>((props, slots) => {
  const state = mutable({ query: '', value: undefined as string | undefined, text: '', list: true });
  const groups = derived(() => toGroups((props.items ?? []).filter((entry) => matches(entry, state.query))));

  paletteScope.provide(props);

  effect(() => {
    if (props.shortcut === false) return;
    if (LIVE_KEYBOARD.is('meta', 'k') || LIVE_KEYBOARD.is('ctrl', 'k')) {
      props.open = true;
    }
  });

  // Leaving the field (Escape, Tab, a commit) ends the whole palette, ready for the next opening.
  const close = () => {
    props.open = false;
    state.list = true;
    state.query = '';
    state.value = undefined;
    state.text = '';
  };

  const run = (event: CustomEvent<string | string[] | undefined>) => {
    if (typeof event.detail === 'string') {
      props.oncommand?.(new CustomEvent('command', { detail: event.detail }));
    }
    close();
  };

  return () => (
    <Dialog open={$bind(props, 'open')} modality="modal" size={props.size} color={props.color} variant={props.variant}>
      {props.label && (
        <DialogTrigger>
          <Slot for={() => slots.trigger?.()}>{props.label}</Slot>
        </DialogTrigger>
      )}
      <DialogPanel className={PANEL_CLASS}>
        <DialogTitle className={TITLE_CLASS}>{props.title}</DialogTitle>
        <CommandSearch
          query={$bind(state, 'query')}
          value={$bind(state, 'value')}
          text={$bind(state, 'text')}
          open={$bind(state, 'list')}
          onchange={run}
          onclose={close}
        >
          <CommandInput placeholder={props.placeholder} label={props.title} />
          <CommandList>
            <For each={() => groups.value}>
              {(group) => (
                <div className={GROUP_CLASS} role="group" aria-label={group.name}>
                  {group.name && (
                    <div className={GROUP_LABEL_CLASS} aria-hidden="true">
                      {group.name}
                    </div>
                  )}
                  <For each={() => group.entries}>
                    {(entry) => (
                      <CommandRow value={entry.name} disabled={entry.disabled}>
                        <Slot for={() => slots.item?.(entry)}>
                          <span>{entry.label ?? entry.name}</span>
                          {entry.hint && <kbd className={AUI_CLASS.ITEM_HINT} data-hint={entry.hint} />}
                        </Slot>
                      </CommandRow>
                    )}
                  </For>
                </div>
              )}
            </For>
            {/* Its own boundary: reading the matches here would re-render the palette on every keystroke. */}
            <Show when={() => groups.value.length === 0 && slots.empty}>
              {() => <div className={EMPTY_CLASS}>{slots.empty?.(state.query)}</div>}
            </Show>
          </CommandList>
        </CommandSearch>
      </DialogPanel>
    </Dialog>
  );
}, 'CommandPalette');

/** The filter's coordinator: holds the query, the cursor, and the committed command. */
const CommandSearch = setup<CommandSearchProps>((props) => {
  const search = aria('combobox', props as AnyType);

  return () => (
    <div ref={search.ref} {...search.restProps(SEARCH_OMIT)} className={SEARCH_CLASS}>
      {props.children}
    </div>
  );
}, 'CommandSearch');

/** The filter field; it wears the shared field look at the palette's size and color. */
const CommandInput = setup<CommandInputProps>((props) => {
  const styles = paletteScope.inherit({});
  const input = aria('combobox-input', props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, `${PANEL_CLASS}-input`], styles, auiConfig.commandPaletteInput);

  return () => <input ref={input.ref} {...input.restProps(OMIT_KEYS)} className={className()} />;
}, 'CommandInput');

/** The command list, laid out in place under the field rather than floating. */
const CommandList = setup<CommandListProps>((props) => {
  const list = aria('combobox-panel', props as AnyType);

  return () => (
    <div ref={list.ref} {...list.restProps(OMIT_KEYS)} className={LIST_CLASS}>
      {props.children}
    </div>
  );
}, 'CommandList');

/** One command row on the shared item scale. */
const CommandRow = setup<CommandRowProps>((props) => {
  const styles = paletteScope.inherit({});
  const option = aria('option', props as AnyType);
  const className = () => $families([AUI_CLASS.ITEM, ITEM_CLASS], styles, auiConfig.commandPaletteItem);

  return () => (
    <div ref={option.ref} {...option.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'CommandRow');
