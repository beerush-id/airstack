import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type CheckboxEvent, type CheckboxProps, type SelectionEvent, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Checkbox - Coverage (events, guards & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Custom Host Event Contract', () => {
    it('dispatches change and input with the committed detail on pointer activation', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });
          const el = bind(document.createElement('div'), cb);

          const seen: Array<{ type: string; detail: unknown }> = [];
          el.addEventListener('change', (event) => {
            seen.push({ type: 'change', detail: (event as SelectionEvent).detail });
          });
          el.addEventListener('input', (event) => {
            seen.push({ type: 'input', detail: (event as CheckboxEvent).detail });
          });

          el.click();
          expect(cb.checked).toBe(true);
          expect(seen).toEqual([
            { type: 'change', detail: true },
            { type: 'input', detail: true },
          ]);

          el.click();
          expect(cb.checked).toBe(false);
          expect(seen).toEqual([
            { type: 'change', detail: true },
            { type: 'input', detail: true },
            { type: 'change', detail: false },
            { type: 'input', detail: false },
          ]);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('fires a click through Space keyup so outer click listeners observe keyboard activation', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });
          const el = bind(document.createElement('div'), cb);

          let clicks = 0;
          el.addEventListener('click', () => {
            clicks += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(cb.checked).toBe(true);
          expect(clicks).toBe(1);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('commits nothing and fires no events when the keyup trigger is canceled', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });
          const el = bind(document.createElement('div'), cb);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });
          el.addEventListener('input', () => {
            events += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          // Pre-cancel the trigger: the controller must observe defaultPrevented and refuse the commit
          const keyup = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          keyup.preventDefault();
          el.dispatchEvent(keyup);
          expect(cb.checked).toBe(false);
          expect(events).toBe(0);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('fires no events on activation attempts while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { disabled: true }, { native: false });
          const el = bind(document.createElement('div'), cb);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });
          el.addEventListener('input', () => {
            events += 1;
          });

          el.click();
          cb.select();
          cb.toggle();
          expect(cb.checked).toBe(false);
          expect(events).toBe(0);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('runs internal transitions before consumer refiner click listeners', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });
          const el = bind(document.createElement('div'), cb);

          let observed: boolean | null = null;
          cb.refine(() => ({
            onclick: () => {
              observed = cb.checked;
            },
          }));

          el.click();
          expect(cb.checked).toBe(true);
          expect(observed).toBe(true);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Direct Mutation Aliases', () => {
    it('clears mixed and commits unchecked through deselect', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { checked: true, indeterminate: true }, { native: false });
          const el = bind(document.createElement('div'), cb);
          expect(el.getAttribute('aria-checked')).toBe('mixed');

          const seen: unknown[] = [];
          el.addEventListener('change', (event) => {
            seen.push((event as SelectionEvent).detail);
          });

          cb.deselect();
          expect(cb.checked).toBe(false);
          expect(cb.indeterminate).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(seen).toEqual([false]);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('refuses direct deselect while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { checked: true, disabled: true }, { native: false });
          const el = bind(document.createElement('div'), cb);

          cb.deselect();
          expect(cb.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Group Membership Guards', () => {
    it('never duplicates a candidate value on repeated selection', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: ['promos'], multiple: true });
          selectionGroup.set(group);

          const cb = aria<HTMLDivElement>('checkbox', { value: 'promos' }, { native: false });
          expect(cb.checked).toBe(true);

          cb.select();
          cb.select();
          expect(group.value).toEqual(['promos']);

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('follows the controller across a detach-and-reattach cycle', () =>
      scope.run(() => {
        component().run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { checked: true }, { native: false });
          const first = bind(document.createElement('div'), cb);
          expect(first.getAttribute('aria-checked')).toBe('true');

          cb.ref(null);
          expect(cb.current).toBeNull();

          const second = document.createElement('div');
          cb.ref(second);
          document.body.appendChild(second);
          expect(cb.current).toBe(second);
          expect(second.getAttribute('role')).toBe('checkbox');
          expect(second.getAttribute('aria-checked')).toBe('true');

          second.click();
          expect(cb.checked).toBe(false);
          expect(second.getAttribute('aria-checked')).toBe('false');

          cb.destroy();
          first.remove();
          second.remove();
          expect(cb.current).toBeNull();
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
            const cb = aria('checkbox', { checked: true });
            cb.destroy();
          } finally {
            restore();
          }
          expect(reads).toEqual([]);
        });
      }));
  });
});

describe('Attribute Shielding Contract', () => {
  const shieldScope = createLifecycle();

  afterAll(() => {
    shieldScope.destroy();
  });

  it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
    shieldScope.run(() => {
      component().run(() => {
        const checkbox = aria<HTMLDivElement>(
          'checkbox',
          { value: 'terms', checked: false, disabled: false },
          { native: false }
        );

        for (const key of ['value', 'checked', 'disabled', 'name', 'aria-checked', 'tabindex']) {
          expect(checkbox.ownKeys).toContain(key);
        }

        checkbox.destroy();
        expect(checkbox.current).toBeNull();
      });
    }));
});
