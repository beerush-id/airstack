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

  describe('Navigation Activation & Event Dispatch Invariant', () => {
    it('dispatches a bubbling, cancelable navigation click from Enter on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria<HTMLSpanElement>('link', { href: '/docs/router' }, { native: false });

          // 1. Creation & SSR
          expect(link.current).toBeNull();
          expect(link.attributes.role).toBe('link');
          expect(
            Object.keys(link.attributes).filter((key) => key.startsWith('on')),
          ).toEqual([]);

          // 2. DOM Binding
          const el = bind(document.createElement('span'), link);
          expect(link.current).toBe(el);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          const delegated: MouseEvent[] = [];
          const onDocumentClick = (event: Event) => delegated.push(event as MouseEvent);
          document.addEventListener('click', onDocumentClick);

          // 3/4. Enter performs the navigation action as a real, observable click
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);

          expect(hostClicks).toHaveLength(1);
          expect(hostClicks[0].type).toBe('click');
          expect(hostClicks[0].bubbles).toBe(true);
          expect(hostClicks[0].cancelable).toBe(true);
          expect(hostClicks[0].target).toBe(el);
          expect(delegated).toHaveLength(1);

          // 5. Space belongs to buttons, not links: a full press adds no navigation
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);

          document.removeEventListener('click', onDocumentClick);

          // 6. Teardown: detached host stops synthesizing navigation
          link.destroy();
          expect(link.current).toBeNull();

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);
        });
      }));

    it('forwards a consumer-cancelled click without interference on a native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/docs/router' });
          const el = bind(document.createElement('a'), link);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => {
            hostClicks.push(event);
            event.preventDefault();
          });

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);

          // The consumer owns the cancellation; the projection stays untouched
          expect(hostClicks).toHaveLength(1);
          expect(click.defaultPrevented).toBe(true);
          expect(el.getAttribute('href')).toBe('/docs/router');
          expect(el.getAttribute('aria-disabled')).toBe('false');

          link.destroy();
          expect(link.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('cancels a pointer click on a custom host declared disabled at creation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria<HTMLSpanElement>(
            'link',
            { href: '/admin', disabled: true },
            { native: false },
          );

          // 1. Creation & SSR
          expect(link.disabled).toBe(true);
          expect(link.attributes.role).toBe('link');
          expect(link.attributes['aria-disabled']).toBe('true');
          expect(link.attributes.tabindex).toBe(-1);

          // 2. DOM Binding
          const el = bind(document.createElement('span'), link);
          expect(el.getAttribute('tabindex')).toBe('-1');

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          // 3/4. Pointer path: the click stays observable to consumers but its default is cancelled
          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);

          expect(hostClicks).toHaveLength(1);
          expect(click.defaultPrevented).toBe(true);

          // Keyboard path stays refused
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);
          expect(hostClicks).toHaveLength(1);

          // 6. Teardown
          link.destroy();
          expect(link.current).toBeNull();
        });
      }));

    it('locks and re-arms a mounted custom host without rebinding', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<LinkProps>({ href: '/account', disabled: false });
          const link = aria<HTMLSpanElement>('link', props, { native: false });
          const el = bind(document.createElement('span'), link);

          // Baseline: Enter navigates
          const clickSpy = vi.fn();
          el.addEventListener('click', clickSpy);

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(clickSpy).toHaveBeenCalledTimes(1);

          // 5. Reconciliation: revocation withdraws the target and the tab stop
          props.disabled = true;
          expect(el.hasAttribute('href')).toBe(false);
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          el.dispatchEvent(click);
          expect(clickSpy).toHaveBeenCalledTimes(1);
          expect(click.defaultPrevented).toBe(true);

          // Restoration puts the target and the tab stop back on the same node
          props.disabled = false;
          expect(el.getAttribute('href')).toBe('/account');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-disabled')).toBe('false');

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(clickSpy).toHaveBeenCalledTimes(2);

          // 6. Teardown
          link.destroy();
          expect(link.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Target Delegation Invariant', () => {
    it('projects the browsing context verbatim without synthesizing relationship metadata', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const link = aria('link', { href: '/reports/2026.pdf', target: '_blank' });

          // 1. Creation & SSR: only the declared keys are projected
          expect(link.attributes.href).toBe('/reports/2026.pdf');
          expect(link.attributes.target).toBe('_blank');
          expect(link.attributes.rel).toBeUndefined();
          expect(link.attributes.download).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('a'), link);
          expect(el.getAttribute('target')).toBe('_blank');

          // rel is deliberately absent: a _blank context is already isolated by the platform

          // 3/5. Reconciliation: swapping the browsing context rewrites the one attribute
          link.assign({ target: '_self' });
          expect(link.attributes.target).toBe('_self');
          expect(el.getAttribute('target')).toBe('_self');
          expect(el.hasAttribute('rel')).toBe(false);
          expect(el.getAttribute('href')).toBe('/reports/2026.pdf');

          // 6. Teardown
          link.destroy();
          expect(link.current).toBeNull();
        });
      }));

    it('refuses activation identically on both hosts while each keeps reachability its own way', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeLink = aria('link', { href: '/admin', disabled: true });
          const customLink = aria<HTMLSpanElement>(
            'link',
            { href: '/admin', disabled: true },
            { native: false },
          );

          const anchor = bind(document.createElement('a'), nativeLink);
          const span = bind(document.createElement('span'), customLink);

          // Same comparator state, same announcement
          expect(nativeLink.disabled).toBe(customLink.disabled);
          expect(anchor.getAttribute('aria-disabled')).toBe('true');
          expect(span.getAttribute('aria-disabled')).toBe('true');
          expect(anchor.getAttribute('aria-disabled')).toBe(span.getAttribute('aria-disabled'));

          // Activation is cancelled, not swallowed, on both hosts
          const anchorClick = new MouseEvent('click', { cancelable: true, bubbles: true });
          anchor.dispatchEvent(anchorClick);

          const spanClick = new MouseEvent('click', { cancelable: true, bubbles: true });
          span.dispatchEvent(spanClick);

          expect(anchorClick.defaultPrevented).toBe(true);
          expect(spanClick.defaultPrevented).toBe(true);

          // Reachability mechanism: the anchor withdraws its target, the span its tab stop
          expect(anchor.hasAttribute('href')).toBe(false);
          expect(anchor.hasAttribute('role')).toBe(false);
          expect(anchor.hasAttribute('tabindex')).toBe(false);
          expect(span.getAttribute('role')).toBe('link');
          expect(span.getAttribute('tabindex')).toBe('-1');

          nativeLink.destroy();
          customLink.destroy();
          expect(nativeLink.current).toBeNull();
          expect(customLink.current).toBeNull();
        });
      }));
  });
});
