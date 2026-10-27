import { createContext, effect, mutable } from '@airlib/react';
import { shortId } from '@airlib/react/utils';
import type { ReactNode } from 'react';
import type { DockPromptProps, DockSubmitEvent } from '../DockPrompt.js';
import { system } from '../system/system.js';

/** One thing the app offers for the word being typed: a command, a file, a person. */
export type DockSuggestion = {
  /** What the app gets back when it's picked. */
  value: string;
  /** What the prompt shows and puts in, after the trigger character. */
  label: string;
  /** A quieter word at the end of its row: what a command does, a file's size. */
  hint?: string;
  /**
   * What kind of command or thing it is, at the start of its row and of its token once picked: a
   * glyph, or a picture's URL, e.g. a photo's thumbnail.
   */
  icon?: string | ReactNode;
  /** Which set it belongs to; the list leaves a gap where the set changes, e.g. between the system's commands and the front window's. */
  group?: string;
  /**
   * What sending the prompt does while this is in it, in place of `onsubmit`: the same call its
   * button makes, e.g. opening the app picked after `/open`. The prompt waits for it, then clears;
   * if it throws, what's written stays. Stopping aborts the signal.
   */
  action?: (event: DockSubmitEvent, signal: AbortSignal) => unknown | Promise<unknown>;
};

/** What's around the word being completed, for a filter whose offer depends on it. */
export type DockSuggestionScope = {
  /** The suggestions picked earlier in the prompt, before the word, in order: e.g. the `/open` before `@`. */
  references: DockReference[];
};

/**
 * Finds what a trigger offers for the rest of its word, e.g. the files matching what's typed after
 * `@`, or the apps once `/open` comes before it.
 */
export type DockSuggestionFilter = (
  query: string,
  scope: DockSuggestionScope
) => DockSuggestion[] | Promise<DockSuggestion[]>;

/** The prompt's triggers: each character that starts a word to complete, and what it offers. */
export type DockSuggestionFilters = Record<string, DockSuggestionFilter>;

/** A suggestion picked into the prompt: the trigger it came from, and the item. */
export type DockReference = { char: string; item: DockSuggestion };

/** The word being completed: the text it's in, where it starts and ends, and its trigger. */
type Word = { node: Text; char: string; start: number; end: number };

/** A word that ends at the caret, read as its first character (the trigger) and the rest (the query). */
const WORD = /(?:^|\s)(\S)(\S*)$/;
const TOKEN_CLASS = 'aui-dock-token';
/** Wraps a suggestion's icon in its row; a pick copies it into the token. */
export const ICON_CLASS = 'aui-dock-suggestion-icon';
/** Follows each token, so typing goes on after it rather than against it. */
const GAP = ' ';
const STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** The prompt its parts share. */
export const promptCtx = createContext<DockPromptEditor>();

/**
 * What the dock prompt holds: what's written, with each picked suggestion kept whole as a token,
 * and the suggestions for the word at the caret. The field is the person's own; only a pick
 * writes into it.
 */
export class DockPromptEditor {
  /**
   * The suggestions for the word being completed (empty while none is), the one Enter picks, its
   * trigger, the field, and whether a picked suggestion's action is running.
   */
  public readonly state = mutable(
    {
      items: [] as DockSuggestion[],
      active: undefined as string | undefined,
      char: '',
      field: undefined as HTMLElement | undefined,
      running: false,
    },
    { recursive: false }
  );

  /** The suggestion list's id, which the field points at while it's open. */
  public readonly id = `aui-dock-suggestions-${shortId()}`;

  private word?: Word;
  /** Aborts the running action. */
  private pending?: AbortController;
  private request = 0;
  private readonly picked = new WeakMap<Element, DockReference>();

  /**
   * @param props - The prompt's props: its labels, triggers, bound text, and handlers.
   */
  public constructor(public readonly props: DockPromptProps) {
    // Text bound from outside, e.g. a transcript, replaces what's written; what's typed writes it back.
    effect(() => {
      const text = props.value ?? '';
      if (this.state.field && text !== this.text) this.write(text);
    });
    effect.client(() => this.listen(this.state.field));
  }

  /** Takes the field when it mounts. */
  public readonly ref = (field: HTMLElement | null): void => {
    this.state.field = field ?? undefined;
  };

