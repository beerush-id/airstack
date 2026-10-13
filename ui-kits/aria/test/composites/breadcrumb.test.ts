import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

function trail(crumbs: Array<string | { href: string; disabled?: boolean; current?: boolean }>, label?: string) {
  const crumb = aria('breadcrumb', label === undefined ? {} : { label });
  const crumbEl = bind(document.createElement('nav'), crumb);
  document.body.appendChild(crumbEl);

  const links = crumbs.map((entry) => {
    const { href, disabled, current } =
      typeof entry === 'string' ? { href: entry, disabled: undefined, current: undefined } : entry;
    const link = aria('link', { href, disabled, current });
    const el = bind(document.createElement('a'), link);
    el.href = href;
    crumbEl.appendChild(el);
    return { link, el };
  });

  const cleanup = () => {
    for (const { link } of links) {
      link.destroy();
    }

    crumb.destroy();
    crumbEl.remove();
  };

  return { crumb, crumbEl, links, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const focusedHref = () => (document.activeElement as HTMLElement)?.getAttribute('href') ?? null;

describe('Breadcrumb - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Trail Landmark Invariant', () => {
    it('names the trail without duplicating the native navigation role', () =>
      scope.run(() => {
        component().run(() => {
          const { crumb, crumbEl, cleanup } = trail(['/docs', '/docs/aria']);

          expect(crumb.attributes.role).toBeUndefined();
          expect(crumbEl.getAttribute('role')).toBeNull();
          expect(crumbEl.getAttribute('aria-label')).toBe('Breadcrumbs');

          cleanup();

          const custom = aria('breadcrumb', {}, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(customEl.getAttribute('role')).toBe('navigation');
          expect(customEl.getAttribute('aria-label')).toBe('Breadcrumbs');

          custom.destroy();
          customEl.remove();

          const labelled = aria('breadcrumb', { label: 'Documentation path' });
          const labelledEl = bind(document.createElement('div'), labelled);
          document.body.appendChild(labelledEl);

          expect(labelledEl.getAttribute('aria-label')).toBe('Documentation path');

          labelled.destroy();
          labelledEl.remove();
        });
      }));
  });

  describe('Wrapping Traversal Invariant', () => {
    it('moves focus between crumbs and wraps at both ends', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = trail(['/a', '/b', '/c']);

          links[0].el.focus();

          press(links[0].el, 'ArrowRight');
          expect(focusedHref()).toBe('/b');

          press(links[1].el, 'ArrowRight');
          expect(focusedHref()).toBe('/c');

          press(links[2].el, 'ArrowRight');
          expect(focusedHref()).toBe('/a');

          press(links[0].el, 'ArrowLeft');
          expect(focusedHref()).toBe('/c');

          press(links[2].el, 'Home');
          expect(focusedHref()).toBe('/a');

          press(links[0].el, 'End');
          expect(focusedHref()).toBe('/c');

          cleanup();
        });
      }));

    it('passes over disabled crumbs and separators in every direction', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links, cleanup } = trail([
            { href: '/a' },
            { href: '/gone', disabled: true },
            { href: '/c' },
          ]);

          const separator = bind(document.createElement('span'), aria('breadcrumb-separator'));
          separator.textContent = '/';
          crumbEl.insertBefore(separator, links[2].el);

          links[0].el.focus();

          press(links[0].el, 'ArrowRight');
          expect(focusedHref()).toBe('/c');

          press(links[2].el, 'ArrowLeft');
          expect(focusedHref()).toBe('/a');

          press(links[2].el, 'End');
          expect(focusedHref()).toBe('/c');

          press(links[0].el, 'Home');
          expect(focusedHref()).toBe('/a');

          separator.remove();
          cleanup();
        });
      }));

    it('leaves the vertical arrows and activation to the browser and the links', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = trail(['/a', '/b']);

          links[0].el.focus();

          expect(press(links[0].el, 'ArrowDown').defaultPrevented).toBe(false);
          expect(focusedHref()).toBe('/a');

          expect(press(links[0].el, 'ArrowUp').defaultPrevented).toBe(false);
          expect(focusedHref()).toBe('/a');

          expect(press(links[0].el, 'Enter').defaultPrevented).toBe(false);
          expect(press(links[0].el, ' ').defaultPrevented).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Single Tab Stop Invariant', () => {
    it('holds the single tab stop on the current crumb and invents no trail position', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links, cleanup } = trail(['/a', '/b', { href: '/c', current: true }]);

          expect(links[0].el.getAttribute('tabindex')).toBe('-1');
          expect(links[1].el.getAttribute('tabindex')).toBe('-1');
          expect(links[2].el.getAttribute('tabindex')).toBe('0');
          expect(links[2].el.getAttribute('aria-current')).toBe('page');

          expect(crumbEl.hasAttribute('aria-activedescendant')).toBe(false);
          expect(crumbEl.hasAttribute('aria-valuenow')).toBe(false);
          expect(crumbEl.hasAttribute('aria-current')).toBe(false);

          cleanup();
        });
      }));

    it('holds no tab stop while none is current, so mark the terminal page current', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = trail(['/a', '/b', '/c']);

          for (const { el } of links) {
            expect(el.getAttribute('tabindex')).toBe('-1');
          }

          cleanup();
        });
      }));

    it('keeps disabled crumbs off the tab order', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = trail([
            { href: '/gone', disabled: true },
            { href: '/b', current: true },
          ]);

          expect(links[0].el.getAttribute('tabindex')).toBe('-1');
          expect(links[1].el.getAttribute('tabindex')).toBe('0');

          cleanup();
        });
      }));
  });

  describe('Separator Invariant', () => {
    it('hides delimiters from assistive technology and gives them no key behavior', () =>
      scope.run(() => {
        component().run(() => {
          const separator = aria('breadcrumb-separator');

          expect(separator.attributes['aria-hidden']).toBe('true');
          expect(separator.attributes.tabindex).toBeUndefined();

          const el = bind(document.createElement('span'), separator);
          el.textContent = '/';
          document.body.appendChild(el);

          expect(el.getAttribute('aria-hidden')).toBe('true');
          expect(el.hasAttribute('tabindex')).toBe(false);

          expect(press(el, 'ArrowRight').defaultPrevented).toBe(false);

          separator.destroy();
          el.remove();
        });
      }));
  });
});
