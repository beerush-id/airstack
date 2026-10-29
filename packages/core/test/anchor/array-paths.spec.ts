import { describe, expect, it } from 'vitest';
import { anchor, subscribe } from '../../src/index.js';
import { replay } from '../../src/reactive/event.js';
import type { StateChange } from '../../src/types.js';

/**
 * A state and a copy of its own kept in step only by replaying the state's changes, the way a remote
 * peer is: if a change names the wrong path, the copy drifts from the state. `copy()` reads it as plain data.
 * With `serialized`, changes reach the copy cloned, so it never shares an object the state put in its array.
 */
function mirrored<T extends object>(init: T, serialized = false) {
  const state = anchor(structuredClone(init));
  const replica = anchor(structuredClone(init));
  const changes: StateChange[] = [];
  subscribe(state, (_, change) => {
    if (change.type === 'init') return;
    changes.push(change);
    replay(replica, serialized ? structuredClone(change) : change);
  });
  return {
    state,
    changes,
    copy: (): T => JSON.parse(JSON.stringify(replica)),
  };
}

type Item = { id: string; status?: string };
const items = (): { items: Item[] } => ({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });

describe('Anchor Core - Array element paths after the array changes', () => {
  it('keeps the replica in step while no element moves', () => {
    const { state, copy } = mirrored(items());
    const kept = state.items[1];

    state.items.push({ id: 'd' });
    kept.status = 'done';

    expect(copy()).toEqual({ items: [{ id: 'a' }, { id: 'b', status: 'done' }, { id: 'c' }, { id: 'd' }] });
  });

  it('names an element by its index now, after a splice removes elements before it', () => {
    const { state, copy, changes } = mirrored(items());
    const kept = state.items[2];

    state.items.splice(0, 2);
    kept.status = 'done';

    expect(changes.at(-1)).toMatchObject({ type: 'set', keys: ['items', '0', 'status'], value: 'done' });
    expect(copy()).toEqual({ items: [{ id: 'c', status: 'done' }] });
  });

  it('names an element by its index now, after a shift', () => {
    const { state, copy } = mirrored(items());
    const kept = state.items[1];

    state.items.shift();
    kept.status = 'done';

    expect(copy()).toEqual({ items: [{ id: 'b', status: 'done' }, { id: 'c' }] });
  });

  it('names an element by its index now, after an unshift', () => {
    const { state, copy } = mirrored(items());
    const kept = state.items[0];

    state.items.unshift({ id: 'z' });
    kept.status = 'done';

    expect(copy()).toEqual({ items: [{ id: 'z' }, { id: 'a', status: 'done' }, { id: 'b' }, { id: 'c' }] });
  });

  it('names an element by its index now, after a splice inserts elements before it', () => {
    const { state, copy } = mirrored(items());
    const kept = state.items[1];

    state.items.splice(1, 0, { id: 'x' }, { id: 'y' });
    kept.status = 'done';

    expect(copy().items.map((item) => item.id)).toEqual(['a', 'x', 'y', 'b', 'c']);
    expect(copy().items[3]).toEqual({ id: 'b', status: 'done' });
  });

  it('names an element by its index now, after a reverse', () => {
    const { state, copy } = mirrored(items());
    const kept = state.items[0];

    state.items.reverse();
    kept.status = 'done';

    expect(copy()).toEqual({ items: [{ id: 'c' }, { id: 'b' }, { id: 'a', status: 'done' }] });
  });

  it('names an element by its index now, after a sort', () => {
    const { state, copy } = mirrored({ items: [{ id: 'c' }, { id: 'a' }, { id: 'b' }] as Item[] });
    const kept = state.items[0];

    state.items.sort((left, right) => left.id.localeCompare(right.id));
    kept.status = 'done';

    expect(copy()).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c', status: 'done' }] });
  });

  it('names a nested element by its indexes now, after the outer array changes', () => {
    const { state, copy } = mirrored({
      tracks: [
        { id: 't1', clips: [{ id: 'c1' }] },
        { id: 't2', clips: [{ id: 'c2' }, { id: 'c3' }] },
      ] as Array<{ id: string; clips: Item[] }>,
    });
    const kept = state.tracks[1].clips[1];

    state.tracks.shift();
    state.tracks[0].clips.shift();
    kept.status = 'done';

    expect(copy()).toEqual({ tracks: [{ id: 't2', clips: [{ id: 'c3', status: 'done' }] }] });
  });

  it('keeps every element of a long run of changes in step', () => {
    const { state, copy } = mirrored(items());
    const [a, b, c] = state.items;

    state.items.push({ id: 'd' });
    b.status = 'one';
    state.items.splice(0, 1);
    c.status = 'two';
    state.items.unshift({ id: 'z' });
    b.status = 'three';
    state.items.reverse();
    c.status = 'four';
    a.status = 'removed, so not in the state';

    expect(copy()).toEqual(JSON.parse(JSON.stringify(state)));
  });
});

