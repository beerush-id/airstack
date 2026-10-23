import { mutable } from '@airlib/react';

/**
 * One entry of a one-time list, such as a toast or an answer: it shows until
 * it is dismissed.
 */
export type ListEntry = {
  /** Unique id, also the entry's element id. */
  readonly id: string;
  /** Takes the entry off its list. */
  dismiss(): void;
};

/**
 * A list of one-time entries, oldest first. Entries are held without
 * wrapping, so writing inside one never re-renders the list's readers.
 */
export type EntryList<E extends ListEntry> = {
  /** The entries showing, oldest first. */
  readonly entries: readonly E[];
  /**
   * Adds an entry built around its id and dismissal.
   *
   * @param create - Builds the entry from the id and `dismiss` the list gives it.
   * @returns The entry, now showing.
   */
  add(create: (base: ListEntry) => E): E;
  /** Dismisses every entry. */
  clear(): void;
};

/**
 * Creates a list of one-time entries.
 *
 * @param prefix - Starts every entry's id, e.g. `toast`.
 * @returns The list.
 */
export function createEntryList<E extends ListEntry>(prefix: string): EntryList<E> {
  const entries = mutable<E[]>([], { recursive: 'flat' });
  let counter = 0;

  const remove = (id: string) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index > -1) entries.splice(index, 1);
  };

  return {
    entries,
    add(create) {
      const id = `${prefix}-${++counter}`;
      const entry = create({ id, dismiss: () => remove(id) });
      entries.push(entry);
      return entry;
    },
    clear() {
      entries.splice(0, entries.length);
    },
  };
}
