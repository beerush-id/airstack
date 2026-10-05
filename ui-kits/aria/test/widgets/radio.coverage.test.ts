import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Radio - Coverage (events, guards & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Custom Host Event Contract', () => {
    it('dispatches change with the committed detail once, then stays silent on re-activation', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), r);

          const seen: unknown[] = [];
          el.addEventListener('change', (event) => {
            seen.push((event as CustomEvent).detail);
          });

          el.click();
          expect(r.checked).toBe(true);
          expect(group.value).toBe('b');
          expect(seen).toEqual([true]);

          el.click();
          expect(r.checked).toBe(true);
          expect(group.value).toBe('b');
          expect(seen).toEqual([true]);

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('fires a click through Space keyup so outer click listeners observe keyboard activation', () =>
      scope.run(() => {
        component().run(() => {
          const r = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), r);

          let clicks = 0;
          el.addEventListener('click', () => {
            clicks += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(r.checked).toBe(true);
          expect(clicks).toBe(1);

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('commits nothing and fires no events when the keyup trigger is canceled', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), r);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          const keyup = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          keyup.preventDefault();
          el.dispatchEvent(keyup);
          expect(r.checked).toBe(false);
          expect(group.value).toBe('a');
          expect(events).toBe(0);

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('fires no events on activation attempts while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'b', disabled: true }, { native: false });
          const el = bind(document.createElement('div'), r);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });

          el.click();
          r.select();
          r.toggle();
          expect(r.checked).toBe(false);
          expect(group.value).toBe('a');
          expect(events).toBe(0);

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('runs internal transitions before consumer refiner click listeners', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), r);

          let observed: boolean | null = null;
          let observedGroup: unknown = null;
          r.refine(() => ({
            onclick: () => {
              observed = r.checked;
              observedGroup = group.value;
            },
          }));

          el.click();
          expect(r.checked).toBe(true);
          expect(observed).toBe(true);
          expect(observedGroup).toBe('b');

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));
  });

  describe('Select-Only Mutation Contract', () => {
    it('swallows checked=false through the projection while the holder keeps the slot', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const el = bind(document.createElement('div'), r);
          expect(r.checked).toBe(true);

          const seen: unknown[] = [];
          el.addEventListener('change', (event) => {
            seen.push((event as CustomEvent).detail);
          });

          r.checked = false;
          expect(r.checked).toBe(true);
          expect(group.value).toBe('a');
          expect(el.getAttribute('aria-checked')).toBe('true');
          expect(seen).toEqual([]);

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('refuses deselect and toggle-off on the holder, keeping the single slot', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const el = bind(document.createElement('div'), r);

          r.deselect();
          expect(group.value).toBe('a');
          expect(r.checked).toBe(true);

          r.toggle();
          expect(group.value).toBe('a');
          expect(r.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('starts empty and commits the first selection without a toggle-off path', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable<{ value: string | null }>({ value: null });
          selectionGroup.set(group);

          const rA = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const rB = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const elA = bind(document.createElement('div'), rA);
          const elB = bind(document.createElement('div'), rB);

          expect(rA.checked).toBe(false);
          expect(rB.checked).toBe(false);
          expect(elA.getAttribute('aria-checked')).toBe('false');
          expect(elB.getAttribute('aria-checked')).toBe('false');

          elB.click();
          expect(group.value).toBe('b');
          expect(rB.checked).toBe(true);
          expect(elB.getAttribute('aria-checked')).toBe('true');
          expect(elB.getAttribute('tabindex')).toBe('0');
          expect(elA.getAttribute('tabindex')).toBe('-1');

          rA.destroy();
          rB.destroy();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('shields compiled state keys from consumer refine overrides', () =>
      scope.run(() => {
        component().run(() => {
          const r = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), r);

          r.refine(() => ({
            'aria-checked': 'true',
          }));

          expect(r.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(el.getAttribute('role')).toBe('radio');

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const r = aria<HTMLDivElement>(
            'radio',
            { value: 'b', name: 'plan', disabled: false },
            { native: false },
          );

          for (const key of ['value', 'name', 'disabled', 'checked', 'aria-checked', 'tabindex']) {
            expect(r.ownKeys).toContain(key);
          }

          r.destroy();
          expect(r.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('follows the controller across a detach-and-reattach cycle', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const r = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const first = bind(document.createElement('div'), r);
          expect(first.getAttribute('aria-checked')).toBe('true');

          r.ref(null);
          expect(r.current).toBeNull();

          const second = document.createElement('div');
          r.ref(second);
          document.body.appendChild(second);
          expect(r.current).toBe(second);
          expect(second.getAttribute('role')).toBe('radio');
          expect(second.getAttribute('aria-checked')).toBe('true');

          group.value = 'b';
          expect(second.getAttribute('aria-checked')).toBe('false');

          r.destroy();
          first.remove();
          second.remove();
          expect(r.current).toBeNull();
        });
      }));

    it('constructs without frozen reactive reads in setup-like context', () =>
      scope.run(() => {
        component().run(() => {
          const reads: string[] = [];
          const restore = setStaticTracker((_init, key) => {
            if (typeof key === 'symbol') return;
            reads.push(String(key));
          });
          try {
            const r = aria('radio', { value: 'a' });
            r.destroy();
          } finally {
            restore();
          }
          expect(reads).toEqual([]);
        });
      }));
  });
});
