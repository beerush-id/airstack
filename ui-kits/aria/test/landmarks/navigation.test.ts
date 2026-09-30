import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type NavigationProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Navigation - Landmark Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Navigation Landmark Scope Invariant', () => {
    it('relies on the native nav element for the role and compiles it for a generic host', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<NavigationProps>({ label: 'Primary' });
          const native = aria('navigation', props);
          const nativeEl = bind(document.createElement('nav'), native);
          document.body.appendChild(nativeEl);

          const custom = aria('navigation', { label: 'Primary' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(native.attributes.role).toBeUndefined();
          expect(customEl.getAttribute('role')).toBe('navigation');

          expect(nativeEl.getAttribute('aria-label')).toBe('Primary');
          expect(customEl.getAttribute('aria-label')).toBe('Primary');

          props.label = undefined;
          expect(nativeEl.hasAttribute('aria-label')).toBe(false);

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));

    it('does not name a second navigation on its own behalf', () =>
      scope.run(() => {
        component().run(() => {
          const primary = aria('navigation');
          const primaryEl = bind(document.createElement('nav'), primary);

          const secondary = aria('navigation');
          const secondaryEl = bind(document.createElement('nav'), secondary);

          document.body.append(primaryEl, secondaryEl);

          // Two unnamed navigations are indistinguishable to a screen reader, and the
          // controller leaves that to the author rather than inventing a fallback name
          expect(primaryEl.hasAttribute('aria-label')).toBe(false);
          expect(secondaryEl.hasAttribute('aria-label')).toBe(false);
          expect(primaryEl.hasAttribute('role')).toBe(false);
          expect(secondaryEl.hasAttribute('role')).toBe(false);

          primary.assign({ label: 'Main menu' });
          secondary.assign({ label: 'Footer links' });
          expect(primaryEl.getAttribute('aria-label')).toBe('Main menu');
          expect(secondaryEl.getAttribute('aria-label')).toBe('Footer links');

          primary.destroy();
          secondary.destroy();
          primaryEl.remove();
          secondaryEl.remove();
        });
      }));
  });

  describe('Label Demarcation & Multi-Nav Disambiguation Invariant', () => {
    it('labels the landmark without touching the links it contains', () =>
      scope.run(() => {
        component().run(() => {
          const nav = aria('navigation', { labelledby: 'site-map-heading' });
          const navEl = bind(document.createElement('nav'), nav);
          document.body.appendChild(navEl);

          const heading = document.createElement('h2');
          heading.id = 'site-map-heading';
          heading.textContent = 'Site map';
          document.body.appendChild(heading);

          const first = aria('link', { href: '/docs' });
          const second = aria('link', { href: '/pricing' });
          const firstEl = bind(document.createElement('a'), first);
          const secondEl = bind(document.createElement('a'), second);
          firstEl.href = '/docs';
          secondEl.href = '/pricing';
          navEl.append(firstEl, secondEl);

          expect(navEl.getAttribute('aria-labelledby')).toBe('site-map-heading');
          expect(navEl.hasAttribute('aria-label')).toBe(false);

          // The landmark label never leaks onto the links themselves
          for (const el of [firstEl, secondEl]) {
            expect(el.hasAttribute('aria-label')).toBe(false);
            expect(el.hasAttribute('aria-labelledby')).toBe(false);
            expect(el.hasAttribute('role')).toBe(false);
          }

          // The links keep their own navigation contract
          const click = new MouseEvent('click', { bubbles: true, cancelable: true });
          firstEl.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);

          nav.destroy();
          first.destroy();
          second.destroy();
          navEl.remove();
          heading.remove();
        });
      }));

    it('stays a structural landmark for grouping and takes no roving focus', () =>
      scope.run(() => {
        component().run(() => {
          const nav = aria('navigation', { label: 'Sections' });
          const navEl = bind(document.createElement('div'), nav);
          document.body.appendChild(navEl);

          expect(navEl.getAttribute('role')).toBe('navigation');
          expect(navEl.hasAttribute('tabindex')).toBe(false);
          expect(navEl.hasAttribute('aria-orientation')).toBe(false);
          expect(navEl.hasAttribute('aria-activedescendant')).toBe(false);
          expect(nav.attributes['aria-multiselectable']).toBeUndefined();

          const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          navEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          nav.destroy();
          navEl.remove();
        });
      }));
  });
});
