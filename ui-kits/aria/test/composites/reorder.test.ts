import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ReorderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildReorder(props: Partial<ReorderProps>, items: Array<{ value: string; label?: string }>) {
  const reorder = aria('reorder', props as ReorderProps);
  const listEl = bind(document.createElement('ul'), reorder);
  document.body.appendChild(listEl);

  const built = items.map(({ value, label }) => {
    const slot = component();
    return slot.run(() => {
      const item = aria('reorder-item', { value, label });
      const itemEl = bind(document.createElement('li'), item);

      const handle = aria('reorder-handle', { label: label ? `Move ${label}` : undefined });
      const handleEl = bind(document.createElement('button'), handle);

      itemEl.appendChild(handleEl);
      listEl.appendChild(itemEl);
      return { value, label, item, itemEl, handle, handleEl };
    });
  });

  const cleanup = () => {
    for (const entry of built) {
      entry.handle.destroy();
      entry.item.destroy();
    }

    reorder.destroy();
    listEl.remove();
  };

  return { reorder, listEl, items: built, cleanup };
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
    it('picks up with the keyboard, moves slot by slot with clamping, and commits on the second press', () =>
      scope.run(() => {
        component().run(() => {
          const inputs: string[][] = [];
          const props = mutable<ReorderProps>({
            label: 'Pipeline stages',
            value: ['build', 'test', 'deploy'],
            oninput: (e) => inputs.push([...(e.detail as AnyType)]),
          });
          const { listEl, items, cleanup } = buildReorder(props, [
            { value: 'build', label: 'Build' },
            { value: 'test', label: 'Test' },
            { value: 'deploy', label: 'Deploy' },
          ]);

          expect(listEl.getAttribute('aria-label')).toBe('Pipeline stages');
          expect(items[0].handleEl.getAttribute('aria-label')).toBe('Move Build');
          expect(items[0].handleEl.type).toBe('button');

          items[0].handleEl.focus();
          expect(press(items[0].handleEl, 'Enter').defaultPrevented).toBe(true);

          expect(props.active).toBe('build');
          expect(props.preview).toEqual(['build', 'test', 'deploy']);

          press(items[0].handleEl, 'ArrowUp');
          expect(props.preview).toEqual(['build', 'test', 'deploy']);
          expect(inputs).toEqual([]);

          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['test', 'build', 'deploy']);
          expect(props.value).toEqual(['build', 'test', 'deploy']);
          expect(inputs).toEqual([['test', 'build', 'deploy']]);

          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['test', 'deploy', 'build']);

          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['test', 'deploy', 'build']);
          expect(inputs).toHaveLength(2);

          press(items[0].handleEl, 'ArrowUp');
          expect(props.preview).toEqual(['test', 'build', 'deploy']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['test', 'build', 'deploy']);
          expect(props.active).toBeNull();

          cleanup();
        });
      }));

    it('marks the held item and its handle with data-active, and leaves idle ones unmarked', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['a', 'b'] });
          const { items, cleanup } = buildReorder(props, [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ]);

          expect(items.every((entry) => !entry.itemEl.hasAttribute('data-active'))).toBe(true);
          expect(items.every((entry) => !entry.handleEl.hasAttribute('data-active'))).toBe(true);

          press(items[0].handleEl, 'Enter');
          expect(items[0].itemEl.getAttribute('data-active')).toBe('true');
          expect(items[0].handleEl.getAttribute('data-active')).toBe('true');
          expect(items[1].handleEl.hasAttribute('data-active')).toBe(false);

          press(items[0].handleEl, 'Enter');
          expect(items[0].itemEl.hasAttribute('data-active')).toBe(false);
          expect(items[0].handleEl.hasAttribute('data-active')).toBe(false);

          cleanup();
        });
      }));

    it('supports Home and End keys during active reorder', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ReorderProps>({ value: ['a', 'b', 'c', 'd'] });
          const { items, cleanup } = buildReorder(props, [
            { value: 'a' },
            { value: 'b' },
            { value: 'c' },
            { value: 'd' },
          ]);

          items[1].handleEl.focus();
          press(items[1].handleEl, 'Enter');
          expect(props.active).toBe('b');

          press(items[1].handleEl, 'End');
          expect(props.preview).toEqual(['a', 'c', 'd', 'b']);

          press(items[1].handleEl, 'Home');
          expect(props.preview).toEqual(['b', 'a', 'c', 'd']);

          press(items[1].handleEl, 'Enter');
          expect(props.value).toEqual(['b', 'a', 'c', 'd']);
          expect(props.active).toBeNull();

          cleanup();
        });
      }));

    it('cancels on Escape and on Tab, restoring the committed order and invoking oncancel', () =>
      scope.run(() => {
        component().run(() => {
          const canceled: string[] = [];
          const props = mutable<ReorderProps>({
            value: ['a', 'b', 'c'],
            oncancel: (e) => canceled.push(e.detail as AnyType),
          });
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

          expect(press(items[2].handleEl, 'Escape').defaultPrevented).toBe(true);

          expect(props.value).toEqual(['a', 'b', 'c']);
          expect(props.active).toBeNull();
          expect(props.preview).toEqual(['a', 'b', 'c']);
          expect(canceled).toEqual(['c']);

          press(items[0].handleEl, 'Enter');
          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['b', 'a', 'c']);

          expect(press(items[0].handleEl, 'Tab').defaultPrevented).toBe(false);
          expect(props.value).toEqual(['a', 'b', 'c']);
          expect(props.preview).toEqual(['a', 'b', 'c']);
          expect(props.active).toBeNull();
          expect(canceled).toEqual(['c', 'a']);

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

          expect(press(items[0].handleEl, 'ArrowDown').defaultPrevented).toBe(false);
          expect(props.preview).toEqual(['y', 'x', 'z']);

          press(items[0].handleEl, 'ArrowLeft');
          expect(props.preview).toEqual(['x', 'y', 'z']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['x', 'y', 'z']);

          cleanup();
        });
      }));

    it('drags with the pointer across sibling item midpoints and commits on pointerup', () =>
      scope.run(() => {
        component().run(() => {
          const inputs: string[][] = [];
          const commits: string[][] = [];
          const cancels: string[] = [];
          const props = mutable<ReorderProps>({
            value: ['a', 'b', 'c'],
            oninput: (e) => inputs.push([...(e.detail as AnyType)]),
            onchange: (e) => commits.push([...e.detail] as AnyType),
            oncancel: (e) => cancels.push(e.detail as AnyType),
          });
          const { items, cleanup } = buildReorder(props, [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
          ]);

          items.forEach((entry, idx) => {
            entry.itemEl.getBoundingClientRect = () =>
              ({
                top: idx * 40,
                bottom: (idx + 1) * 40,
                left: 0,
                right: 200,
                width: 200,
                height: 40,
                x: 0,
                y: idx * 40,
                toJSON: () => ({}),
              }) as DOMRect;
          });

          items[0].handleEl.dispatchEvent(
            new PointerEvent('pointerdown', { button: 0, clientX: 20, clientY: 10, bubbles: true, cancelable: true })
          );
          expect(props.active).toBe('a');
          expect(props.preview).toEqual(['a', 'b', 'c']);

          window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 65, bubbles: true }));
          expect(props.preview).toEqual(['b', 'a', 'c']);
          expect(inputs).toEqual([['b', 'a', 'c']]);

          window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 105, bubbles: true }));
          expect(props.preview).toEqual(['b', 'c', 'a']);
          expect(inputs).toEqual([
            ['b', 'a', 'c'],
            ['b', 'c', 'a'],
          ]);

          window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 105, bubbles: true }));
          items[0].handleEl.click();
          expect(props.active).toBeNull();
          expect(props.value).toEqual(['b', 'c', 'a']);
          expect(commits).toEqual([['b', 'c', 'a']]);

          items[2].handleEl.dispatchEvent(
            new PointerEvent('pointerdown', { button: 0, clientX: 20, clientY: 100, bubbles: true, cancelable: true })
          );
          expect(props.active).toBe('c');
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 10, bubbles: true }));
          expect(props.preview).toEqual(['c', 'b', 'a']);

          window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
          expect(props.active).toBeNull();
          expect(props.value).toEqual(['b', 'c', 'a']);
          expect(cancels).toEqual(['c']);

          cleanup();
        });
      }));
  });

  describe('Preview vs Committed Order Invariant', () => {
    it('keeps the committed order untouched until a changed drop publishes it once', () =>
      scope.run(() => {
        component().run(() => {
          const commits: string[][] = [];
          const props = mutable<ReorderProps>({
            value: ['one', 'two', 'three'],
            onchange: (e) => commits.push([...(e.detail as AnyType)]),
          });
          const { listEl, items, cleanup } = buildReorder(props, [
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
            { value: 'three', label: 'Three' },
          ]);

          const domCommits: unknown[] = [];
          listEl.addEventListener('change', (event) => domCommits.push((event as CustomEvent).detail));

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');

          press(items[0].handleEl, 'ArrowDown');
          press(items[0].handleEl, 'ArrowUp');

          expect(props.preview).toEqual(['one', 'two', 'three']);
          expect(props.value).toEqual(['one', 'two', 'three']);

          press(items[0].handleEl, 'Enter');
          expect(props.active).toBeNull();
          expect(commits).toEqual([]);
          expect(domCommits).toEqual([]);

          press(items[0].handleEl, 'Enter');
          press(items[0].handleEl, 'ArrowDown');
          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['two', 'three', 'one']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['two', 'three', 'one']);
          expect(commits).toEqual([['two', 'three', 'one']]);
          expect(domCommits).toEqual([['two', 'three', 'one']]);

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

          expect(press(handle, 'Enter').defaultPrevented).toBe(true);
          expect(props.active).toBeUndefined();
          expect(props.preview).toBeUndefined();

          press(handle, 'ArrowDown');
          expect(props.value).toEqual(['a', 'b']);

          props.disabled = false;
          press(handle, 'Enter');
          expect(props.active).toBe('a');

          press(handle, 'Escape');
          expect(props.active).toBeNull();

          cleanup();
        });
      }));

    it('allows active items to move past a disabled item while keeping the disabled item locked from initiating', () =>
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

          items[1].handleEl.focus();
          press(items[1].handleEl, 'Enter');
          expect(props.active).toBeUndefined();

          items[0].handleEl.focus();
          press(items[0].handleEl, 'Enter');
          expect(props.active).toBe('free');

          press(items[0].handleEl, 'ArrowDown');
          expect(props.preview).toEqual(['locked', 'free', 'last']);

          press(items[0].handleEl, 'Enter');
          expect(props.value).toEqual(['locked', 'free', 'last']);

          cleanup();
        });
      }));
  });
});
