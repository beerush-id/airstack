import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Switch - Coverage (events, guards & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Custom Host Event Contract', () => {
    it('dispatches change and input with the committed detail on pointer activation', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          const seen: Array<{ type: string; detail: unknown }> = [];
          el.addEventListener('change', (event) => {
            seen.push({ type: 'change', detail: (event as CustomEvent).detail });
          });
          el.addEventListener('input', (event) => {
            seen.push({ type: 'input', detail: (event as CustomEvent).detail });
          });

          el.click();
          expect(sw.checked).toBe(true);
          expect(seen).toEqual([
            { type: 'change', detail: true },
            { type: 'input', detail: true },
          ]);

          el.click();
          expect(sw.checked).toBe(false);
          expect(seen).toEqual([
            { type: 'change', detail: true },
            { type: 'input', detail: true },
            { type: 'change', detail: false },
            { type: 'input', detail: false },
          ]);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('fires a click through Space keyup so outer click listeners observe keyboard activation', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          let clicks = 0;
          el.addEventListener('click', () => {
            clicks += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(sw.checked).toBe(true);
          expect(clicks).toBe(1);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('commits nothing and fires no events when the keyup trigger is canceled', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });
          el.addEventListener('input', () => {
            events += 1;
          });

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          const keyup = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          keyup.preventDefault();
          el.dispatchEvent(keyup);
          expect(sw.checked).toBe(false);
          expect(events).toBe(0);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('commits nothing when the Enter trigger is canceled', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });

          const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          enter.preventDefault();
          el.dispatchEvent(enter);
          expect(sw.checked).toBe(false);
          expect(events).toBe(0);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('fires no events on activation attempts while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', { disabled: true }, { native: false });
          const el = bind(document.createElement('div'), sw);

          let events = 0;
          el.addEventListener('change', () => {
            events += 1;
          });
          el.addEventListener('input', () => {
            events += 1;
          });

          el.click();
          sw.select();
          sw.deselect();
          sw.toggle();
          sw.checked = true;
          expect(sw.checked).toBe(false);
          expect(events).toBe(0);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('runs internal transitions before consumer refiner click listeners', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          let observed: boolean | null = null;
          sw.refine(() => ({
            onclick: () => {
              observed = sw.checked;
            },
          }));

          el.click();
          expect(sw.checked).toBe(true);
          expect(observed).toBe(true);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));
  });

  describe('Direct Mutation Aliases', () => {
    it('flips state through the checked projection with committed events', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          const seen: unknown[] = [];
          el.addEventListener('change', (event) => {
            seen.push((event as CustomEvent).detail);
          });

          sw.checked = true;
          expect(sw.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          sw.checked = false;
          expect(sw.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(seen).toEqual([true, false]);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('announces direct select and deselect calls with input events', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          const seen: unknown[] = [];
          el.addEventListener('input', (event) => {
            seen.push((event as CustomEvent).detail);
          });

          sw.select();
          expect(sw.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          sw.deselect();
          expect(sw.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(seen).toEqual([true, false]);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('commits silently without a host and syncs on bind', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          expect(sw.current).toBeNull();

          sw.checked = true;
          expect(sw.checked).toBe(true);

          const el = bind(document.createElement('div'), sw);
          expect(el.getAttribute('aria-checked')).toBe('true');

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('coordinates valued members through the group slot while valueless members stay local', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable<{ value: string | null }>({ value: null });
          selectionGroup.set(group);

          const sA = aria<HTMLDivElement>('switch', { value: 'a' }, { native: false });
          const sB = aria<HTMLDivElement>('switch', { value: 'b' }, { native: false });
          const lone = aria<HTMLDivElement>('switch', { checked: false }, { native: false });
          const elA = bind(document.createElement('div'), sA);
          const elB = bind(document.createElement('div'), sB);
          const elLone = bind(document.createElement('div'), lone);

          elA.click();
          expect(group.value).toBe('a');
          expect(sA.checked).toBe(true);
          expect(elA.getAttribute('aria-checked')).toBe('true');

          elLone.click();
          expect(lone.checked).toBe(true);
          expect(group.value).toBe('a');
          expect(elLone.getAttribute('aria-checked')).toBe('true');

          elB.click();
          expect(group.value).toBe('b');
          expect(sB.checked).toBe(true);
          expect(sA.checked).toBe(false);
          expect(elB.getAttribute('aria-checked')).toBe('true');

          sA.destroy();
          sB.destroy();
          lone.destroy();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('shields compiled state keys from consumer refine overrides', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', {}, { native: false });
          const el = bind(document.createElement('div'), sw);

          sw.refine(() => ({
            'aria-checked': 'true',
          }));

          expect(sw.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(el.getAttribute('role')).toBe('switch');

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>(
            'switch',
            { value: 'a', name: 'alerts', disabled: false },
            { native: false },
          );

          for (const key of ['value', 'name', 'disabled', 'checked', 'aria-checked', 'tabindex']) {
            expect(sw.ownKeys).toContain(key);
          }

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('follows the controller across a detach-and-reattach cycle', () =>
      scope.run(() => {
        component().run(() => {
          const sw = aria<HTMLDivElement>('switch', { checked: true }, { native: false });
          const first = bind(document.createElement('div'), sw);
          expect(first.getAttribute('aria-checked')).toBe('true');

          sw.ref(null);
          expect(sw.current).toBeNull();

          const second = document.createElement('div');
          sw.ref(second);
          document.body.appendChild(second);
          expect(sw.current).toBe(second);
          expect(second.getAttribute('role')).toBe('switch');
          expect(second.getAttribute('aria-checked')).toBe('true');

          second.click();
          expect(sw.checked).toBe(false);
          expect(second.getAttribute('aria-checked')).toBe('false');

          sw.destroy();
          first.remove();
          second.remove();
          expect(sw.current).toBeNull();
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
            const sw = aria('switch', { checked: true });
            sw.destroy();
          } finally {
            restore();
          }
          expect(reads).toEqual([]);
        });
      }));
  });
});
