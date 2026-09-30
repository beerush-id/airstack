import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SortProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildSort(
  props: Partial<SortProps>,
  keys: Array<{ key: string }>,
  host: 'native' | 'custom' = 'native',
) {
  const sort = aria('sort', props as SortProps);
  const tableEl = bind(document.createElement('table'), sort);
  document.body.appendChild(tableEl);

  const row = document.createElement('tr');
  tableEl.appendChild(row);

  const headers = keys.map(({ key }) => key).map((key, index) => {
    const header = aria('sort-header', { key });
    const headerEl = bind(
      document.createElement(host === 'native' ? 'th' : 'div'),
      header,
    ) as HTMLTableCellElement | HTMLElement;

    if (host === 'native') {
      headerEl.scope = 'col';
    }

    const trigger = aria('sort-trigger');
    const triggerEl = bind(document.createElement('button'), trigger);
    headerEl.appendChild(triggerEl);
    row.appendChild(headerEl);

    return { key, index, header, headerEl, trigger, triggerEl };
  });

  const cleanup = () => {
    for (const entry of headers) {
      entry.trigger.destroy();
      entry.header.destroy();
    }

    sort.destroy();
    tableEl.remove();
  };

  return { sort, tableEl, headers, cleanup };
}

const sorted = () =>
  Array.from(document.querySelectorAll('[aria-sort]')).map(
    (el) => `${el.dataset.key ?? ''}=${el.getAttribute('aria-sort')}`,
  );

