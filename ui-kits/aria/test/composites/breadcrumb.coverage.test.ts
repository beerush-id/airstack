import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Breadcrumb - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('roves nothing and throws nothing when the trail holds no crumb', () =>
    scope.run(() => {
      component().run(() => {
        const crumb = aria('breadcrumb');
        const crumbEl = bind(document.createElement('nav'), crumb);
        document.body.appendChild(crumbEl);

        const event = press(crumbEl, 'ArrowRight');

        expect(event.defaultPrevented).toBe(false);

        crumb.destroy();
        crumbEl.remove();
      });
    }));

  it('leaves keys it does not own untouched', () =>
    scope.run(() => {
      component().run(() => {
        const crumb = aria('breadcrumb');
        const crumbEl = bind(document.createElement('nav'), crumb);
        document.body.appendChild(crumbEl);

        const link = aria('link', { href: '/a' });
        const el = bind(document.createElement('a'), link);
        el.href = '/a';
        crumbEl.appendChild(el);
        el.focus();

        for (const key of ['a', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown']) {
          expect(press(el, key).defaultPrevented).toBe(false);
        }

        expect(document.activeElement).toBe(el);

        link.destroy();
        crumb.destroy();
        crumbEl.remove();
      });
    }));

  it('stays put when every crumb is disabled', () =>
    scope.run(() => {
      component().run(() => {
        const crumb = aria('breadcrumb');
        const crumbEl = bind(document.createElement('nav'), crumb);
        document.body.appendChild(crumbEl);

        const link = aria('link', { href: '/gone', disabled: true });
        const el = bind(document.createElement('a'), link);
        el.href = '/gone';
        crumbEl.appendChild(el);
        el.focus();

        expect(press(el, 'ArrowRight').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(el);

        expect(press(el, 'End').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(el);

        link.destroy();
        crumb.destroy();
        crumbEl.remove();
      });
    }));

  it('lands Home and End on crumbs pasted between separators', () =>
    scope.run(() => {
      component().run(() => {
        const crumb = aria('breadcrumb');
        const crumbEl = bind(document.createElement('nav'), crumb);
        document.body.appendChild(crumbEl);

        const firstSep = bind(document.createElement('span'), aria('breadcrumb-separator'));
        const link = aria('link', { href: '/only' });
        const el = bind(document.createElement('a'), link);
        el.href = '/only';
        const lastSep = bind(document.createElement('span'), aria('breadcrumb-separator'));
        crumbEl.append(firstSep, el, lastSep);

        el.focus();

        press(el, 'Home');
        expect(document.activeElement).toBe(el);

        press(el, 'End');
        expect(document.activeElement).toBe(el);

        link.destroy();
        crumb.destroy();
        crumbEl.remove();
      });
    }));

  it('compiles the same hidden delimiter on a custom host', () =>
    scope.run(() => {
      component().run(() => {
        const separator = aria('breadcrumb-separator' as never, {}, { native: false } as never);
        const el = bind(document.createElement('div'), separator);

        expect(el.getAttribute('aria-hidden')).toBe('true');
        expect(el.hasAttribute('tabindex')).toBe(false);

        separator.destroy();
      });
    }));

  it('releases the roving handler on destroy', () =>
    scope.run(() => {
      component().run(() => {
        const crumb = aria('breadcrumb');
        const crumbEl = bind(document.createElement('nav'), crumb);
        document.body.appendChild(crumbEl);

        const first = bind(document.createElement('a'), aria('link', { href: '/a' }));
        first.href = '/a';
        const second = bind(document.createElement('a'), aria('link', { href: '/b' }));
        second.href = '/b';
        crumbEl.append(first, second);

        first.focus();
        crumb.destroy();

        expect(press(first, 'ArrowRight').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(first);

        crumbEl.remove();
      });
    }));
});
