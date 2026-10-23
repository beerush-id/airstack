import { type AnyType, mutable, subscribe } from '@airlib/react';
import type { ReactNode } from 'react';
import type { ListEntry } from '../../composites/entry-list.js';
import type { WidgetNode } from '../../dynamic/WidgetRenderer.js';
import { dockWidgetActivity, dockWidgetEntries } from './store.js';

/**
 * How a widget draws itself: a setup function that runs once for the widget
 * — local state lives here — and returns what to render, reading the
 * widget's `data` as it changes.
 */
export type DockWidgetRender<D extends object = AnyType> = (props: { widget: DockWidgetEntry<D> }) => () => ReactNode;

/**
 * One part of an answer: text that grows as the words arrive, or a widget —
 * UI described as data — added whole once it is complete.
 */
export type DockWidgetPart = { type: 'text'; text: string } | ({ type: 'widget' } & Exclude<WidgetNode, string>);

/** An answer made of parts: its `data.children` is the live list they are added to. */
export type DockWidgetParts = { children: DockWidgetPart[] };

/** How a widget behaves, whatever it shows. */
type DockWidgetBehavior = {
  /** It waits on the user — a question, a confirmation — so it never leaves on its own and always stays in view. */
  important?: boolean;
  /** Interrupts screen readers at once; otherwise it is announced politely. */
  critical?: boolean;
};

/**
 * What a widget starts from: the parts of an answer, drawn for you, or data of
 * your own with a `render` that draws it.
 */
export type DockWidgetOptions<D extends object = AnyType> = DockWidgetBehavior &
  (
    | {
        /** The answer's parts so far; push more to `data.children` as they arrive. */
        children?: DockWidgetPart[];
        data?: never;
        render?: never;
      }
    | {
        /** What it shows. Write to the widget's `data` to change it while it is showing. */
        data?: D;
        /** How it draws itself. */
        render: DockWidgetRender<D>;
        children?: never;
      }
  );

/**
 * One answer above the dock: it shows its live `data` until it is dismissed,
 * by the user or by the code that added it.
 */
export type DockWidgetEntry<D extends object = AnyType> = ListEntry & {
  /** What it shows, live: writing to it redraws only what reads the changed part. */
  readonly data: D;
  readonly important: boolean;
  readonly critical: boolean;
  /** How it draws itself; without one, it is an answer drawn from its parts. */
  readonly render?: DockWidgetRender<D>;
};

const touch = () => {
  dockWidgetActivity.count += 1;
};

let counter = 0;

/**
 * The answers shown above the dock: what the agent says back, composed into
 * widgets. Add one when an answer starts, write its `data` as the answer
 * arrives, and dismiss it when it no longer matters.
 */
export const dockWidget = {
  /**
   * How many answers stay. Past it, each new answer dismisses the oldest, so
   * a long conversation never outgrows it. Defaults to 1000.
   */
  limit: 1000,
  /** The answers showing, by id, oldest first. */
  get entries(): ReadonlyMap<string, DockWidgetEntry> {
    return dockWidgetEntries;
  },
  /**
   * Shows a widget above the dock: the parts of an answer, or data of your own
   * with a `render` that draws it.
   *
   * @param options - Its parts or data, and whether it waits on the user.
   * @returns The widget; its `data` is live.
   */
  add<D extends object = DockWidgetParts>(options: DockWidgetOptions<D>): DockWidgetEntry<D> {
    const data = mutable((options.render ? (options.data ?? {}) : { children: options.children ?? [] }) as D);
    const stop = subscribe(data, touch);
    const entry: DockWidgetEntry = {
      id: `dock-widget-${++counter}`,
      data,
      important: !!options.important,
      critical: !!options.critical,
      render: options.render,
      dismiss() {
        if (!dockWidgetEntries.delete(entry.id)) return;
        stop();
        touch();
      },
    };

    dockWidgetEntries.set(entry.id, entry);
    // Past the limit, the oldest answer leaves.
    if (dockWidgetEntries.size > dockWidget.limit) dockWidgetEntries.values().next().value?.dismiss();
    touch();
    return entry as unknown as DockWidgetEntry<D>;
  },
  /** Dismisses every widget. */
  clear(): void {
    for (const widget of [...dockWidgetEntries.values()]) widget.dismiss();
  },
};