describe('Anchor Core - Array elements that leave the array', () => {
  /** Changes a removed element and tells whether that emitted anything. */
  function emitsAfterChanging(changes: StateChange[], change: () => void) {
    const count = changes.length;
    change();
    return changes.length > count;
  }

  it('removes the last element with a negative splice start', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [, b, c] = state.items;

    state.items.splice(-1, 1);

    expect(changes.at(-1)).toMatchObject({ type: 'splice', removed: [{ id: 'c' }] });
    expect(emitsAfterChanging(changes, () => (c.status = 'gone'))).toBe(false);

    b.status = 'kept';
    expect(copy()).toEqual({ items: [{ id: 'a' }, { id: 'b', status: 'kept' }] });
  });

  it('removes every element from the start with a splice that has no delete count', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a, b, c] = state.items;

    state.items.splice(1);

    expect(changes.at(-1)).toMatchObject({ type: 'splice', removed: [{ id: 'b' }, { id: 'c' }] });
    expect(emitsAfterChanging(changes, () => (b.status = 'gone'))).toBe(false);
    expect(emitsAfterChanging(changes, () => (c.status = 'gone'))).toBe(false);

    a.status = 'kept';
    expect(copy()).toEqual({ items: [{ id: 'a', status: 'kept' }] });
  });

  it('removes nothing when a splice puts the elements it took back in another order', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a, b, c] = state.items;

    state.items.splice(0, 3, c, a, b);

    expect(changes.at(-1)).toMatchObject({ type: 'splice', removed: [] });

    a.status = 'moved';
    expect(copy()).toEqual({ items: [{ id: 'c' }, { id: 'a', status: 'moved' }, { id: 'b' }] });
  });

  it('removes the last element with a pop', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a, , c] = state.items;

    state.items.pop();

    expect(changes.at(-1)).toMatchObject({ type: 'pop', removed: [{ id: 'c' }] });
    expect(emitsAfterChanging(changes, () => (c.status = 'gone'))).toBe(false);

    a.status = 'kept';
    expect(copy()).toEqual({ items: [{ id: 'a', status: 'kept' }, { id: 'b' }] });
  });

  it('removes the elements a fill overwrites, and keeps the filled element shared by its indexes', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a, b, c] = state.items;

    state.items.fill({ id: 'f' }, 1);

    expect(changes.at(-1)).toMatchObject({ type: 'fill', removed: [{ id: 'b' }, { id: 'c' }] });
    expect(emitsAfterChanging(changes, () => (b.status = 'gone'))).toBe(false);
    expect(emitsAfterChanging(changes, () => (c.status = 'gone'))).toBe(false);

    a.status = 'kept';
    state.items[2].status = 'filled';

    const filled = { id: 'f', status: 'filled' };
    expect(copy()).toEqual({ items: [{ id: 'a', status: 'kept' }, filled, filled] });
    expect(copy()).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('removes only the elements a copyWithin overwrites and does not move elsewhere', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a, b, c] = state.items;

    state.items.copyWithin(1, 0);

    expect(changes.at(-1)).toMatchObject({ type: 'copyWithin', removed: [{ id: 'c' }] });
    expect(emitsAfterChanging(changes, () => (c.status = 'gone'))).toBe(false);

    b.status = 'moved';
    a.status = 'copied';

    expect(copy()).toEqual(JSON.parse(JSON.stringify(state)));
    expect(copy().items.map((item) => item.id)).toEqual(['a', 'a', 'b']);
  });

  it('keeps a duplicated element in step through either index, and while one copy is removed', () => {
    const { state, copy, changes } = mirrored(items(), true);
    const [a] = state.items;

    state.items.copyWithin(2, 0, 1);
    a.status = 'one';
    state.items[2].status = 'two';

    expect(copy()).toEqual(JSON.parse(JSON.stringify(state)));

    state.items.shift();

    expect(changes.at(-1)).toMatchObject({ type: 'shift', removed: [{ id: 'a' }] });
    expect(emitsAfterChanging(changes, () => (a.status = 'three'))).toBe(true);
    expect(changes.at(-1)).toMatchObject({ type: 'set', keys: ['items', '1', 'status'] });
    expect(copy()).toEqual({ items: [{ id: 'b' }, { id: 'a', status: 'three' }] });
  });
});
