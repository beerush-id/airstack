import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type HeaderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Header - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Landmark Scoping & Banner Invariant', () => {
    it('compiles no redundant role on a document-scoped native header', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<HeaderProps>({});
          const header = aria('header', props, { native: true });
          const el = bind(document.createElement('header'), header);
          document.body.appendChild(el);

          expect(header.attributes.role).toBeUndefined();
          expect(el.hasAttribute('role')).toBe(false);

          expect(el.parentElement).toBe(document.body);

          props.label = 'Site identity';
          expect(el.getAttribute('aria-label')).toBe('Site identity');
          expect(el.hasAttribute('role')).toBe(false);

          header.destroy();
          el.remove();
        });
      }));

    it('compiles the banner on a custom host nested in a section while the native header stays unroled', () =>
      scope.run(() => {
        component().run(() => {
          const article = document.createElement('article');
          document.body.appendChild(article);

          const nativeScoped = aria('header', {}, { native: true });
          const nativeEl = bind(document.createElement('header'), nativeScoped);
          article.appendChild(nativeEl);

          const customScoped = aria('header', {}, { native: false });
          const customEl = bind(document.createElement('div'), customScoped);
          article.appendChild(customEl);

          expect(nativeEl.hasAttribute('role')).toBe(false);

          expect(customEl.getAttribute('role')).toBe('banner');
          expect(customScoped.attributes.role).toBe('banner');

          nativeScoped.destroy();
          customScoped.destroy();
          article.remove();
        });
      }));
  });

  describe('Native vs Custom Host Parity Invariant', () => {
    it('names the landmark the same way on both hosts and adds no interaction', () =>
      scope.run(() => {
        component().run(() => {
          const native = aria('header', { label: 'Primary' }, { native: true });
          const nativeEl = bind(document.createElement('header'), native);

          const custom = aria('header', { label: 'Primary' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);

          document.body.append(nativeEl, customEl);

          expect(nativeEl.getAttribute('aria-label')).toBe('Primary');
          expect(customEl.getAttribute('aria-label')).toBe('Primary');
          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(customEl.getAttribute('role')).toBe('banner');

          for (const el of [nativeEl, customEl]) {
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(el.hasAttribute('aria-live')).toBe(false);
            expect(el.hasAttribute('aria-expanded')).toBe(false);
          }

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));

    it('moves the accessible name from a string to a reference without losing the landmark', () =>
      scope.run(() => {
        component().run(() => {
          const title = document.createElement('h1');
          title.id = 'site-title';
          document.body.appendChild(title);

          const props = mutable<HeaderProps>({ label: 'Fallback name' });
          const header = aria('header', props);
          const el = bind(document.createElement('div'), header);
          document.body.appendChild(el);

          expect(el.getAttribute('aria-label')).toBe('Fallback name');
          expect(el.hasAttribute('aria-labelledby')).toBe(false);

          props.label = undefined;
          props.labelledby = 'site-title';
          expect(el.hasAttribute('aria-label')).toBe(false);
          expect(el.getAttribute('aria-labelledby')).toBe('site-title');
          expect(el.getAttribute('role')).toBe('banner');

          header.destroy();
          el.remove();
          title.remove();
        });
      }));
  });
});
