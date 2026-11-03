import { mutable } from '@airlib/core';

/**
 * Where a composite's one tab stop rests: the item focused last, else the first item to join.
 * Items read `current` to know whether they are the stop, and report themselves as they join,
 * take focus, and leave.
 */
export interface TabStop {
  /** The id of the item that holds the tab stop, if any item has joined. */
  readonly current: string | undefined;
  /**
   * Registers an item as it joins, so the first one holds the stop until another is focused.
   *
   * @param id - The joining item's id.
   */
  join(id: string): void;
  /**
   * Gives the stop to an item, as focus lands in it.
   *
   * @param id - The focused item's id.
   */
  focus(id: string): void;
  /**
   * Releases an item as it leaves, so the stop never rests on an item that's gone.
   *
   * @param id - The leaving item's id.
   */
  leave(id: string): void;
}

/**
 * Creates the roving tab stop a composite keeps for its items — a feed's articles, an editable
 * grid's cells — so Tab enters the composite once, where the reader left it.
 *
 * @returns The composite's tab stop.
 */
export function createTabStop(): TabStop {
  // Both keys exist from the start, so reading one before it's set still subscribes to it.
  const stop = mutable<{ active?: string; first?: string }>({ active: undefined, first: undefined });

  return {
    get current() {
      return stop.active ?? stop.first;
    },
    join(id) {
      if (!stop.first) stop.first = id;
    },
    focus(id) {
      stop.active = id;
    },
    leave(id) {
      if (stop.active === id) stop.active = undefined;
      if (stop.first === id) stop.first = undefined;
    },
  };
}
