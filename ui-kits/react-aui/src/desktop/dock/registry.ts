import type { ReactNode } from 'react';
import type { JsonValue, WidgetNode } from '../../dynamic/WidgetRenderer.js';

/**
 * What a widget part declares about its inputs. A part with a `formAction` is a form: the widget
 * wraps it, so it never names the form itself.
 */
export type DockWidgetForm = {
  /** The owner's id for this widget, handed back with what's pressed in it. */
  id?: string;
  /** Whether it's over: a `settled` widget comes back filled in and locked. `pending` by default. */
  status?: 'pending' | 'settled';
  /** What its inputs start with, kept as the widget's own state at `$this.form`. */
  form?: Record<string, JsonValue>;
  /** What a submit runs, e.g. `system.calendar.createEvent`. A button's own `action` runs instead of it. */
  formAction?: string;
  /** Locks the form once its action succeeds, so it can't run twice. */
  once?: boolean;
};

/**
 * One part of an answer: text that grows as the words arrive, or a widget —
 * UI described as data — added whole once it is complete. A widget is drawn in
 * a card, so it reads apart from the words around it: its `props` say how that
 * card looks (`size`, `variant`, `color`), over the stack's small raised one,
 * and its children are the card's content.
 */
export type DockWidgetPart =
  | { type: 'text'; text: string }
  | ({ type: 'widget'; props?: Record<string, JsonValue>; children?: WidgetNode[] } & DockWidgetForm);

/**
 * One entry above the dock, owned by whoever gives the list: what the agent says, or what the user
 * sent. The list is shallow and keeps the entry as a plain object, so what changes in it carries its
 * own reactivity: make `children` reactive to grow them, and a getter for `important` to clear it.
 * The stack watches `children`, and a change there keeps it awake.
 */
export type DockWidgetEntry = {
  /** Keeps its place in the list, and what it holds, as the list changes. */
  id: string;
  /** Who it's from: `user` for what they sent, a turn of its own. The agent's answers leave it out. */
  from?: 'user';
  /** It waits on the user: it's marked, here and on a sleeping stack's pill. */
  important?: boolean;
  /** Interrupts screen readers at once; otherwise it is announced politely. */
  critical?: boolean;
  /** The answer's parts so far, reactive. */
  children?: DockWidgetPart[];
  /** What it shows instead of parts, when it's drawn by code rather than sent as data. */
  view?: ReactNode;
};
