import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ToastRegionProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildRegion(props: Partial<ToastRegionProps>, toasts: Array<{ id: string; duration?: number }>) {
  const region = aria('toast-region', props as ToastRegionProps);
  const regionEl = bind(document.createElement('section'), region);
  document.body.appendChild(regionEl);

  const built = toasts.map(({ id, duration }) => {
    const toast = aria('toast', { id, duration });
    const toastEl = bind(document.createElement('div'), toast);
    regionEl.appendChild(toastEl);

    const title = aria('toast-title');
    const titleEl = bind(document.createElement('strong'), title);
    titleEl.textContent = `${id} title`;
    toastEl.appendChild(titleEl);

    const description = aria('toast-description');
    const descriptionEl = bind(document.createElement('p'), description);
    descriptionEl.textContent = `${id} body`;
    toastEl.appendChild(descriptionEl);

    const close = aria('toast-close');
    const closeEl = bind(document.createElement('button'), close);
    toastEl.appendChild(closeEl);

    return { id, toast, toastEl, title, titleEl, description, descriptionEl, close, closeEl };
  });

  const cleanup = () => {
    region.destroy();
    for (const entry of built) {
      entry.close.destroy();
      entry.description.destroy();
      entry.title.destroy();
      entry.toast.destroy();
    }

    regionEl.remove();
  };

  return { region, regionEl, toasts: built, cleanup };
}

function describeDismiss(target: ParentNode, sink: unknown[]) {
  const handler = (event: Event) => sink.push((event as CustomEvent).detail);
  target.addEventListener('dismiss', handler);
  return () => target.removeEventListener('dismiss', handler);
}

