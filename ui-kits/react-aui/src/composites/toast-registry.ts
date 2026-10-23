import type { ReactNode } from 'react';
import { createEntryList, type ListEntry } from './entry-list.js';

/**
 * How a notification is shown and announced.
 */
export type ToastOptions = {
  /** Tints it with a role's container; without one it is a neutral snackbar. The tone shortcuts set it for you. */
  color?: string;
  /** Interrupts screen readers at once, for what can't wait; otherwise it is announced politely. */
  critical?: boolean;
  /** Milliseconds before it leaves on its own. Defaults to its host's. */
  duration?: number;
};

/**
 * One notification: said once, then gone. What it says never changes once
 * it shows.
 */
export type ToastEntry = ListEntry &
  Readonly<ToastOptions> & {
    /** What it says: text, or a function that draws it. */
    readonly content: ReactNode | (() => ReactNode);
  };

type ToastTone = 'info' | 'success' | 'warning' | 'error';

const list = createEntryList<ToastEntry>('toast');

/**
 * Notifications: results worth knowing and system messages, shown once by a
 * `ToastHost`. Each call adds one and returns it, so it can be taken down
 * early with `dismiss()`.
 */
export const toast = {
  /** The notifications showing, oldest first. */
  get entries(): readonly ToastEntry[] {
    return list.entries;
  },
  /**
   * Shows a notification.
   *
   * @param content - What it says: text, or a function that draws it.
   * @param options - Its color, urgency, and how long it stays.
   * @returns The notification.
   */
  add(content: ToastEntry['content'], options: ToastOptions = {}): ToastEntry {
    return list.add(({ id, dismiss }) => ({
      id,
      dismiss,
      content,
      color: options.color,
      critical: options.critical,
      duration: options.duration,
    }));
  },
  /** Shows an informational notification. */
  info: tone('info'),
  /** Shows that something went well. */
  success: tone('success'),
  /** Shows something to watch out for. */
  warning: tone('warning'),
  /** Shows that something failed. It is still announced politely unless `critical`. */
  error: tone('error'),
  /** Takes every notification down. */
  clear(): void {
    list.clear();
  },
};

/**
 * A shortcut that shows a notification in one role's color.
 *
 * @param color - The role color of the tone.
 * @returns The shortcut.
 */
function tone(color: ToastTone) {
  return (content: ToastEntry['content'], options: Omit<ToastOptions, 'color'> = {}): ToastEntry =>
    toast.add(content, { color, critical: options.critical, duration: options.duration });
}
