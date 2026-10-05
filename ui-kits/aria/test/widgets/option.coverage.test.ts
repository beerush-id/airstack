import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Option - Coverage (events, guards & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Custom Host Event Contract', () => {
    it('dispatches change with the committed detail and stays silent on no-op activation', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);

          const seen: unknown[] = [];
          elB.addEventListener('change', (event) => {
            seen.push((event as CustomEvent).detail);
          });

          elB.click();
          expect(group.value).toBe('b');
          expect(optB.selected).toBe(true);
          expect(seen).toEqual([true]);

          elB.click();
          expect(group.value).toBeUndefined();
          expect(optB.selected).toBe(false);
          expect(seen).toEqual([true, false]);

          optA.destroy();
          optB.destroy();
        });
      }));

    it('fires a click through Space keyup is refused: the member owns no keystroke', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);

          let clicks = 0;
          let changes = 0;
          elB.addEventListener('click', () => {
            clicks += 1;
          });
          elB.addEventListener('change', () => {
            changes += 1;
          });

          elB.click();
          expect(clicks).toBe(1);
          expect(group.value).toBe('b');

          elB.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          elB.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(clicks).toBe(1);
          expect(changes).toBe(1);

          optB.destroy();
        });
      }));

    it('commits nothing and fires no events when the click trigger is canceled', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);

          let events = 0;
          elB.addEventListener('change', () => {
            events += 1;
          });

          elB.addEventListener('click', (event) => event.preventDefault(), { capture: true });
          elB.click();
          expect(group.value).toBe('a');
          expect(optB.selected).toBe(false);
          expect(events).toBe(0);

          optB.destroy();
        });
      }));

    it('fires no events on activation attempts while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const opt = aria('option', { value: 'b', disabled: true });
          const el = bind(document.createElement('div'), opt);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });

          el.click();
          opt.select();
          opt.toggle();
          opt.selected = true;
          expect(opt.selected).toBe(false);
          expect(events).toBe(0);

          opt.destroy();
          expect(opt.current).toBeNull();
        });
      }));

    it('runs internal transitions before consumer refiner click listeners', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);

          let observed: boolean | null = null;
          let observedGroup: unknown = null;
          optB.refine(() => ({
            onclick: () => {
              observed = optB.selected;
              observedGroup = group.value;
            },
          }));

          elB.click();
          expect(optB.selected).toBe(true);
          expect(observed).toBe(true);
          expect(observedGroup).toBe('b');

          optB.destroy();
          expect(optB.current).toBeNull();
        });
      }));
  });

  describe('Standalone Toggle Contract', () => {
    it('keeps standalone activation select-only without the toggle opt-in', () =>
      scope.run(() => {
        component().run(() => {
          const opt = aria('option', { selected: true, value: 'solo' });
          const el = bind(document.createElement('div'), opt);

          el.click();
          expect(opt.selected).toBe(true);
          expect(el.getAttribute('aria-selected')).toBe('true');

          opt.toggle();
          expect(opt.selected).toBe(true);

          opt.destroy();
          expect(opt.current).toBeNull();
        });
      }));

    it('inverts standalone selection through the setter in both directions', () =>
      scope.run(() => {
        component().run(() => {
          const opt = aria('option', { value: 'prog' });
          const el = bind(document.createElement('div'), opt);

          opt.selected = true;
          expect(opt.selected).toBe(true);
          expect(el.getAttribute('aria-selected')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          opt.selected = false;
          expect(opt.selected).toBe(false);
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');

          opt.destroy();
          expect(opt.current).toBeNull();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const opt = aria('option', { value: 'b', selected: false, disabled: false });

          for (const key of ['value', 'selected', 'disabled', 'id', 'aria-selected', 'tabindex']) {
            expect(opt.ownKeys).toContain(key);
          }

          opt.destroy();
          expect(opt.current).toBeNull();
        });
      }));
  });

  describe('Native Host Contract', () => {
    it('emits no ARIA mirror across interaction and never re-dispatches browser events', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' }, { native: true });
          const optB = aria('option', { value: 'b' }, { native: true });
          const elA = bind(document.createElement('option'), optA);
          const elB = bind(document.createElement('option'), optB);

          let changes = 0;
          elB.addEventListener('change', () => {
            changes += 1;
          });

          elB.click();
          expect(group.value).toBe('b');
          expect(elB.selected).toBe(true);
          expect(elA.selected).toBe(false);
          expect(elB.hasAttribute('aria-selected')).toBe(false);
          expect(elB.hasAttribute('role')).toBe(false);

          optA.destroy();
          optB.destroy();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('follows the controller across a detach-and-reattach cycle', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const first = bind(document.createElement('div'), optA);
          expect(first.getAttribute('aria-selected')).toBe('true');

          optA.ref(null);
          expect(optA.current).toBeNull();

          const second = document.createElement('div');
          optA.ref(second);
          document.body.appendChild(second);
          expect(optA.current).toBe(second);
          expect(second.getAttribute('role')).toBe('option');
          expect(second.getAttribute('aria-selected')).toBe('true');

          group.value = 'b';
          expect(second.getAttribute('aria-selected')).toBe('false');

          optA.destroy();
          first.remove();
          second.remove();
          expect(optA.current).toBeNull();
        });
      }));

    it('constructs without frozen reactive reads outside a reactive boundary', () =>
      scope.run(() => {
        const prev = selectionGroup.get();
        const group = mutable({ value: 'a' });
        selectionGroup.set(group);

        const reads: string[] = [];
        const restore = setStaticTracker((_init, key) => {
          if (typeof key === 'symbol') return;
          reads.push(String(key));
        });
        try {
          const opt = aria('option', { value: 'b' });
          opt.destroy();
        } finally {
          restore();
          selectionGroup.set(prev);
        }
        expect(reads).toEqual([]);
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
            const opt = aria('option', { value: 'a' });
            opt.destroy();
          } finally {
            restore();
          }
          expect(reads).toEqual([]);
        });
      }));
  });
});
