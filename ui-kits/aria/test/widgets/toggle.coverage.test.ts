import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ToggleProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Toggle - Coverage (change contract & context safety)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('dispatches a bubbling change carrying pressed on both hosts', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const native = aria('toggle', { pressed: false });
        const nativeEl = bind(document.createElement('button'), native);
        const nativeChanges: Array<{ detail: unknown; bubbles: boolean }> = [];
        nativeEl.addEventListener('change', (event) =>
          nativeChanges.push({ detail: (event as CustomEvent).detail, bubbles: event.bubbles })
        );

        nativeEl.click();
        nativeEl.click();
        native.select();
        native.select();
        expect(nativeChanges).toEqual([
          { detail: true, bubbles: true },
          { detail: false, bubbles: true },
          { detail: true, bubbles: true },
        ]);

        const custom = aria<HTMLDivElement>('toggle', { pressed: false }, { native: false });
        const customEl = bind(document.createElement('div'), custom);
        const customChanges: unknown[] = [];
        customEl.addEventListener('change', (event) => customChanges.push((event as CustomEvent).detail));

        customEl.click();
        customEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
        expect(customChanges).toEqual([true, false]);

        native.destroy();
        custom.destroy();
      });
    }));

  it('commits no change for canceled triggers, disabled hosts, or idempotent reselection', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria<HTMLDivElement>('toggle', { pressed: false }, { native: false });
        const el = bind(document.createElement('div'), btn);
        const changes: unknown[] = [];
        el.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

        el.addEventListener('click', (event) => event.preventDefault(), { capture: true, once: true });
        el.click();
        expect(btn.pressed).toBe(false);
        expect(changes).toEqual([]);

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
        expect(btn.pressed).toBe(true);
        expect(changes).toEqual([true]);

        el.addEventListener(
          'keydown',
          (event) => {
            if ((event as KeyboardEvent).key === ' ') event.preventDefault();
          },
          { capture: true }
        );
        el.addEventListener('keyup', (event) => event.preventDefault(), { capture: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
        expect(btn.pressed).toBe(true);
        expect(changes).toEqual([true]);

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', cancelable: true, bubbles: true }));
        expect(btn.pressed).toBe(true);
        expect(changes).toEqual([true]);

        const locked = aria('toggle', { pressed: false, disabled: true });
        const lockedEl = bind(document.createElement('button'), locked);
        const lockedChanges: unknown[] = [];
        lockedEl.addEventListener('change', (event) => lockedChanges.push((event as CustomEvent).detail));
        lockedEl.click();
        locked.select();
        expect(lockedChanges).toEqual([]);

        btn.destroy();
        locked.destroy();
      });
    }));

  it('commits silently without a bound element', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<ToggleProps>({ pressed: false });
        const btn = aria('toggle', props);
        btn.toggle();
        expect(btn.pressed).toBe(true);

        const el = bind(document.createElement('button'), btn);
        expect(el.getAttribute('aria-pressed')).toBe('true');

        btn.destroy();
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
        const toggle = aria<HTMLDivElement>(
          'toggle',
          { value: 'bold', pressed: false, disabled: false },
          { native: false }
        );

        for (const key of ['value', 'pressed', 'disabled', 'aria-pressed', 'tabindex']) {
          expect(toggle.ownKeys).toContain(key);
        }

        toggle.destroy();
        expect(toggle.current).toBeNull();
      });
    }));
});
