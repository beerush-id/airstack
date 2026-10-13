import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type PaginationProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildNav(
  props: Partial<PaginationProps>,
  pages: Array<{ page: string; href: string; disabled?: boolean }>,
  host: 'native' | 'custom' = 'native'
) {
  const nav = aria('pagination', props as PaginationProps, { native: host !== 'custom' });
  const navEl = bind(document.createElement(host === 'native' ? 'nav' : 'div'), nav);
  document.body.appendChild(navEl);

  const links = pages.map(({ page, href, disabled }) => {
    const link = aria('link', { href: disabled ? undefined : href, disabled });
    const el = bind(document.createElement('a'), link);
    if (!disabled) el.href = href;
    el.dataset.page = page;
    navEl.appendChild(el);
    return { page, link, el };
  });

  const cleanup = () => {
    for (const { link } of links) {
      link.destroy();
    }

    nav.destroy();
    navEl.remove();
  };

  return { nav, navEl, links, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const focusedPage = () => (document.activeElement as HTMLElement)?.getAttribute('data-page') ?? null;

describe('Pagination - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Page Index Wrapping & Boundary Invariant', () => {
    it('names the landmark and stays unnamed by the engine where the element already is one', () =>
      scope.run(() => {
        component().run(() => {
          const native = buildNav({}, [{ page: '1', href: '?p=1' }]);

          // <nav> is the landmark, so only the label is added
          expect(native.navEl.getAttribute('role')).toBeNull();
          expect(native.nav.attributes.role).toBeUndefined();
          expect(native.navEl.getAttribute('aria-label')).toBe('Pagination');

          native.cleanup();

          const custom = buildNav({ label: 'Search results pages' }, [{ page: '1', href: '?p=1' }], 'custom');

          expect(custom.navEl.getAttribute('role')).toBe('navigation');
          expect(custom.navEl.getAttribute('aria-label')).toBe('Search results pages');

          custom.cleanup();
        });
      }));

    it('moves focus between page links and wraps at both ends', () =>
      scope.run(() => {
        component().run(() => {
          const { navEl, links, cleanup } = buildNav({}, [
            { page: '1', href: '?p=1' },
            { page: '2', href: '?p=2' },
            { page: '3', href: '?p=3' },
          ]);

          links[0].el.focus();

          press(links[0].el, 'ArrowRight');
          expect(focusedPage()).toBe('2');

          press(links[1].el, 'ArrowLeft');
          expect(focusedPage()).toBe('1');

          press(links[0].el, 'ArrowLeft');
          expect(focusedPage()).toBe('3');

          press(links[2].el, 'ArrowRight');
          expect(focusedPage()).toBe('1');

          // Home and End jump to the ends of the run
          press(links[1].el, 'End');
          expect(focusedPage()).toBe('3');

          press(links[2].el, 'Home');
          expect(focusedPage()).toBe('1');

          expect(navEl.contains(document.activeElement as Node)).toBe(true);

          cleanup();
        });
      }));

    it('leaves the vertical arrows to the page scroll', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = buildNav({}, [
            { page: '1', href: '?p=1' },
            { page: '2', href: '?p=2' },
          ]);

          links[0].el.focus();

          expect(press(links[0].el, 'ArrowDown').defaultPrevented).toBe(false);
          expect(focusedPage()).toBe('1');

          expect(press(links[0].el, 'ArrowUp').defaultPrevented).toBe(false);
          expect(focusedPage()).toBe('1');

          // A key with no meaning here is not swallowed either
          expect(press(links[0].el, 'Enter').defaultPrevented).toBe(false);
          expect(press(links[0].el, ' ').defaultPrevented).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Linear Traversal & Jump Invariant', () => {
    it('passes over a disabled page link in every direction', () =>
      scope.run(() => {
        component().run(() => {
          const { links, cleanup } = buildNav({}, [
            { page: '1', href: '?p=1' },
            { page: '…', href: '#', disabled: true },
            { page: '8', href: '?p=8' },
            { page: '9', href: '?p=9' },
          ]);

          links[0].el.focus();
          expect(links[1].el.getAttribute('aria-disabled')).toBe('true');
          expect(links[1].el.hasAttribute('href')).toBe(false);

          press(links[0].el, 'ArrowRight');
          expect(focusedPage()).toBe('8');

          press(links[2].el, 'ArrowLeft');
          expect(focusedPage()).toBe('1');

          press(links[1].el, 'End');
          expect(focusedPage()).toBe('9');

          press(links[3].el, 'Home');
          expect(focusedPage()).toBe('1');

          cleanup();
        });
      }));

    it('leaves page navigation to the browser on a link', () =>
      scope.run(() => {
        component().run(() => {
          const { navEl, links, cleanup } = buildNav({}, [
            { page: '1', href: '?p=1' },
            { page: '2', href: '?p=2' },
          ]);

          const navigated: string[] = [];
          links[1].el.addEventListener('click', (event) => {
            navigated.push(links[1].el.href);
            expect(event.defaultPrevented).toBe(false);
          });

          links[1].el.click();
          expect(navigated).toHaveLength(1);
          expect(links[0].el.getAttribute('aria-current')).toBeNull();
          expect(navEl.hasAttribute('aria-current')).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Current Landmark Association Invariant', () => {
    it('exposes the landmark without inventing a page position', () =>
      scope.run(() => {
        component().run(() => {
          const { nav, navEl, links, cleanup } = buildNav({ label: 'Results' }, [
            { page: '1', href: '?p=1' },
            { page: '2', href: '?p=2' },
          ]);

          expect(navEl.getAttribute('aria-label')).toBe('Results');

          // The container holds no page index of its own
          expect(navEl.hasAttribute('aria-current')).toBe(false);
          expect(navEl.hasAttribute('aria-valuenow')).toBe(false);
          expect(nav.attributes.value).toBeUndefined();

          // And no link is announced as the current page
          for (const { el } of links) {
            expect(el.hasAttribute('aria-current')).toBe(false);
          }

          cleanup();
        });
      }));
  });
});
