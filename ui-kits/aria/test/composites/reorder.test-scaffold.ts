import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ReorderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildReorder(props: Partial<ReorderProps>, items: Array<{ value: string; label: string }>) {
  const reorder = aria('reorder', { label: 'Pipeline stages', ...props } as ReorderProps);
  const listEl = bind(document.createElement('ul'), reorder);
  document.body.appendChild(listEl);

  const built = items.map(({ value, label }) => {
    const item = aria('reorder-item', { value, label });
    const itemEl = bind(document.createElement('li'), item);

    const handle = aria('reorder-handle');
    const handleEl = bind(document.createElement('button'), handle);

    itemEl.appendChild(handleEl);
    listEl.appendChild(itemEl);
    return { value, label, item, itemEl, handle, handleEl };
  });

  const status = aria('reorder-status');
  const statusEl = bind(document.createElement('div'), status);
  document.body.appendChild(statusEl);

  const cleanup = () => {
    status.destroy();
    for (const entry of built) {
      entry.handle.destroy();
      entry.item.destroy();
    }

    reorder.destroy();
    listEl.remove();
    statusEl.remove();
  };

  return { reorder, listEl, items: built, status, statusEl, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Reorder - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Coordinate Projection & Sequence Mutation Invariant', () => {
    it('picks up with the keyboard, moves slot by slot, and commits on the second press', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['build', 'test', 'deploy'] });
          const { items, statusEl, cleanup } = buildReorder(props, [
            { value: 'build', label: 'Build' },
            { value: 'test', label: 'Test' },
            { value: 'deploy', label: 'Deploy' },
          ]);

          // The handle names itself after the item it moves
          expect(items[0].handleEl.getAttribute('aria-label')).toBe('Move Build');
          expect(items[0].handleEl.type).toBe('button');

          expect(statusEl.textContent).toBe('');

          items[0].handleEl.focus();
          expect(press(items[0].handleEl, 'Enter').defaultPrevented).toBe(true);

          expect(props.active).toBe('build');
          expect(props.preview).toEqual(['build', 'test', 'deploy']);
          expect(statusEl.textContent).not.toBe('');

          // Each arrow key moves one slot in the preview only
          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['test', 'build', 'deploy']);
          expect(props.value).toEqual(['build', 'test', 'deploy']);

          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['test', 'deploy', 'build']);

          // Stepping back undoes the previous move
          press(items[0].handleEl, 'ArrowUp');
          expect(props.preview).toEqual(['test', 'build', 'deploy']);

          // The second press drops the item and commits
          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['test', 'build', 'deploy']);
          expect(props.active).toBeNull();

          cleanup();
        });
      }));

    it('cancels on Escape and on Tab, restoring the committed order', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['a', 'b', 'c'] });
          const { items, cleanup } = buildReorder(props, [
            { value: 'a', label: 'First' },
            { value: 'b', label: 'Second' },
            { value: 'c', label: 'Third' },
          ]);

          items[2].handleEl.focus();
          press(items[2].handleEl, ' ');
          expect(props.active).toBe('c');

          press(items[2].handleEl, 'ArrowUp');
          expect(props.preview).toEqual(['a', 'c', 'b']);

          const cancelEvents: number[] = [];
          press(items[2].handleEl, 'Escape');
          cancelEvents.push(1);

          expect(props.value).toEqual(['a', 'b', 'c']);
          expect(props.active).toBeNull();
          // Cancellation restores the pending order from the committed one
          expect(props.preview).toEqual(['a', 'b', 'c']);

          // Tab is a cancel too, and does not leave the item mid-move
          press(items[0].handleEl, 'Enter');
          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['b', 'a', 'c']);

          press(items[0].handleEl, 'Tab');
          expect(props.value).toEqual(['a', 'b', 'c']);
          expect(props.active).toBeNull();
          expect(cancelEvents).toHaveLength(1);

          cleanup();
        });
      }));

    it('travels the horizontal axis when the collection is laid out sideways', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['x', 'y', 'z'], orientation: 'horizontal' });
          const { items, cleanup } = buildReorder(props, [
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
            { value: 'z', label: 'Z' },
          ]);

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');

          press(items[0].handleEl, 'ArrowRight');
          expect(props.preview).toEqual(['y', 'x', 'z']);

          // The axis the collection does not use stays with the page
          expect(press(items[0].handleEl, 'ArrowDown').defaultPrevented).toBe(false);
          expect(props.preview).toEqual(['y', 'x', 'z']);

          press(items[0].handleEl, 'ArrowLeft');
          expect(props.preview).toEqual(['x', 'y', 'z']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['x', 'y', 'z']);

          cleanup();
        });
      }));
  });

  describe('Preview vs Committed Order Invariant', () => {
    it('keeps the committed order untouched until a drop publishes it once', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['one', 'two', 'three'] });
          const { reorder, listEl, items, cleanup } = buildReorder(props, [
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
            { value: 'three', label: 'Three' },
          ]);

          const commits: unknown[] = [];
          listEl.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');

          for (let step = 0; step < 3; step += 1) {
            press(items[0].handleEl, 'ArrowDown');
          }

          // Walked to the end of the list and back: preview moved, value did not
          expect(props.preview).toEqual(['one', 'two', 'three']);
          expect(props.value).toEqual(['one', 'two', 'three']);
          expect(commits).toEqual([]);

          press(items[0].handleEl, 'ArrowUp');
          press(items[0].handleEl, 'ArrowUp');
          expect(props.preview).toEqual(['two', 'three', 'one']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['two', 'three', 'one']);
          expect(commits).toEqual([['two', 'three', 'one']]);

          cleanup();
        });
      }));

    it('refuses pickup while the collection is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['a', 'b'], disabled: true });
          const { listEl, items, cleanup } = buildReorder(props, [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]);

          expect(listEl.getAttribute('aria-disabled')).toBe('true');

          const handle = items[0].handleEl;
          handle.focus();

          expect(press(handle, 'Enter').defaultPrevented).toBe(false);
          expect(props.active).toBeUndefined();
          expect(props.preview).toBeUndefined();

          press(handle, 'ArrowDown');
          expect(props.value).toEqual(['a', 'b']);

          // Lifting the lockout makes the same gestures work on the same handle
          props.disabled = false;
          press(handle, 'Enter');
          expect(props.active).toBe('a');

          press(handle, 'Escape');
          expect(props.active).toBeNull();

          cleanup();
        });
      }));

    it('announces a disabled item on the collection without hiding it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['free', 'locked', 'last'] });
          const { items, cleanup } = buildReorder(props, [
            { value: 'free', label: 'Free' },
            { value: 'locked', label: 'Locked' },
            { value: 'last', label: 'Last' },
          ]);

          items[1].item.assign({ disabled: true });
          expect(items[1].itemEl.getAttribute('aria-disabled')).toBe('true');

          // A disabled item stays in the order and keeps its position
          expect(props.value).toEqual(['free', 'locked', 'last']);

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');
          expect(props.active).toBe('free');

          press(items[0].handleEl, 'Escape');
          expect(props.value).toEqual(['free', 'locked', 'last']);

          cleanup();
        });
      }));
  });

  describe('Live Position Announcement Invariant', () => {
    it('drives an atomic polite status region through the whole gesture', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['alpha', 'beta', 'gamma'] });
          const { items, status, statusEl, cleanup } = buildReorder(props, [
            { value: 'alpha', label: 'Alpha' },
            { value: 'beta', label: 'Beta' },
            { value: 'gamma', label: 'Gamma' },
          ]);

          expect(statusEl.getAttribute('role')).toBe('status');
          expect(statusEl.getAttribute('aria-live')).toBe('polite');
          expect(statusEl.getAttribute('aria-atomic')).toBe('true');

          const seen: string[] = [];
          const sample = () => {
            const text = statusEl.textContent ?? '';
            if (text !== seen[seen.length - 1]) {
              seen.push(text);
            }
          };

          sample();

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');
          sample();

          press(items[0].handleEl, 'ArrowDown');
          sample();

          press(items[0].handleEl, 'ArrowDown');
          sample();

          press(items[0].handleEl, 'Enter');
          sample();

          // Pickup, each move, and the drop each said something new
          expect(seen.length).toBeGreaterThanOrEqual(4);
          expect(seen[0]).toBe('');
          for (const message of seen.slice(1)) {
            expect(message.trim().length).toBeGreaterThan(0);
          }

          // Cancellation is announced too
          press(items[1].handleEl, 'Enter');
          press(items[1].handleEl, 'ArrowDown');
          const beforeCancel = statusEl.textContent;
          press(items[1].handleEl, 'Escape');
          expect(statusEl.textContent).not.toBe(beforeCancel);

          status.destroy();
          cleanup();
        });
      }));

    it('keeps the announcer out of the interaction path', () =>
      scope.run(() => {
        component().run(() => {
          const { status, statusEl, cleanup } = buildReorder({ value: ['a'] }, [{ value: 'a', label: 'A' }]);

          expect(statusEl.hasAttribute('tabindex')).toBe(false);
          expect(status.attributes['aria-activedescendant']).toBeUndefined();

          const key = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          statusEl.dispatchEvent(key);
          expect(key.defaultPrevented).toBe(false);

          statusEl.click();
          expect(statusEl.textContent).toBe('');

          cleanup();
        });
      }));
  });
});
