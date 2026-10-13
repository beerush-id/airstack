import { createLifecycle } from '@airlib/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aria, ToastAria, ToastCloseAria, type ToastProps } from '../../src/index.js';
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

describe('Toast - Coverage & Boundary Tests', () => {
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

  describe('Dismissed-state ownership', () => {
    it('exposes its compiled keys and releases the element on teardown', () =>
      scope.run(() => {
        component().run(() => {
          const { toast, close, cleanup } = buildToast({ critical: true, duration: 1000 });

          for (const key of ['critical', 'duration', 'role', 'aria-live', 'aria-atomic']) {
            expect(toast.ownKeys).toContain(key);
          }

          expect(toast.duration).toBe(1000);
          expect(close).toBeInstanceOf(ToastCloseAria);

          cleanup();

          expect(toast.current).toBeNull();
          expect(close!.current).toBeNull();
        });
      }));

    it('reports no duration when none is given', () =>
      scope.run(() => {
        component().run(() => {
          const { toast, cleanup } = buildToast();

          expect(toast.duration).toBeUndefined();

          const bare = aria('toast');
          expect(bare.duration).toBeUndefined();
          bare.destroy();

          cleanup();
        });
      }));

    it('arms no timer without a duration', () =>
      scope.run(() => {
        component().run(() => {
          const targets: EventTarget[] = [];
          const listener = (event: Event) => targets.push(event.target!);
          document.body.addEventListener('dismiss', listener);

          const toast = aria('toast');
          expect(toast).toBeInstanceOf(ToastAria);
          expect(toast.dismissed).toBe(false);

          const toastEl = bind(document.createElement('div'), toast);
          document.body.appendChild(toastEl);

          vi.advanceTimersByTime(20000);
          expect(targets).toEqual([]);
          expect(toast.dismissed).toBe(false);

          document.body.removeEventListener('dismiss', listener);
          toast.destroy();
          toastEl.remove();
        });
      }));

    it('records expiry without an audience when the toast was never bound', () =>
      scope.run(() => {
        component().run(() => {
          const toast = aria('toast', { duration: 1000 });

          vi.advanceTimersByTime(1000);
          expect(toast.dismissed).toBe(true);

          toast.destroy();
        });
      }));

    it('cancels a pending timer when the toast is torn down', () =>
      scope.run(() => {
        component().run(() => {
          const { toast, toastEl, cleanup } = buildToast({ duration: 1000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          toast.destroy();
          toastEl.remove();

          vi.advanceTimersByTime(5000);
          expect(targets).toEqual([]);

          cleanup();
        });
      }));
  });

  describe('Pause & resume boundaries', () => {
    it('ignores a repeated pointerenter while already paused', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 2000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          vi.advanceTimersByTime(1000);
          toastEl.dispatchEvent(new Event('pointerenter'));
          toastEl.dispatchEvent(new Event('pointerenter'));

          vi.advanceTimersByTime(5000);
          expect(targets).toEqual([]);

          toastEl.dispatchEvent(new Event('pointerleave'));
          vi.advanceTimersByTime(1000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('ignores a pointerleave while the timer is already running', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 2000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          toastEl.dispatchEvent(new Event('pointerleave'));

          vi.advanceTimersByTime(2000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('ignores pause and resume signals after dismissal', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, closeEl, cleanup } = buildToast({ duration: 4000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          closeEl!.click();
          expect(targets).toEqual([toastEl]);

          toastEl.dispatchEvent(new Event('pointerenter'));
          toastEl.dispatchEvent(new Event('pointerleave'));
          toastEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

          vi.advanceTimersByTime(10000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));

    it('stays paused while focus moves within the toast', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, closeEl, cleanup } = buildToast({ duration: 2000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          vi.advanceTimersByTime(1000);
          toastEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
          toastEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: closeEl }));

          vi.advanceTimersByTime(5000);
          expect(targets).toEqual([]);

          toastEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

          vi.advanceTimersByTime(1000);
          expect(targets).toEqual([toastEl]);

          cleanup();
        });
      }));
  });

  describe('Close button boundaries', () => {
    it('does nothing when no enclosing toast exists', () =>
      scope.run(() => {
        component().run(() => {
          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          const close = aria('toast-close');
          const closeEl = bind(document.createElement('button'), close);
          document.body.appendChild(closeEl);

          expect(() => closeEl.click()).not.toThrow();
          expect(targets).toEqual([]);

          close.destroy();
          closeEl.remove();
        });
      }));

    it('ignores activation while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 1000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          const disabled = aria('toast-close', { disabled: true });
          const disabledEl = bind(document.createElement('button'), disabled);
          toastEl.appendChild(disabledEl);

          expect(disabledEl.disabled).toBe(true);
          disabledEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(targets).toEqual([]);

          disabled.destroy();
          disabledEl.remove();
          cleanup();
        });
      }));

    it('yields a click the consumer canceled', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 1000 });

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          const close = aria('toast-close');
          const closeEl = document.createElement('button');
          closeEl.addEventListener('click', (event) => event.preventDefault());
          bind(closeEl, close);
          toastEl.appendChild(closeEl);

          closeEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          expect(targets).toEqual([]);

          close.destroy();
          closeEl.remove();
          cleanup();
        });
      }));

    it('polyfills the button contract on a non-native host', () =>
      scope.run(() => {
        component().run(() => {
          const { toastEl, cleanup } = buildToast({ duration: 1000 }, false);

          const targets: EventTarget[] = [];
          document.body.addEventListener('dismiss', (event) => targets.push(event.target!));

          const close = aria('toast-close', {}, { native: false });
          const closeEl = bind(document.createElement('div'), close);
          toastEl.appendChild(closeEl);

          expect(closeEl.getAttribute('role')).toBe('button');
          expect(closeEl.getAttribute('tabindex')).toBe('0');
          expect(closeEl.hasAttribute('type')).toBe(false);

          closeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(targets).toEqual([toastEl]);

          close.destroy();
          closeEl.remove();

          const disabled = aria('toast-close', { disabled: true }, { native: false });
          const disabledEl = bind(document.createElement('div'), disabled);
          toastEl.appendChild(disabledEl);

          expect(disabledEl.getAttribute('tabindex')).toBe('-1');
          expect(disabledEl.getAttribute('aria-disabled')).toBe('true');

          disabledEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          expect(targets).toEqual([toastEl]);

          disabled.destroy();
          disabledEl.remove();
          cleanup();
        });
      }));
  });
});