  /** What's written, each token as its trigger and label. */
  public get text(): string {
    const field = this.state.field;
    return field ? [...field.childNodes].map((node) => this.serialize(node)).join('') : '';
  }

  /** The suggestions picked into the prompt that are still in it. */
  public get references(): DockReference[] {
    const tokens = this.state.field?.querySelectorAll(`.${TOKEN_CLASS}`) ?? [];
    return [...tokens].flatMap((token) => this.picked.get(token) ?? []);
  }

  /**
   * The id of the suggestion at an index, for the field to point at.
   *
   * @param index - Where the suggestion is in the list.
   * @returns Its id.
   */
  public optionId(index: number): string {
    return `${this.id}-${index}`;
  }

  /**
   * Whether a suggestion starts a new set in the list, so a gap goes before it.
   *
   * @param item - The suggestion.
   * @returns True when the one before it belongs to another set.
   */
  public startsGroup(item: DockSuggestion): boolean {
    const at = this.state.items.indexOf(item);
    return at > 0 && this.state.items[at - 1].group !== item.group;
  }

  /** Whether the prompt is at work: the app's request (`busy`), or a picked suggestion's action. */
  public get working(): boolean {
    return !!this.props.busy || this.state.running;
  }

  /**
   * Sends what's written, with the window in front and what was picked in. The first pick with an
   * action handles it, and the prompt clears once that's done; otherwise it goes to `onsubmit` and
   * clears at once.
   */
  public async submit(): Promise<void> {
    const text = this.text.trim();
    if (!text || this.state.running) return;
    const references = this.references;
    const event: DockSubmitEvent = Object.assign(new CustomEvent('submit', { detail: text }), {
      activeWindow: system.activeWindow,
      references,
    });

    const action = references.find((reference) => reference.item.action)?.item.action;
    if (!action) {
      this.props.onsubmit?.(event);
      this.write('');
      return;
    }

    const controller = new AbortController();
    this.pending = controller;
    this.state.running = true;
    try {
      await action(event, controller.signal);
      if (!controller.signal.aborted) this.write('');
    } catch {
      // What's written stays, to fix and send again; the action reports its own failure.
    } finally {
      this.pending = undefined;
      this.state.running = false;
    }
  }

  /** Stops what's running: a picked suggestion's action, or the app's request. */
  public stop(): void {
    if (this.pending) this.pending.abort();
    else if (this.props.busy) this.props.onstop?.(new CustomEvent('stop'));
  }

  /**
   * Puts a suggestion where the word being typed is, as a token, with the suggestion's icon, and a
   * space after it.
   *
   * @param value - The suggestion to put in; the active one when omitted.
   */
  public pick(value = this.state.active): void {
    const at = this.state.items.findIndex((entry) => entry.value === value);
    const item = this.state.items[at];
    const word = this.word;
    // The icon as its row drew it, taken before closing the list removes the row.
    const icon = document.getElementById(this.optionId(at))?.querySelector(`.${ICON_CLASS}`)?.cloneNode(true);
    this.close();
    if (!item || !word) return;

    const token = document.createElement('span');
    token.className = TOKEN_CLASS;
    token.contentEditable = 'false';
    token.append(...(icon ? [icon] : []), `${word.char}${item.label}`);
    this.picked.set(token, { char: word.char, item });

    const gap = document.createTextNode(GAP);
    const range = document.createRange();
    range.setStart(word.node, word.start);
    range.setEnd(word.node, word.end);
    range.deleteContents();
    range.insertNode(gap);
    range.insertNode(token);
    getSelection()?.collapse(gap, GAP.length);
    this.changed();
  }

  /** Closes the suggestions, dropping any answer still on its way. */
  public close(): void {
    this.request++;
    this.word = undefined;
    if (this.state.items.length) this.state.items = [];
    this.activate(undefined);
  }

  /**
   * The field's keys. While suggestions are open, the arrows move through them, Enter or Tab
   * picks, and Escape closes them. Otherwise Enter sends, like a chat field (Shift+Enter adds a
   * line), and Escape stops a running request.
   */
  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;

