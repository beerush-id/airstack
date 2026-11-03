import { createContext, effect, mutable } from '@airlib/react';
import { shortId } from '@airlib/react/utils';
import type { ReactNode } from 'react';
import type { DockPromptProps, DockSubmitEvent } from '../DockPrompt.js';

/** One thing the app offers for the word being typed: a command, a file, a person. */
export type DockSuggestion = {
  /** What kind of thing it is, the app's own word, e.g. `command`. It comes back as given, with anything else the app put on it. */
  type?: string;
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
  /** The name of the set it belongs to, shown above the set, e.g. the front window's title. Neighbours with the same name are one set. */
  group?: string;
};

/** The word being typed: the key it starts with, and the rest of it. */
export type DockWord = { key: string; query: string };

/**
 * What the prompt offers for the word being typed, e.g. the commands after `/`. Read as the word
 * changes, and live: what isn't there yet just isn't offered, until it is.
 *
 * @param word - The word being typed.
 * @param selections - What was picked earlier in the prompt, before the word, in order.
 * @returns What to offer; nothing closes the list.
 */
export type DockSuggestions = (word: DockWord, selections: DockSuggestion[]) => DockSuggestion[];

/** A token in the prompt: what was picked, and the key it was picked with. */
type Picked = { key: string; item: DockSuggestion };

/** Where the word being typed sits in the field. */
type Word = { node: Text; start: number; end: number };

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
 * and the word at the caret. It's a bridge: it asks what to offer for a word and reports what was
 * sent, and everything those mean belongs to whoever answers.
 */
export class DockPromptEditor {
  /** The word being typed, the suggestion Enter picks, the field, and how many sent prompts are still at work. */
  public readonly state = mutable(
    {
      word: undefined as DockWord | undefined,
      active: undefined as string | undefined,
      field: undefined as HTMLElement | undefined,
      running: 0,
    },
    { recursive: false }
  );

  /** The suggestion list's id, which the field points at while it's open. */
  public readonly id = `aui-dock-suggestions-${shortId()}`;

  private word?: Word;
  /** Aborts the latest sent prompt. */
  private pending?: AbortController;
  private readonly picked = new WeakMap<Element, Picked>();

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
  public get selections(): DockSuggestion[] {
    const tokens = this.state.field?.querySelectorAll(`.${TOKEN_CLASS}`) ?? [];
    return [...tokens].flatMap((token) => this.picked.get(token)?.item ?? []);
  }

  /** What's offered for the word being typed; nothing while no word is. */
  public get items(): DockSuggestion[] {
    const { word } = this.state;
    return word && this.word ? (this.props.suggestions?.(word, this.selectionsBefore(this.word.node)) ?? []) : [];
  }

  /**
   * Where a suggestion is in the list.
   *
   * @param value - The suggestion.
   * @returns Its place, or -1 once it's gone.
   */
  public indexOf(value: string): number {
    return this.items.findIndex((item) => item.value === value);
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

  /** What's offered, in order, as the sets it's drawn in; suggestions with no `group` are one nameless set. */
  public get groups(): { label?: string; items: DockSuggestion[] }[] {
    const groups: { label?: string; items: DockSuggestion[] }[] = [];
    for (const item of this.items) {
      const last = groups.at(-1);
      if (last && last.label === item.group) last.items.push(item);
      else groups.push({ label: item.group, items: [item] });
    }
    return groups;
  }

  /** Whether the prompt is at work: a sent prompt that hasn't finished, or the app's own `busy`. */
  public get working(): boolean {
    return !!this.props.busy || this.state.running > 0;
  }

  /**
   * Sends what's written, with what was picked in, and clears. A prompt sent while another runs
   * takes its place: the earlier one's signal aborts. The prompt shows at work until `onsubmit`
   * settles.
   *
   * @param event - What sent it: the key or the press.
   * @returns Once `onsubmit` has finished.
   */
  public async submit(event: Event): Promise<void> {
    const text = this.text.trim();
    if (!text) return;
    const selections = this.selections;
    this.write('');

    this.pending?.abort();
    const controller = new AbortController();
    this.pending = controller;
    this.state.running += 1;
    try {
      await this.props.onsubmit?.({ text, selections, signal: controller.signal, event });
    } finally {
      this.state.running -= 1;
      if (this.pending === controller) this.pending = undefined;
    }
  }

  /** Stops what's running: the latest sent prompt, and the app's own work when it's `busy`. */
  public stop(): void {
    this.pending?.abort();
    if (this.props.busy) this.props.onstop?.(new CustomEvent('stop'));
  }

  /**
   * Puts a suggestion where the word being typed is, as a token, with the suggestion's icon, and a
   * space after it.
   *
   * @param value - The suggestion to put in; the active one when omitted.
   */
  public pick(value = this.state.active): void {
    const { items } = this;
    const at = items.findIndex((entry) => entry.value === value);
    const item = items[at];
    const word = this.word;
    const key = this.state.word?.key;
    // The icon as its row drew it, taken before closing the list removes the row.
    const icon = document.getElementById(this.optionId(at))?.querySelector(`.${ICON_CLASS}`)?.cloneNode(true);
    this.close();
    if (!item || !word || !key) return;

    const token = document.createElement('span');
    token.className = TOKEN_CLASS;
    token.contentEditable = 'false';
    token.append(...(icon ? [icon] : []), `${key}${item.label}`);
    this.picked.set(token, { key, item });

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

  /** Closes the suggestions. */
  public close(): void {
    this.word = undefined;
    this.state.word = undefined;
    this.activate(undefined);
  }

  /**
   * The field's keys. While suggestions are open, the arrows move through them, Enter or Tab
   * picks, and Escape closes them. Otherwise Enter sends, like a chat field (Shift+Enter adds a
   * line), and Escape stops a running request.
   */
  private readonly handleKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;

    if (this.items.length) {
      const step = STEPS[event.key];
      if (step) this.move(step);
      else if (event.key === 'Enter' || event.key === 'Tab') this.pick();
      else if (event.key === 'Escape') this.close();
      else return;
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape' && (this.state.running > 0 || (this.props.busy && this.props.onstop))) {
      event.preventDefault();
      this.stop();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.submit(event);
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
    if (!match) return this.close();

    const [, key, query] = match;
    this.word = { node, start: end - query.length - 1, end };
    this.state.word = { key, query };
    this.activate(this.items[0]?.value);
  }

  /**
   * The suggestions picked into the prompt ahead of a point in it.
   *
   * @param node - Where to look before.
   * @returns The picks before it, in order.
   */
  private selectionsBefore(node: Node): DockSuggestion[] {
    const tokens = this.state.field?.querySelectorAll(`.${TOKEN_CLASS}`) ?? [];
    return [...tokens]
      .filter((token) => token.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .flatMap((token) => this.picked.get(token)?.item ?? []);
  }

  /**
   * Moves the active suggestion, wrapping at either end.
   *
   * @param step - How far: 1 down, -1 up.
   */
  private move(step: number): void {
    const { items } = this;
    const at = items.findIndex((item) => item.value === this.state.active);
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
    const at = value === undefined ? -1 : this.indexOf(value);
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
    const empty = /^\n*$/.test(field.textContent ?? '');
    // Editing leaves a stray line break (a `<br>` or a newline) in an emptied field; it would hold a second line open.
    if (empty && field.childNodes.length) field.replaceChildren();
    field.toggleAttribute('data-empty', empty);
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

    const token = this.picked.get(node);
    if (token) return `${token.key}${token.item.label}`;
    return [...node.childNodes].map((child) => this.serialize(child)).join('');
  }
}
