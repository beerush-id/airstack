import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Breadcrumb - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  function trail(hrefs: string[]) {
    const crumb = aria('breadcrumb');
    const crumbEl = bind(document.createElement('nav'), crumb);
    document.body.appendChild(crumbEl);

    const links = hrefs.map((href) => {
      const link = aria('link', { href });
      const el = bind(document.createElement('a'), link);
      el.href = href;
      crumbEl.appendChild(el);
      return { link, el };
    });

    return { crumb, crumbEl, links };
  }

  describe('Linear Hierarchy & Trail Demarcation Invariant', () => {
    it('names the trail as a landmark without duplicating the native navigation role', () =>
      scope.run(() => {
        component().run(() => {
          const nativeTrail = trail(['/docs', '/docs/aria', '/docs/aria/buttons']);

          // 1/2. A <nav> already is the landmark, so only the name is compiled
          expect(nativeTrail.crumb.attributes.role).toBeUndefined();
          expect(nativeTrail.crumbEl.getAttribute('role')).toBeNull();
          expect(nativeTrail.crumbEl.getAttribute('aria-label')).toBe('Breadcrumbs');

          nativeTrail.crumbEl.remove();

          const custom = aria('breadcrumb');
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          expect(custom.attributes.role).toBe('navigation');
          expect(customEl.getAttribute('role')).toBe('navigation');
          expect(customEl.getAttribute('aria-label')).toBe('Breadcrumbs');

          const labelled = aria('breadcrumb', { label: 'Documentation path' });
          const labelledEl = bind(document.createElement('section'), labelled);
          document.body.appendChild(labelledEl);

          expect(labelledEl.getAttribute('aria-label')).toBe('Documentation path');

          custom.destroy();
          labelled.destroy();
          customEl.remove();
          labelledEl.remove();
        });
      }));

    it('travels the crumb links horizontally and clamps at both ends', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links } = trail(['/a', '/b', '/c']);

          links[0].el.focus();

          const travel = (el: HTMLElement, key: string) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            el.dispatchEvent(event);
            return event;
          };

          travel(links[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(links[1].el);

          travel(links[1].el, 'ArrowRight');
          expect(document.activeElement).toBe(links[2].el);

          // The last crumb has nothing to the right of it, and stays put
          expect(travel(links[2].el, 'ArrowRight').defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(links[2].el);

          travel(links[2].el, 'ArrowLeft');
          expect(document.activeElement).toBe(links[1].el);

          travel(links[1].el, 'ArrowLeft');
          expect(document.activeElement).toBe(links[0].el);

          travel(links[0].el, 'ArrowLeft');
          expect(document.activeElement).toBe(links[0].el);

          crumbEl.remove();
        });
      }));

    it('jumps to the first and last crumb with Home and End', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links } = trail(['/a', '/b', '/c']);

          links[1].el.focus();

          links[1].el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
          );
          expect(document.activeElement).toBe(links[2].el);

          links[2].el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
          );
          expect(document.activeElement).toBe(links[0].el);

          crumbEl.remove();
        });
      }));
  });

  describe('Terminal Current Page Invariant', () => {
    it('leaves every crumb on the link contract and synthesizes no current-page state', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links } = trail(['/a', '/b', '/c']);

          for (const { link, el } of links) {
            // A crumb is a link: its role is implicit and no widget state is layered on
            expect(el.hasAttribute('role')).toBe(false);
            expect(link.attributes['aria-current']).toBeUndefined();
            expect(el.hasAttribute('aria-current')).toBe(false);
            expect(el.hasAttribute('aria-pressed')).toBe(false);
            expect(el.hasAttribute('aria-selected')).toBe(false);
            expect(el.hasAttribute('aria-disabled')).toBe(false);
          }

          // The container marks the trail, not the position within it
          expect(crumbEl.hasAttribute('aria-activedescendant')).toBe(false);
          expect(crumbEl.hasAttribute('aria-valuenow')).toBe(false);

          crumbEl.remove();
        });
      }));
  });

  describe('Interstitial Separator Invariance', () => {
    it('hides each delimiter from assistive technology and gives it no semantics', () =>
      scope.run(() => {
        component().run(() => {
          const separator = aria('breadcrumb-separator');
          expect(separator.attributes['aria-hidden']).toBe('true');
          expect(separator.attributes.role).toBeUndefined();
          expect(separator.attributes.tabindex).toBeUndefined();

          const el = bind(document.createElement('span'), separator);
          el.textContent = '/';

          expect(el.getAttribute('aria-hidden')).toBe('true');
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          // A separator is not an interactive stop for any key
          const event = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          separator.destroy();
        });
      }));

    it('steps over separators so traversal lands only on crumbs', () =>
      scope.run(() => {
        component().run(() => {
          const { crumbEl, links } = trail(['/a', '/b', '/c']);

          const separators = [
            bind(document.createElement('span'), aria('breadcrumb-separator')),
            bind(document.createElement('span'), aria('breadcrumb-separator')),
          ];

          crumbEl.insertBefore(separators[0], links[1].el);
          crumbEl.insertBefore(separators[1], links[2].el);

          links[0].el.focus();

          links[0].el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
          );
          expect(document.activeElement).toBe(links[1].el);
          expect(document.activeElement).not.toBe(separators[0]);

          links[1].el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
          );
          expect(document.activeElement).toBe(links[2].el);
          expect(document.activeElement).not.toBe(separators[1]);

          separators.forEach((sep) => sep.remove());
          crumbEl.remove();
        });
      }));
  });
});