describe('Toast - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Temporal Lifetime & Queue Coordination Invariant', () => {
    it('expires each toast on the default lifetime and announces the removal', () =>
      scope.run(() => {
        component().run(() => {
          const { regionEl, cleanup } = buildRegion({ duration: 3000 }, [{ id: 'saved' }]);

          const dismissals: unknown[] = [];
          regionEl.addEventListener('dismiss', (event) => dismissals.push((event as CustomEvent).detail));

          vi.advanceTimersByTime(2999);
          expect(dismissals).toEqual([]);

          vi.advanceTimersByTime(1);
          expect(dismissals).toEqual(['saved']);

          // A dismissed toast does not announce a second time
          vi.advanceTimersByTime(6000);
          expect(dismissals).toEqual(['saved']);

          cleanup();
        });
      }));

    it('lets an individual toast override the region lifetime without disturbing its siblings', () =>
      scope.run(() => {
        component().run(() => {
          const { regionEl, cleanup } = buildRegion({ duration: 5000 }, [
            { id: 'quick', duration: 1000 },
            { id: 'steady' },
          ]);

          const dismissals: unknown[] = [];
          regionEl.addEventListener('dismiss', (event) => dismissals.push((event as CustomEvent).detail));

          vi.advanceTimersByTime(1000);
          expect(dismissals).toEqual(['quick']);

          vi.advanceTimersByTime(3999);
          expect(dismissals).toEqual(['quick']);

          vi.advanceTimersByTime(1);
          expect(dismissals).toEqual(['quick', 'steady']);

          cleanup();
        });
      }));

    it('closes through the close button once, and never re-arms the expired timer', () =>
      scope.run(() => {
        component().run(() => {
          const { regionEl, toasts, cleanup } = buildRegion({ duration: 4000 }, [{ id: 'manual' }, { id: 'timed' }]);

          const dismissals: unknown[] = [];
          regionEl.addEventListener('dismiss', (event) => dismissals.push((event as CustomEvent).detail));

          toasts[0].closeEl.click();
          expect(dismissals).toEqual(['manual']);

          toasts[0].closeEl.click();
          expect(dismissals).toEqual(['manual']);

          // The remaining toast keeps its own schedule
          vi.advanceTimersByTime(3999);
          expect(dismissals).toEqual(['manual']);

          vi.advanceTimersByTime(1);
          expect(dismissals).toEqual(['manual', 'timed']);

          cleanup();
        });
      }));
  });

  describe('Interaction Interruption & Pause Invariant', () => {
    it('holds the timer while the pointer is over a toast and restarts on leave', () =>
      scope.run(() => {
        component().run(() => {
          const { regionEl, toasts, cleanup } = buildRegion({ duration: 2000 }, [{ id: 'hovered' }]);

          const dismissals: unknown[] = [];
          regionEl.addEventListener('dismiss', (event) => dismissals.push((event as CustomEvent).detail));

          vi.advanceTimersByTime(1000);
          toasts[0].toastEl.dispatchEvent(new Event('pointerenter'));

          vi.advanceTimersByTime(5000);
          expect(dismissals).toEqual([]);

          toasts[0].toastEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(1000);
          expect(dismissals).toEqual(['hovered']);

          cleanup();
        });
      }));

    it('holds the timer while focus is inside the toast and releases on blur', () =>
      scope.run(() => {
        component().run(() => {
          const { toasts, cleanup } = buildRegion({ duration: 2000 }, [{ id: 'focused' }]);

          const dismissals: unknown[] = [];
          const detach = describeDismiss(document.body, dismissals);

          toasts[0].closeEl.focus();
          toasts[0].toastEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

          vi.advanceTimersByTime(10000);
          expect(dismissals).toEqual([]);

          toasts[0].closeEl.blur();
          toasts[0].toastEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

          vi.advanceTimersByTime(2000);
          expect(dismissals).toEqual(['focused']);

          detach();
          cleanup();
        });
      }));

    it('pauses only the toast being interacted with', () =>
      scope.run(() => {
        component().run(() => {
          const { regionEl, toasts, cleanup } = buildRegion({ duration: 3000 }, [{ id: 'first' }, { id: 'second' }]);

          const dismissals: unknown[] = [];
          regionEl.addEventListener('dismiss', (event) => dismissals.push((event as CustomEvent).detail));

          toasts[1].toastEl.dispatchEvent(new Event('pointerenter'));
          vi.advanceTimersByTime(3000);

          expect(dismissals).toEqual(['first']);

          toasts[1].toastEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(3000);
          expect(dismissals).toEqual(['first', 'second']);

          cleanup();
        });
      }));
  });

  describe('Live Region Announcement Invariant', () => {
    it('compiles a polite status region by default and an assertive alert on request', () =>
      scope.run(() => {
        component().run(() => {
          const polite = buildRegion({}, [{ id: 'saved' }]);
          expect(polite.regionEl.getAttribute('role')).toBe('status');
          expect(polite.regionEl.getAttribute('aria-live')).toBe('polite');
          expect(polite.regionEl.getAttribute('aria-atomic')).toBe('false');
          polite.cleanup();

          const assertive = aria('toast-region', { politeness: 'assertive' });
          const assertiveEl = bind(document.createElement('div'), assertive);
          document.body.appendChild(assertiveEl);

          expect(assertiveEl.getAttribute('role')).toBe('alert');
          expect(assertiveEl.getAttribute('aria-live')).toBe('assertive');
          expect(assertiveEl.getAttribute('aria-atomic')).toBe('false');

          assertive.destroy();
          assertiveEl.remove();
        });
      }));

    it('wires each toast to its own title and description by address', () =>
      scope.run(() => {
        component().run(() => {
          const { toasts, cleanup } = buildRegion({ duration: 5000 }, [{ id: 'alpha' }, { id: 'beta' }]);

          const [alpha, beta] = toasts;

          expect(alpha.toastEl.getAttribute('aria-labelledby')).toBe(alpha.titleEl.id);
          expect(alpha.toastEl.getAttribute('aria-describedby')).toBe(alpha.descriptionEl.id);

          // Every address resolves inside this toast, not a sibling's
          const labelled = document.getElementById(alpha.toastEl.getAttribute('aria-labelledby') as string);
          const described = document.getElementById(alpha.toastEl.getAttribute('aria-describedby') as string);
          expect(labelled).toBe(alpha.titleEl);
          expect(described).toBe(alpha.descriptionEl);
          expect(alpha.toastEl.contains(labelled as Node)).toBe(true);

          expect(beta.toastEl.getAttribute('aria-labelledby')).toBe(beta.titleEl.id);
          expect(beta.titleEl.textContent).toBe('beta title');
          expect(beta.descriptionEl.textContent).toBe('beta body');

          cleanup();
        });
      }));

    it('gives the close button the plain button contract and no extra semantics', () =>
      scope.run(() => {
        component().run(() => {
          const { toasts, cleanup } = buildRegion({ duration: 5000 }, [{ id: 'one' }]);

          const close = toasts[0].closeEl;
          expect(close.type).toBe('button');
          expect(close.hasAttribute('role')).toBe(false);
          expect(close.hasAttribute('aria-expanded')).toBe(false);
          expect(close.hasAttribute('aria-controls')).toBe(false);
          expect(close.hasAttribute('aria-disabled')).toBe(false);

          cleanup();
        });
      }));
  });
});
