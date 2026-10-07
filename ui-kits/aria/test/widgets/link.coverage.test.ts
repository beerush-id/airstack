import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { linkCtx } from '../../src/context.js';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Link - Coverage (current-page activation)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('emits aria-current=page when href matches the ambient URL', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        linkCtx.set(mutable({ url: '/docs' }));

        const link = aria('link', { href: '/docs' });
        const el = bind(document.createElement('a'), link);

        expect(link.isCurrent).toBe(true);
        expect(el.getAttribute('aria-current')).toBe('page');
        expect(link.attributes['aria-current']).toBe('page');
      });
    }));

  it('omits aria-current when href does not match the ambient URL', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        linkCtx.set(mutable({ url: '/docs' }));

        const link = aria('link', { href: '/blog' });
        const el = bind(document.createElement('a'), link);

        expect(link.isCurrent).toBe(false);
        expect(el.hasAttribute('aria-current')).toBe(false);
        expect(link.attributes['aria-current']).toBeUndefined();
      });
    }));

  it('lets explicit current override the ambient match in both directions', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        linkCtx.set(mutable({ url: '/docs' }));

        const forced = aria('link', { href: '/blog', current: true });
        const forcedEl = bind(document.createElement('a'), forced);
        expect(forcedEl.getAttribute('aria-current')).toBe('page');

        const suppressed = aria('link', { href: '/docs', current: false });
        const suppressedEl = bind(document.createElement('a'), suppressed);
        expect(suppressedEl.hasAttribute('aria-current')).toBe(false);
      });
    }));

  it('follows ambient URL changes on the same live node', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const location = mutable({ url: '/docs' });
        linkCtx.set(location);

        const link = aria('link', { href: '/blog' });
        const el = bind(document.createElement('a'), link);
        expect(el.hasAttribute('aria-current')).toBe(false);

        location.url = '/blog';
        expect(link.isCurrent).toBe(true);
        expect(el.getAttribute('aria-current')).toBe('page');

        location.url = '/docs';
        expect(link.isCurrent).toBe(false);
        expect(el.hasAttribute('aria-current')).toBe(false);
      });
    }));

  it('navigates custom hosts to href on click', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_self');
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('skips navigation for canceled clicks and missing href', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.addEventListener('click', (e) => e.preventDefault());
          el.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();

          const bare = aria<HTMLSpanElement>('link', {}, { native: false });
          const bareEl = bind(document.createElement('span'), bare);
          bareEl.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('opens declared targets instead of the default tab', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs', target: '_blank' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_blank');
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('opens a new tab for modifier clicks instead of navigating inline', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);

          el.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true, ctrlKey: true }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_blank');

          openSpy.mockClear();
          el.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true, metaKey: true }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_blank');

          openSpy.mockClear();
          el.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true, shiftKey: true }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_blank');
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('honors declared targets over modifier clicks', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs', target: 'docs-frame' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true, ctrlKey: true }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', 'docs-frame');
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('aborts navigation when the host detaches before the deferred navigation', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.click();
          link.destroy();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('compiles a bare link with no declared props', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const link = aria('link');
        const el = bind(document.createElement('a'), link);

        expect(link.href).toBeUndefined();
        expect(link.isCurrent).toBe(false);
        expect(el.hasAttribute('href')).toBe(false);
        expect(el.hasAttribute('aria-current')).toBe(false);
      });
    }));

  it('opens a new tab on real middle-click auxclick like a native anchor', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);

          const aux = new MouseEvent('auxclick', {
            cancelable: true,
            bubbles: true,
            button: 1,
          });
          el.dispatchEvent(aux);
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).toHaveBeenCalledWith('/docs', '_blank');
          expect(aux.defaultPrevented).toBe(true);
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('blocks middle-click auxclick while disabled and ignores non-middle buttons', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const locked = aria<HTMLSpanElement>('link', { href: '/admin', disabled: true }, { native: false });
          const lockedEl = bind(document.createElement('span'), locked);
          const blocked = new MouseEvent('auxclick', {
            cancelable: true,
            bubbles: true,
            button: 1,
          });
          lockedEl.dispatchEvent(blocked);
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(blocked.defaultPrevented).toBe(true);
          expect(openSpy).not.toHaveBeenCalled();

          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.dispatchEvent(new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 0 }));
          el.dispatchEvent(new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 2 }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('skips auxclick navigation when cancelled, href-less, or detached', async () =>
    scope.run(async () => {
      const tree = component();
      await tree.run(async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        try {
          const link = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const el = bind(document.createElement('span'), link);
          el.addEventListener('auxclick', (e) => e.preventDefault());
          el.dispatchEvent(new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 1 }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();

          const bare = aria<HTMLSpanElement>('link', {}, { native: false });
          const bareEl = bind(document.createElement('span'), bare);
          bareEl.dispatchEvent(new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 1 }));
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();

          const live = aria<HTMLSpanElement>('link', { href: '/docs' }, { native: false });
          const liveEl = bind(document.createElement('span'), live);
          liveEl.dispatchEvent(new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 1 }));
          live.destroy();
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(openSpy).not.toHaveBeenCalled();
        } finally {
          openSpy.mockRestore();
        }
      });
    }));

  it('suppresses native middle-click navigation while disabled', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const link = aria('link', { href: '/admin', disabled: true });
        const el = bind(document.createElement('a'), link);
        const aux = new MouseEvent('auxclick', { cancelable: true, bubbles: true, button: 1 });
        el.dispatchEvent(aux);
        expect(aux.defaultPrevented).toBe(true);
      });
    }));
});

describe('Attribute Shielding Contract', () => {
  const shieldScope = createLifecycle();

  afterAll(() => {
    shieldScope.destroy();
  });

  it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
    shieldScope.run(() => {
      component().run(() => {
        const link = aria<HTMLSpanElement>(
          'link',
          { href: '/docs', target: '_blank', disabled: false, current: true },
          { native: false }
        );

        for (const key of ['href', 'target', 'disabled', 'current', 'aria-disabled', 'aria-current']) {
          expect(link.ownKeys).toContain(key);
        }

        link.destroy();
        expect(link.current).toBeNull();
      });
    }));
});
