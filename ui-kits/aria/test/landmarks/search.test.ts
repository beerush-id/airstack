import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SearchProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Search - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Search Purpose Landmark Invariant', () => {
    it('treats the native search element as already announcing the purpose', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SearchProps>({ label: 'Site search' });
          const native = aria('search', props, { native: true });
          const nativeEl = bind(document.createElement('search'), native);
          document.body.appendChild(nativeEl);

          expect(native.attributes.role).toBeUndefined();
          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(nativeEl.getAttribute('aria-label')).toBe('Site search');

          props.label = undefined;
          expect(nativeEl.hasAttribute('aria-label')).toBe(false);

          native.destroy();
          nativeEl.remove();
        });
      }));

    it('compiles the role for a form standing in for the search element', () =>
      scope.run(() => {
        component().run(() => {
          const custom = aria('search', { label: 'Products' }, { native: false });
          const customEl = bind(document.createElement('form'), custom);
          document.body.appendChild(customEl);

          expect(custom.attributes.role).toBe('search');
          expect(customEl.getAttribute('role')).toBe('search');
          expect(customEl.getAttribute('aria-label')).toBe('Products');

          expect(customEl.hasAttribute('action')).toBe(false);
          expect(customEl.hasAttribute('method')).toBe(false);
          expect(customEl.hasAttribute('tabindex')).toBe(false);

          const input = aria('search-input', { value: '' });
          const inputEl = bind(document.createElement('input'), input);
          inputEl.name = 'q';
          customEl.appendChild(inputEl);

          inputEl.value = 'anchor';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('anchor');
          expect(customEl.getAttribute('role')).toBe('search');
          expect(inputEl.hasAttribute('role')).toBe(false);

          custom.destroy();
          input.destroy();
          customEl.remove();
        });
      }));
  });

  describe('Query Scope Demarcation Invariant', () => {
    it('wraps the query controls without naming them a second time', () =>
      scope.run(() => {
        component().run(() => {
          const search = aria('search');
          const searchEl = bind(document.createElement('div'), search);
          document.body.appendChild(searchEl);

          expect(searchEl.getAttribute('role')).toBe('search');
          expect(searchEl.hasAttribute('aria-label')).toBe(false);

          const button = aria('button');
          const buttonEl = bind(document.createElement('button'), button);
          buttonEl.textContent = 'Search';
          searchEl.appendChild(buttonEl);

          expect(buttonEl.getAttribute('type')).toBe('button');
          expect(buttonEl.hasAttribute('aria-label')).toBe(false);
          expect(searchEl.contains(buttonEl)).toBe(true);

          const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
          });
          buttonEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          search.destroy();
          button.destroy();
          searchEl.remove();
        });
      }));
  });
});
