import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SearchInputProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('SearchInput - Coverage (face specialization & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Face Specialization Contract', () => {
    it('compiles the searchbox role on a custom host through the face alone', () =>
      scope.run(() => {
        component().run(() => {
          const search = aria<HTMLDivElement>('search-input', { value: 'q' }, { native: false });
          const el = bind(document.createElement('div'), search);

          expect(search.attributes.role).toBe('searchbox');
          expect(el.getAttribute('role')).toBe('searchbox');
          expect(el.getAttribute('tabindex')).toBe('0');

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));

    it('states aria-required false by default on a native search host', () =>
      scope.run(() => {
        component().run(() => {
          const search = aria('search-input', { value: '' });

          expect(search.attributes['aria-required']).toBe('false');

          const el = bind(document.createElement('input'), search);
          expect(el.getAttribute('aria-required')).toBe('false');

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));

    it('commits blur edits carrying the query on a custom search host', () =>
      scope.run(() => {
        component().run(() => {
          const search = aria<HTMLDivElement>('search-input', { value: '' }, { native: false });
          const el = bind(document.createElement('div'), search);

          const commits: unknown[] = [];
          el.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));

          search.assign({ value: 'query' });
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual(['query']);

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));

    it('leaves every keystroke to the platform on a custom search host', () =>
      scope.run(() => {
        component().run(() => {
          const search = aria<HTMLDivElement>('search-input', { value: '' }, { native: false });
          const el = bind(document.createElement('div'), search);

          for (const key of ['Enter', 'Escape', 'ArrowDown', ' ']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }
          expect(search.value).toBe('');

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SearchInputProps>({ value: 'q', label: 'Search' });
          const search = aria('search-input', props);

          for (const key of ['value', 'label', 'disabled', 'aria-invalid', 'tabindex']) {
            expect(search.ownKeys).toContain(key);
          }

          search.destroy();
          expect(search.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('constructs without frozen reactive reads outside a reactive boundary', () =>
      scope.run(() => {
        const reads: string[] = [];
        const restore = setStaticTracker((_init, key) => {
          if (typeof key === 'symbol') return;
          reads.push(String(key));
        });
        try {
          const search = aria('search-input', { value: 'q', label: 'Search' });
          search.destroy();
        } finally {
          restore();
        }
        expect(reads).toEqual([]);
      }));
  });
});
