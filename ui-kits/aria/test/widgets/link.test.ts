import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type LinkProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Link - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Native Anchor Contract', () => {
    it('projects navigation semantics onto <a> without a redundant role across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/docs/router', target: '_blank' });

          // 1. SSR Phase: <a> carries the link role implicitly
          expect(link.current).toBeNull();
          expect(link.attributes.role).toBeUndefined();
          expect(link.attributes.tabindex).toBeUndefined();
          expect(link.attributes.href).toBe('/docs/router');
          expect(link.attributes.target).toBe('_blank');
          expect(link.attributes['aria-disabled']).toBe('false');

          // 2. Mount Phase
          const el = bind(document.createElement('a'), link);
          expect(link.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('href')).toBe('/docs/router');
          expect(el.getAttribute('target')).toBe('_blank');

          // 3. Interaction Phase: an enabled link leaves navigation to the browser
          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(false);
        });
      }));

    it('delegates Enter activation to the browser for native anchors', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/docs/router' });
          const el = bind(document.createElement('a'), link);

          const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          el.dispatchEvent(enter);

          expect(link.isNative).toBe(true);
          expect(enter.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Disabled Navigation Lockout Contract', () => {
    it('withholds href, announces aria-disabled, and blocks activation when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/admin', disabled: true });

          // 1. SSR Phase: no navigable target is offered
          expect(link.disabled).toBe(true);
          expect(link.href).toBeUndefined();
          expect(link.attributes.href).toBeUndefined();
          expect(link.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('a'), link);
          expect(el.hasAttribute('href')).toBe(false);
          expect(el.getAttribute('aria-disabled')).toBe('true');

          // 3. Interaction Phase: activation is refused
          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(true);
        });
      }));

    it('withdraws the target and locks activation when a parent disables a live link', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<LinkProps>({ href: '/admin', disabled: false });
          const link = aria('link', props);
          const el = bind(document.createElement('a'), link);

          expect(el.getAttribute('href')).toBe('/admin');
          expect(el.getAttribute('aria-disabled')).toBe('false');

          // Parent revokes access -> the mounted anchor stops being navigable
          props.disabled = true;
          expect(link.href).toBeUndefined();
          expect(el.hasAttribute('href')).toBe(false);
          expect(el.getAttribute('aria-disabled')).toBe('true');

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(click.defaultPrevented).toBe(true);

          // Parent restores access
          props.disabled = false;
          expect(el.getAttribute('href')).toBe('/admin');
          expect(el.getAttribute('aria-disabled')).toBe('false');
        });
      }));
  });

  describe('Custom Element Activation Contract', () => {
    it('polyfills role, tab stop, and Enter activation on non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria<HTMLSpanElement>('link', { href: '/docs/router' }, { native: false });

          // 1. SSR Phase
          expect(link.current).toBeNull();
          expect(link.attributes.role).toBe('link');
          expect(link.attributes.tabindex).toBe(0);

          // 2. Mount Phase
          const el = bind(document.createElement('span'), link);
          expect(el.getAttribute('role')).toBe('link');
          expect(el.getAttribute('tabindex')).toBe('0');

          const clickSpy = vi.fn();
          el.addEventListener('click', clickSpy);

          // 3. Interaction Phase: Enter triggers the navigation action
          const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          el.dispatchEvent(enter);

          expect(enter.defaultPrevented).toBe(true);
          expect(clickSpy).toHaveBeenCalledTimes(1);

          // Space is not a link activation key
          const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          el.dispatchEvent(space);
          expect(space.defaultPrevented).toBe(false);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('keeps disabled custom links out of the tab order and inert to Enter', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria<HTMLSpanElement>('link', { href: '/admin', disabled: true }, { native: false });

          // 1. SSR Phase
          expect(link.attributes.tabindex).toBe(-1);
          expect(link.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('span'), link);
          expect(el.getAttribute('tabindex')).toBe('-1');

          const clickSpy = vi.fn();
          el.addEventListener('click', clickSpy);

          // 3. Interaction Phase: Enter neither activates nor claims the keystroke
          const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          el.dispatchEvent(enter);

          expect(enter.defaultPrevented).toBe(false);
          expect(clickSpy).not.toHaveBeenCalled();
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('releases the element binding on destroy and on ref(null)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/docs/router' });
          const el = bind(document.createElement('a'), link);

          expect(link.current).toBe(el);

          link.destroy();
          expect(link.current).toBeNull();

          const other = aria('link', { href: '/docs/router' });
          const otherEl = bind(document.createElement('a'), other);
          expect(other.current).toBe(otherEl);

          other.ref(null);
          expect(other.current).toBeNull();
        });
      }));
  });
});