describe('Sort - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Tri-State Cycle & Header Reflection Invariant', () => {
    it('cycles ascending, descending, then unsorted while the header carries the state', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: undefined });
          const { tableEl, headers, cleanup } = buildSort(props, [{ key: 'name' }]);

          const [name] = headers;
          name.headerEl.dataset.key = 'name';

          const commits: unknown[] = [];
          tableEl.addEventListener('change', (event) =>
            commits.push((event as CustomEvent).detail),
          );

          expect(name.headerEl.hasAttribute('aria-sort')).toBe(false);

          name.triggerEl.click();
          expect(props.value).toEqual({ key: 'name', direction: 'ascending' });
          expect(name.headerEl.getAttribute('aria-sort')).toBe('ascending');
          expect(commits).toEqual([{ key: 'name', direction: 'ascending' }]);

          name.triggerEl.click();
          expect(props.value).toEqual({ key: 'name', direction: 'descending' });
          expect(name.headerEl.getAttribute('aria-sort')).toBe('descending');

          // The unsorted state withdraws the attribute instead of naming it
          name.triggerEl.click();
          expect(props.value).toBeNull();
          expect(name.headerEl.getAttribute('aria-sort')).toBeNull();
          expect(name.headerEl.hasAttribute('aria-sort')).toBe(false);

          expect(commits).toHaveLength(3);
          expect(commits[2]).toBeNull();

          // The trigger never mirrors the state onto itself
          name.triggerEl.click();
          expect(name.triggerEl.hasAttribute('aria-sort')).toBe(false);
          expect(sorted()).toEqual(['name=ascending']);

          cleanup();
        });
      }));

    it('resumes the cycle from the coordinator state rather than from the header', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: { key: 'size', direction: 'descending' } });
          const { headers, cleanup } = buildSort(props, [{ key: 'size' }]);

          const [size] = headers;
          size.headerEl.dataset.key = 'size';

          expect(size.headerEl.getAttribute('aria-sort')).toBe('descending');

          size.triggerEl.click();
          expect(props.value).toBeNull();
          expect(size.headerEl.hasAttribute('aria-sort')).toBe(false);

          size.triggerEl.click();
          expect(props.value).toEqual({ key: 'size', direction: 'ascending' });

          cleanup();
        });
      }));

    it('reaches the same cycle from a custom trigger host and from the keyboard', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: undefined });
          const { headers, cleanup } = buildSort(props, [{ key: 'price' }], 'custom');

          const [price] = headers;
          price.headerEl.dataset.key = 'price';
          expect(price.headerEl.getAttribute('role')).toBe('columnheader');

          price.triggerEl.focus();

          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          price.triggerEl.dispatchEvent(enter);
          expect(props.value).toEqual({ key: 'price', direction: 'ascending' });

          const space = new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true,
          });
          price.triggerEl.dispatchEvent(space);
          const spaceUp = new KeyboardEvent('keyup', {
            key: ' ',
            bubbles: true,
            cancelable: true,
          });
          price.triggerEl.dispatchEvent(spaceUp);
          expect(props.value).toEqual({ key: 'price', direction: 'descending' });

          cleanup();
        });
      }));
  });

  describe('Host Parity & Table Header Scope Invariant', () => {
    it('leaves the header role to the native th and compiles it only on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const native = buildSort({ value: { key: 'a', direction: 'ascending' } }, [
            { key: 'a' },
            { key: 'b' },
          ]);

          // A <th scope="col"> is already a column header
          expect(native.headers[0].headerEl.hasAttribute('role')).toBe(false);
          expect(native.headers[0].headerEl.getAttribute('aria-sort')).toBe('ascending');
          expect(native.headers[1].headerEl.hasAttribute('aria-sort')).toBe(false);

          native.cleanup();

          const custom = buildSort({ value: undefined }, [{ key: 'a' }], 'custom');
          expect(custom.headers[0].headerEl.getAttribute('role')).toBe('columnheader');
          expect(custom.headers[0].headerEl.hasAttribute('aria-sort')).toBe(false);

          custom.cleanup();
        });
      }));

    it('names a row-axis header as a rowheader and keeps the sort single', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: undefined });
          const sort = aria('sort', props);
          const sortEl = bind(document.createElement('div'), sort);
          document.body.appendChild(sortEl);

          const header = aria('sort-header', { key: 'day', axis: 'row' });
          const headerEl = bind(document.createElement('div'), header);
          headerEl.dataset.key = 'day';
          sortEl.appendChild(headerEl);

          const trigger = aria('sort-trigger');
          const triggerEl = bind(document.createElement('button'), trigger);
          headerEl.appendChild(triggerEl);

          expect(headerEl.getAttribute('role')).toBe('rowheader');

          triggerEl.click();
          expect(props.value).toEqual({ key: 'day', direction: 'ascending' });
          expect(headerEl.getAttribute('aria-sort')).toBe('ascending');

          // The coordinator itself contributes no role or state
          expect(sortEl.hasAttribute('role')).toBe(false);
          expect(sortEl.hasAttribute('aria-sort')).toBe(false);

          sort.destroy();
          header.destroy();
          trigger.destroy();
          sortEl.remove();
        });
      }));
  });

  describe('Single-Column Sort Exclusivity Invariant', () => {
    it('moves the single aria-sort between headers as the criterion changes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: { key: 'name', direction: 'ascending' } });
          const { headers, cleanup } = buildSort(props, [
            { key: 'name' },
            { key: 'size' },
            { key: 'price' },
          ]);

          for (const entry of headers) {
            entry.headerEl.dataset.key = entry.key;
          }

          expect(sorted()).toEqual(['name=ascending']);

          headers[2].triggerEl.click();
          expect(props.value).toEqual({ key: 'price', direction: 'ascending' });
          expect(sorted()).toEqual(['price=ascending']);
          expect(headers[0].headerEl.hasAttribute('aria-sort')).toBe(false);

          headers[2].triggerEl.click();
          expect(sorted()).toEqual(['price=descending']);

          // Returning the criterion to null leaves no header marked anywhere
          headers[2].triggerEl.click();
          expect(props.value).toBeNull();
          expect(sorted()).toEqual([]);

          cleanup();
        });
      }));

    it('freezes the cycle while the coordinator is disabled and releases it again', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SortProps>({ value: undefined, disabled: true });
          const { tableEl, headers, cleanup } = buildSort(props, [{ key: 'kind' }]);

          const [kind] = headers;
          kind.headerEl.dataset.key = 'kind';

          const commits: unknown[] = [];
          tableEl.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));

          kind.triggerEl.click();
          kind.triggerEl.click();
          expect(props.value).toBeUndefined();
          expect(commits).toEqual([]);
          expect(kind.headerEl.hasAttribute('aria-sort')).toBe(false);
          expect(kind.headerEl.getAttribute('aria-disabled')).toBe('true');

          props.disabled = false;
          expect(kind.headerEl.getAttribute('aria-disabled')).toBe('false');

          kind.triggerEl.click();
          expect(props.value).toEqual({ key: 'kind', direction: 'ascending' });
          expect(commits).toEqual([{ key: 'kind', direction: 'ascending' }]);

          cleanup();
        });
      }));
  });
});
