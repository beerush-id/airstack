import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type PaginationProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Pagination - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('labels the landmark before any element binds', () =>
    scope.run(() => {
      component().run(() => {
        const nav = aria('pagination');

        expect(nav.attributes.role).toBeUndefined();
        expect(nav.attributes['aria-label']).toBe('Pagination');

        nav.destroy();
      });
    }));

  it('recompiles aria-label when the label prop changes', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<Partial<PaginationProps>>({});
        const nav = aria('pagination', props);
        const navEl = bind(document.createElement('nav'), nav);
        document.body.append(navEl);

        expect(navEl.getAttribute('aria-label')).toBe('Pagination');

        props.label = 'Search results pages';
        expect(navEl.getAttribute('aria-label')).toBe('Search results pages');

        nav.destroy();
        navEl.remove();
      });
    }));

  it('roves nothing and swallows nothing when it holds no page link', () =>
    scope.run(() => {
      component().run(() => {
        const nav = aria('pagination', {});
        const navEl = bind(document.createElement('nav'), nav);
        document.body.append(navEl);

        for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          navEl.dispatchEvent(event);

          expect(event.defaultPrevented).toBe(false);
        }

        nav.destroy();
        navEl.remove();
      });
    }));

  it('releases the key handler on destroy', () =>
    scope.run(() => {
      component().run(() => {
        const nav = aria('pagination', {});
        const navEl = bind(document.createElement('nav'), nav);
        document.body.append(navEl);

        const first = document.createElement('a');
        first.href = '?p=1';
        const second = document.createElement('a');
        second.href = '?p=2';
        navEl.append(first, second);

        first.focus();
        nav.destroy();

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        navEl.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(first);

        navEl.remove();
      });
    }));

  it('exposes its compiled keys and releases the element on teardown', () =>
    scope.run(() => {
      component().run(() => {
        const nav = aria('pagination', { label: 'Results' });
        const navEl = bind(document.createElement('div'), nav);
        document.body.append(navEl);

        for (const key of ['label', 'role', 'aria-label']) {
          expect(nav.ownKeys).toContain(key);
        }

        expect(nav.label).toBe('Results');

        nav.destroy();
        expect(nav.current).toBeNull();

        navEl.remove();
      });
    }));
});
