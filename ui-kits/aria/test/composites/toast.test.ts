import { createLifecycle } from '@airlib/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aria, type ToastProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildToast(props: ToastProps = {}, withClose = true) {
  const toast = aria('toast', props);
  const toastEl = bind(document.createElement('div'), toast);
  document.body.appendChild(toastEl);

  const close = withClose ? aria('toast-close') : undefined;
  const closeEl = close ? bind(document.createElement('button'), close) : undefined;
  if (closeEl) toastEl.appendChild(closeEl);

  const cleanup = () => {
    close?.destroy();
    toast.destroy();
    toastEl.remove();
  };

  return { toast, toastEl, close, closeEl, cleanup };
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

  describe('One-shot lifetime', () => {
    it('arms no timer without a duration and lives until dismissed', () =>
      scope.run(() => {
        component().run(() => {
          const { toast, toastEl, cleanup } = buildToast({}, false);

          const targets: EventTarget[] = [];
          const details: unknown[] = [];
          document.body.addEventListener('dismiss', (event) => {
            targets.push(event.target!);
            details.push((event as CustomEvent).detail);
          });

          vi.advanceTimersByTime(20000);
          expect(targets).toEqual([]);
          expect(toast.dismissed).toBe(false);

          toast.dismiss();
          expect(targets).toEqual([toastEl]);
          expect(details).toEqual([null]);

          // A dismissed toast never re-arms
          vi.advanceTimersByTime(20000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('honours a custom duration', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 1200 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          vi.advanceTimersByTime(1199);
          expect(targets).toEqual([]);

          vi.advanceTimersByTime(1);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('commits removal early when dismissed is written, and never double-commits', () =>
      scope.run(() => {
        component().run(() => {
          const { toast, toastEl, cleanup } = buildToast({ duration: 4000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          expect(toast.dismissed).toBe(false);
          toast.dismiss();
          expect(toast.dismissed).toBe(true);
          expect(targets).toEqual([toastEl]);

          // Writing true again and letting the original deadline pass changes nothing
          toast.dismiss();
          vi.advanceTimersByTime(10000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('closes through the close button once, and never re-arms the expired timer', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, closeEl, cleanup } = buildToast({ duration: 4000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          closeEl!.click();
          expect(targets).toEqual([toastEl]);

          closeEl!.click();
          expect(targets).toEqual([toastEl]);

          vi.advanceTimersByTime(10000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));
  });

  describe('Interaction pause', () => {
    it('holds the timer while the pointer is over the toast and resumes the remainder on leave', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 2000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => {
            targets.push(event.target!);
          });

          vi.advanceTimersByTime(1000);
          toastEl.dispatchEvent(new Event('pointerenter'));

          vi.advanceTimersByTime(5000);
          expect(targets).toEqual([]);

          toastEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(999);
          expect(targets).toEqual([]);

          vi.advanceTimersByTime(1);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('holds the timer while focus is inside the toast and releases on blur', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, closeEl, cleanup } = buildToast({ duration: 2000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          closeEl!.focus();
          toastEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

          vi.advanceTimersByTime(10000);
          expect(targets).toEqual([]);

          closeEl!.blur();
          toastEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

          vi.advanceTimersByTime(2000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));
  });

  describe('Live region announcement', () => {
    it('compiles a polite status region by default and an assertive alert when critical', () =>
      scope.run(() => {
        component().run(() => {
          const polite = buildToast();
          expect(polite.toastEl.getAttribute('role')).toBe('status');
          expect(polite.toastEl.getAttribute('aria-live')).toBe('polite');
          expect(polite.toastEl.getAttribute('aria-atomic')).toBe('false');
          polite.cleanup();

          const assertive = buildToast({ critical: true }, false);
          expect(assertive.toastEl.getAttribute('role')).toBe('alert');
          expect(assertive.toastEl.getAttribute('aria-live')).toBe('assertive');
          expect(assertive.toastEl.getAttribute('aria-atomic')).toBe('false');
          assertive.cleanup();
        });
      }));

    it('gives the close button the plain button contract and no extra semantics', () =>
      scope.run(() => {
        component().run(() => {
          const { closeEl, cleanup } = buildToast();

          expect(closeEl!.type).toBe('button');
          expect(closeEl!.hasAttribute('role')).toBe(false);
          expect(closeEl!.hasAttribute('aria-expanded')).toBe(false);
          expect(closeEl!.hasAttribute('aria-controls')).toBe(false);
          expect(closeEl!.hasAttribute('aria-disabled')).toBe(false);

          cleanup();
        });
      }));
  });
});
