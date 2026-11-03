import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SearchInputProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('SearchInput - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Search Query State & Submission Invariant', () => {
    it('propagates every keystroke synchronously and mirrors the query in both directions', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SearchInputProps>({ value: '' });
          const search = aria('search-input', props);

          // 1. Creation & SSR: the query is never a compiled attribute
          expect(search.current).toBeNull();
          expect(search.value).toBe('');
          expect(search.attributes.value).toBeUndefined();
          expect(search.attributes.type).toBe('search');

          // 2. DOM Binding
          const el = bind(document.createElement('input'), search);
          expect(el.type).toBe('search');
          expect(el.value).toBe('');

          // 3. Live query synchronization, one update per keystroke with no trailing collapse
          el.value = 'r';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(search.value).toBe('r');

          el.value = 'ru';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(search.value).toBe('ru');
          expect(props.value).toBe('ru');

          el.value = 'run';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(search.value).toBe('run');

          // 4. Programmatic writes reach the field immediately
          search.value = 'rust';
          expect(el.value).toBe('rust');
          expect(props.value).toBe('rust');

          // 5. A native host keeps Enter for the platform's own submission
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);
          expect(enter.defaultPrevented).toBe(false);

          // 6. Teardown
          search.destroy();
          expect(search.current).toBeNull();

          props.value = 'later';
          expect(el.value).toBe('rust');
        });
      }));

    it('reflects validation state through ARIA while keeping the field native', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SearchInputProps>({
            value: '',
            label: 'Search documentation',
            placeholder: 'Type to search',
            required: true,
            invalid: 'spelling',
          });
          const search = aria('search-input', props);

          expect(search.attributes['aria-label']).toBe('Search documentation');
          expect(search.attributes['aria-required']).toBe('true');
          expect(search.attributes['aria-invalid']).toBe('spelling');
          expect(search.attributes.placeholder).toBe('Type to search');

          const el = bind(document.createElement('input'), search);
          expect(el.getAttribute('aria-required')).toBe('true');
          expect(el.type).toBe('search');
          expect(el.hasAttribute('role')).toBe(false);

          // Clearing the invalid flag states it rather than dropping it
          props.invalid = false;
          expect(el.getAttribute('aria-invalid')).toBe('false');

          props.required = false;
          expect(el.getAttribute('aria-required')).toBe('false');

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));
  });

  describe('Semantic Role Specialization Invariant', () => {
    it('compiles no role because the search type already names the control', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const search = aria('search-input', { value: '' });

          expect(search.attributes.role).toBeUndefined();
          expect(search.attributes.type).toBe('search');
          expect(search.attributes.tabindex).toBeUndefined();

          const el = bind(document.createElement('input'), search);
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // The field is an input, so it takes the browser's own mechanics untouched
          for (const key of ['ArrowDown', 'Escape', 'Enter', ' ']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));

    it('states validity explicitly and omits the optional presentation keys', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bare = aria('search-input');
          expect(bare.value).toBe('');
          expect(bare.attributes['aria-invalid']).toBe('false');
          expect(bare.attributes.placeholder).toBeUndefined();
          expect(bare.attributes['aria-label']).toBeUndefined();
          expect(bare.attributes['aria-readonly']).toBeUndefined();
          expect(bare.attributes['aria-disabled']).toBeUndefined();

          const readonlyField = aria('search-input', { readonly: true, disabled: true });
          const el = bind(document.createElement('input'), readonlyField);

          expect(el.readOnly).toBe(true);
          expect(el.disabled).toBe(true);

          bare.destroy();
          readonlyField.destroy();
        });
      }));
  });

  describe('Host Parity & Clear Action Invariant', () => {
    it('agrees with the text-input face on the compiled search type', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const searchFace = aria('search-input', { value: 'query' });
          const textFace = aria('text-input', { kind: 'search', value: 'query' });

          expect(searchFace.attributes.type).toBe('search');
          expect(textFace.attributes.type).toBe('search');

          const searchEl = bind(document.createElement('input'), searchFace);
          expect(searchEl.value).toBe('query');

          // The dedicated face never takes the role that text-input compiles for custom hosts
          expect(searchFace.attributes.role).toBeUndefined();

          searchFace.destroy();
          textFace.destroy();
        });
      }));

    it('reads a cleared field as an empty query without inventing a clear event', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SearchInputProps>({ value: 'rust' });
          const search = aria('search-input', props);
          const el = bind(document.createElement('input'), search);

          const events: string[] = [];
          for (const type of ['search', 'cancel', 'clear']) {
            el.addEventListener(type, () => events.push(type));
          }

          // The native cancel affordance reports through the standard input sequence
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));

          expect(search.value).toBe('');
          expect(props.value).toBe('');
          expect(events).toEqual([]);

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));
  });
});
