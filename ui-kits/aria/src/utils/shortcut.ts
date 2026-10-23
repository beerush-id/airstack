import { mutable } from '@airlib/core';
import type { DetachFn } from '../types.js';

/**
 * A parsed keyboard shortcut: one key and the modifiers held with it. `mod` is the platform's
 * command modifier — `⌘` on Apple platforms, `Ctrl` elsewhere.
 */
export type Shortcut = {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

/** A shortcut bound to a part: what it shows, what it announces, and how it listens. */
export type ShortcutBinding = {
  /** The label to show, e.g. `⌘D`; platform-neutral (`Ctrl+D`) until the part mounts. */
  readonly label: string | undefined;
  /** The `aria-keyshortcuts` value, e.g. `Control+D`. */
  readonly aria: string | undefined;
  /**
   * Listens for the shortcut on the document and runs `activate`; returns the teardown. `activate`
   * returns `false` when the part can't run (disabled), so the key stays the browser's.
   */
  attach(host: Element, activate: () => boolean): DetachFn | void;
};

const MODIFIERS = new Set(['mod', 'ctrl', 'control', 'meta', 'cmd', 'command', 'alt', 'option', 'shift']);

const KEY_LABELS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: '⌦',
  tab: '⇥',
  space: 'Space',
};

const ARIA_KEYS: Record<string, string> = { space: 'Space', escape: 'Escape', enter: 'Enter' };

/**
 * Parses a shortcut written as modifiers and a key joined by `+`, e.g. `mod+shift+d`.
 *
 * @param input - The shortcut text
 * @returns The parsed shortcut, or undefined for an empty one
 */
export function parseShortcut(input?: string): Shortcut | undefined {
  if (!input) return;

  const parts = input
    .toLowerCase()
    .split('+')
    .map((part) => part.trim());
  // A trailing `+` is the plus key itself, e.g. `mod++`.
  const key = input.endsWith('++') ? '+' : parts.filter((part) => part && !MODIFIERS.has(part)).at(-1);
  if (!key) return;

  return {
    key,
    mod: parts.includes('mod'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    alt: parts.includes('alt') || parts.includes('option'),
    shift: parts.includes('shift'),
  };
}

/**
 * Whether the current platform is an Apple one, where `mod` is `⌘`.
 *
 * @returns True on macOS, iOS, and iPadOS
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? navigator.platform ?? navigator.userAgent);
}

/**
 * Whether a keydown is the shortcut, with exactly its modifiers held.
 *
 * @param event - The keydown event
 * @param shortcut - The parsed shortcut
 * @param apple - Whether `mod` means `⌘`
 * @returns True when the event matches
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut, apple: boolean): boolean {
  const wantMeta = shortcut.meta || (shortcut.mod && apple);
  const wantCtrl = shortcut.ctrl || (shortcut.mod && !apple);
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
  // `⌥` reshapes the character (`⌥N` types `˜`), so letters and digits also match by their physical key.
  const physical = event.code.replace(/^(Key|Digit)/, '').toLowerCase();

  return (
    (key === shortcut.key || physical === shortcut.key) &&
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift
  );
}

/**
 * The shortcut as people read it: `⇧⌘E` on Apple platforms, `Ctrl+Shift+E` elsewhere.
 *
 * @param shortcut - The parsed shortcut
 * @param apple - Whether to use the Apple symbols
 * @returns The label
 */
export function shortcutLabel(shortcut: Shortcut, apple: boolean): string {
  const key = KEY_LABELS[shortcut.key] ?? (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  const ctrl = shortcut.ctrl || (shortcut.mod && !apple);
  const meta = shortcut.meta || (shortcut.mod && apple);

  if (apple) {
    return `${ctrl ? '⌃' : ''}${shortcut.alt ? '⌥' : ''}${shortcut.shift ? '⇧' : ''}${meta ? '⌘' : ''}${key}`;
  }

  return [ctrl && 'Ctrl', meta && 'Win', shortcut.alt && 'Alt', shortcut.shift && 'Shift', key].filter(Boolean).join('+');
}

/**
 * The shortcut as `aria-keyshortcuts` writes it, e.g. `Control+Shift+E`.
 *
 * @param shortcut - The parsed shortcut
 * @param apple - Whether `mod` means `Meta`
 * @returns The attribute value
 */
export function shortcutAria(shortcut: Shortcut, apple: boolean): string {
  const key = ARIA_KEYS[shortcut.key] ?? (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  const ctrl = shortcut.ctrl || (shortcut.mod && !apple);
  const meta = shortcut.meta || (shortcut.mod && apple);

  return [ctrl && 'Control', shortcut.alt && 'Alt', shortcut.shift && 'Shift', meta && 'Meta', key].filter(Boolean).join('+');
}

/**
 * Whether a key press lands where people type, so a shortcut leaves it to the field.
 *
 * @param target - The event target
 * @returns True for text fields, text areas, selects, and editable content
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element?.closest) return false;
  return !!element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/**
 * Binds a part to a shortcut read from its props. The label and the announcement follow the
 * prop; until the part mounts they use the platform-neutral form, so server and browser render
 * the same text, and they switch to the platform's own once it does.
 *
 * @param read - Reads the shortcut text from the part's props
 * @returns The binding the part reads and attaches
 */
export function createShortcut(read: () => string | undefined): ShortcutBinding {
  const platform = mutable({ apple: false });

  return {
    get label() {
      const shortcut = parseShortcut(read());
      return shortcut && shortcutLabel(shortcut, platform.apple);
    },
    get aria() {
      const shortcut = parseShortcut(read());
      return shortcut && shortcutAria(shortcut, platform.apple);
    },
    attach(host, activate) {
      const doc = host.ownerDocument;
      platform.apple = isApplePlatform();

      const listen = (event: KeyboardEvent) => {
        const shortcut = parseShortcut(read());
        if (!shortcut || event.defaultPrevented || event.isComposing || event.repeat) return;
        if (isEditableTarget(event.target) || !matchesShortcut(event, shortcut, platform.apple)) return;

        // A command that runs replaces the browser's own action for its keys (save, bookmark, find).
        if (activate()) event.preventDefault();
      };

      doc.addEventListener('keydown', listen);
      return () => doc.removeEventListener('keydown', listen);
    },
  };
}
