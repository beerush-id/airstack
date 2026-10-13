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
          const native = aria('navigation', props, { native: true });
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
          const primary = aria('navigation', {}, { native: true });
          const primaryEl = bind(document.createElement('nav'), primary);

          const secondary = aria('navigation', {}, { native: true });
          const secondaryEl = bind(document.createElement('nav'), secondary);

          document.body.append(primaryEl, secondaryEl);

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
          const nav = aria('navigation', { labelledby: 'site-map-heading' }, { native: true });
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

          for (const el of [firstEl, secondEl]) {
            expect(el.hasAttribute('aria-label')).toBe(false);
            expect(el.hasAttribute('aria-labelledby')).toBe(false);
            expect(el.hasAttribute('role')).toBe(false);
          }

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

    it('roves the links it contains and keeps the container out of the tab order', () =>
      scope.run(() => {
        component().run(() => {
          const nav = aria('navigation', { label: 'Sections' }, { native: false });
          const navEl = bind(document.createElement('div'), nav);
          document.body.appendChild(navEl);

          expect(navEl.getAttribute('role')).toBe('navigation');
          expect(navEl.hasAttribute('tabindex')).toBe(false);

          const first = document.createElement('a');
          first.href = '#one';
          const second = document.createElement('a');
          second.href = '#two';
          navEl.append(first, second);

          first.focus();

          const down = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          navEl.dispatchEvent(down);
          expect(down.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(second);

          const up = new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            bubbles: true,
            cancelable: true,
          });
          navEl.dispatchEvent(up);
          expect(document.activeElement).toBe(first);

          const end = new KeyboardEvent('keydown', {
            key: 'End',
            bubbles: true,
            cancelable: true,
          });
          navEl.dispatchEvent(end);
          expect(document.activeElement).toBe(second);

          nav.destroy();
          navEl.remove();
        });
      }));

    it('compiles a bare navigation with the native default and invents no name', () =>
      scope.run(() => {
        component().run(() => {
          const nav = aria('navigation');
          const navEl = bind(document.createElement('nav'), nav);
          document.body.appendChild(navEl);

          expect(nav.label).toBeUndefined();
          expect(nav.attributes.role).toBeUndefined();
          expect(navEl.hasAttribute('role')).toBe(false);
          expect(navEl.hasAttribute('aria-label')).toBe(false);
          expect(navEl.hasAttribute('aria-labelledby')).toBe(false);

          nav.destroy();
          navEl.remove();
        });
      }));
  });
});
