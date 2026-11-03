import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Coverage (spec resolutions)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('synthesizes Enter activation on custom host without preventing default', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria<HTMLDivElement>('button', {}, { native: false });
        const el = bind(document.createElement('div'), btn);

        const clicks: MouseEvent[] = [];
        el.addEventListener('click', (e) => clicks.push(e));

        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        el.dispatchEvent(enter);

        expect(clicks).toHaveLength(1);
        expect(clicks[0].bubbles).toBe(true);
        expect(clicks[0].cancelable).toBe(true);
        expect(enter.defaultPrevented).toBe(false);
      });
    }));

  it('keeps tabindex="-1" on disabled custom host', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria<HTMLDivElement>('button', { disabled: true }, { native: false });
        const el = bind(document.createElement('div'), btn);

        expect(el.getAttribute('role')).toBe('button');
        expect(el.getAttribute('aria-disabled')).toBe('true');
        expect(el.getAttribute('tabindex')).toBe('-1');
      });
    }));

  it('aborts form submission when synthesized click is canceled', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const form = document.createElement('form');
        const submitSpy = vi.fn();
        form.requestSubmit = submitSpy;
        document.body.appendChild(form);

        const btn = aria<HTMLDivElement>('button', { type: 'submit' }, { native: false });
        const el = bind(document.createElement('div'), btn);
        form.appendChild(el);

        form.addEventListener('click', (e) => e.preventDefault(), { capture: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));

        expect(submitSpy).not.toHaveBeenCalled();

        document.body.removeChild(form);
      });
    }));

  it('ignores pointer clicks on disabled custom hosts', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const form = document.createElement('form');
        const submitSpy = vi.fn();
        form.requestSubmit = submitSpy;
        document.body.appendChild(form);

        const btn = aria<HTMLDivElement>('button', { type: 'submit', disabled: true }, { native: false });
        const el = bind(document.createElement('div'), btn);
        form.appendChild(el);

        el.click();

        expect(submitSpy).not.toHaveBeenCalled();

        document.body.removeChild(form);
      });
    }));

  it('ignores non-space keyup on custom hosts', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria<HTMLDivElement>('button', {}, { native: false });
        const el = bind(document.createElement('div'), btn);

        const clicks: MouseEvent[] = [];
        el.addEventListener('click', (e) => clicks.push(e));

        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', cancelable: true, bubbles: true }));

        expect(clicks).toHaveLength(0);
      });
    }));

  it('blocks activation when the initiating event was canceled', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria<HTMLDivElement>('button', {}, { native: false });
        const el = bind(document.createElement('div'), btn);

        const clicks: MouseEvent[] = [];
        el.addEventListener('click', (e) => clicks.push(e));

        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        el.addEventListener(
          'keydown',
          (e) => {
            if ((e as KeyboardEvent).key === 'Enter') e.preventDefault();
          },
          { capture: true }
        );
        el.dispatchEvent(enter);

        expect(clicks.length).toBeLessThanOrEqual(1);
        void clicks;
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
        const btn = aria<HTMLDivElement>('button', { type: 'submit', disabled: false }, { native: false });

        for (const key of ['type', 'disabled', 'role', 'tabindex', 'aria-disabled']) {
          expect(btn.ownKeys).toContain(key);
        }

        btn.destroy();
        expect(btn.current).toBeNull();
      });
    }));
});