    if (this.state.items.length) {
      const step = STEPS[event.key];
      if (step) this.move(step);
      else if (event.key === 'Enter' || event.key === 'Tab') this.pick();
      else if (event.key === 'Escape') this.close();
      else return;
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape' && (this.state.running || (this.props.busy && this.props.onstop))) {
      event.preventDefault();
      this.stop();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.submit();
    }
  };

  /**
   * Follows the field: its keys, its content, and the caret, which says which word to complete.
   *
   * @param field - The field, once mounted.
   * @returns What stops following it.
   */
  private listen(field?: HTMLElement): (() => void) | void {
    if (!field) return;

    const input = () => this.changed();
    const close = () => this.close();
    const caret = () => {
      if (document.activeElement === field) this.suggest();
    };

    field.addEventListener('keydown', this.handleKey);
    field.addEventListener('input', input);
    field.addEventListener('blur', close);
    document.addEventListener('selectionchange', caret);

    return () => {
      field.removeEventListener('keydown', this.handleKey);
      field.removeEventListener('input', input);
      field.removeEventListener('blur', close);
      document.removeEventListener('selectionchange', caret);
    };
  }

  /** Reads the word at the caret: one starting with a trigger asks what it offers; anything else closes the suggestions. */
  private suggest(): void {
    const field = this.state.field;
    const selection = getSelection();
    const node = selection?.anchorNode;
    if (!field || !selection?.isCollapsed || !(node instanceof Text) || !field.contains(node)) return this.close();

    const end = selection.anchorOffset;
    const match = WORD.exec(node.data.slice(0, end));
    const filter = match && this.props.filters?.[match[1]];
    if (!match || !filter) return this.close();

    const [, char, query] = match;
    const ask = ++this.request;
    this.word = { node, char, start: end - query.length - 1, end };
    Promise.resolve(filter(query, { references: this.referencesBefore(node) })).then((items) => {
      if (ask !== this.request) return;
      this.state.char = char;
      this.state.items = items;
      this.activate(items[0]?.value);
    });
  }

  /**
   * The suggestions picked into the prompt ahead of a point in it.
   *
   * @param node - Where to look before.
   * @returns The picks before it, in order.
   */
  private referencesBefore(node: Node): DockReference[] {
    const tokens = this.state.field?.querySelectorAll(`.${TOKEN_CLASS}`) ?? [];
    return [...tokens]
      .filter((token) => token.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .flatMap((token) => this.picked.get(token) ?? []);
  }

  /**
   * Moves the active suggestion, wrapping at either end.
   *
   * @param step - How far: 1 down, -1 up.
   */
  private move(step: number): void {
    const { items, active } = this.state;
    const at = items.findIndex((item) => item.value === active);
    this.activate(items[(at + step + items.length) % items.length]?.value);
  }

  /**
   * Makes a suggestion the active one, and points the field at it so it's read out as it changes.
   *
   * @param value - The suggestion; none closes the pointer.
   */
  private activate(value?: string): void {
    this.state.active = value;
    const field = this.state.field;
    const at = this.state.items.findIndex((item) => item.value === value);
    if (!field) return;

    if (at < 0) {
      field.removeAttribute('aria-activedescendant');
      field.removeAttribute('aria-controls');
      return;
    }
    field.setAttribute('aria-controls', this.id);
    field.setAttribute('aria-activedescendant', this.optionId(at));
    document.getElementById(this.optionId(at))?.scrollIntoView({ block: 'nearest' });
  }

  /** After what's written changes: whether the placeholder shows, and the bound text. */
  private changed(): void {
    const field = this.state.field;
    if (!field) return;
    const text = this.text;
    field.toggleAttribute('data-empty', field.textContent === '');
    this.props.value = text;
  }

  /**
   * Replaces what's written with plain text.
   *
   * @param text - The new text.
   */
  private write(text: string): void {
    const field = this.state.field;
    if (!field) return;
    field.textContent = text;
    this.close();
    this.changed();
  }

  /**
   * One piece of the field as text: a token as its trigger and label, a line break as a newline.
   *
   * @param node - The piece.
   * @returns Its text.
   */
  private serialize(node: Node): string {
    if (node instanceof Text) return node.data.replaceAll(GAP, ' ');
    if (!(node instanceof HTMLElement)) return '';
    if (node.tagName === 'BR') return '\n';

    const reference = this.picked.get(node);
    if (reference) return `${reference.char}${reference.item.label}`;
    return [...node.childNodes].map((child) => this.serialize(child)).join('');
  }
}
