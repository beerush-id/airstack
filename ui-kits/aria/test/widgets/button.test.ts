import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ButtonProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Action Trigger Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for standard action buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase: native button defaults to type="button", disabled=false
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.tabindex).toBeUndefined();
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-disabled']).toBeUndefined();
          expect(btn.attributes['aria-pressed']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('tabindex')).toBeNull();
          expect(el.getAttribute('aria-pressed')).toBeNull();

          // 3. Interaction Phase: forwards click events
          const clickSpy = vi.fn();
          el.addEventListener('click', clickSpy);
          el.click();
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));
  });

  describe('Disabled State Contract', () => {
    it('follows SSR -> Mount -> Interaction lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { disabled: true });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);
          expect(btn.attributes.type).toBe('button');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.disabled).toBe(true);
        });
      }));
  });

  describe('Native Form Equivalence Contract', () => {
    it('submits enclosing form via requestSubmit when non-native submit button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const submitSpy = vi.fn();
          form.requestSubmit = submitSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'submit' }, { native: false });

          // 1. SSR Phase: preserves submit type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('submit');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.requestSubmit()
          div.click();
          expect(submitSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));

    it('resets enclosing form when non-native reset button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const resetSpy = vi.fn();
          form.reset = resetSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'reset' }, { native: false });

          // 1. SSR Phase: preserves reset type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('reset');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.reset()
          div.click();
          expect(resetSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));
  });

  describe('Keyboard Activation Contract', () => {
    it('activates non-native element on Enter keydown and prevents default navigation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase: attributes omit event handlers
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          div.dispatchEvent(enterDown);

          expect(enterDown.defaultPrevented).toBe(true);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('prevents default scroll on Space keydown and activates on Space keyup for non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          // Space keydown: suppresses scroll without clicking
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(clickSpy).not.toHaveBeenCalled();

          // Space keyup: activates via click
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceUp);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('delegates keyboard navigation directly to the browser for native <button> elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const button = bind(document.createElement('button'), btn);
          expect(btn.isNative).toBe(true);
          expect(btn.current).toBe(button);

          // 3. Interaction Phase: native buttons leave defaultPrevented to false
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          button.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);

          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          button.dispatchEvent(enterDown);
          expect(enterDown.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Accessibility Semantics Contract', () => {
    it('applies standard ARIA role, tabindex, and disabled states across native and custom elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBtn = aria('button');
          const buttonEl = bind(document.createElement('button'), nativeBtn);

          expect(buttonEl.getAttribute('role')).toBeNull();
          expect(buttonEl.getAttribute('tabindex')).toBeNull();
          expect(buttonEl.disabled).toBe(false);

          const customBtn = aria<HTMLDivElement>('button', {}, { native: false });
          const divEl = bind(document.createElement('div'), customBtn);

          expect(divEl.getAttribute('role')).toBe('button');
          expect(divEl.getAttribute('tabindex')).toBe('0');
          expect(divEl.getAttribute('aria-disabled')).toBe('false');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('cleans up element bindings on destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ButtonProps>({ disabled: false });
          const btn = aria('button', props);
          const button = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(button);

          // Destruction releases element reference
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('detaches cleanly on ref(null)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');
          const el = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(el);
          btn.ref(null);
          expect(btn.current).toBeNull();
        });
      }));
  });

  describe('Interactive Action & Event Dispatch Invariant', () => {
    it('completes the full action cycle on a native host and forwards a bubbling click to consumers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. Creation & SSR: implicit role omitted, defensive type emitted, no on* keys serialized
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.tabindex).toBeUndefined();
          expect(Object.keys(btn.attributes).filter((key) => key.startsWith('on'))).toEqual([]);

          // 2. DOM Binding
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.type).toBe('button');

          // 3. Interaction + 4. Event dispatch contract: consumer listener observes one click
          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          const delegatedClicks: MouseEvent[] = [];
          const onDocumentClick = (event: Event) => delegatedClicks.push(event as MouseEvent);
          document.addEventListener('click', onDocumentClick);

          el.click();

          expect(hostClicks).toHaveLength(1);
          expect(hostClicks[0].type).toBe('click');
          expect(hostClicks[0].bubbles).toBe(true);
          expect(hostClicks[0].cancelable).toBe(true);
          expect(hostClicks[0].target).toBe(el);
          expect(delegatedClicks).toHaveLength(1);

          document.removeEventListener('click', onDocumentClick);

          // 5. DOM Reconciliation: comparator change reflects live without rebinding
          btn.assign({ disabled: true });
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);
          expect(el.disabled).toBe(true);

          // 6. Teardown
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('compiles an explicit button role on a non-native host and synthesizes activation click on Enter keydown', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. Creation & SSR: pure ARIA projection, invalid HTML attributes omitted
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBe('button');
          expect(btn.attributes.tabindex).toBe('0');
          expect(btn.attributes['aria-disabled']).toBe('false');
          expect(btn.attributes.type).toBeUndefined();
          expect(btn.attributes.disabled).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('role')).toBe('button');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-disabled')).toBe('false');

          // 3. Interaction + 4. Event dispatch contract
          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          const enterDown = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enterDown);

          expect(enterDown.defaultPrevented).toBe(true);
          expect(hostClicks).toHaveLength(1);
          expect(hostClicks[0].bubbles).toBe(true);
          expect(hostClicks[0].cancelable).toBe(true);
          expect(hostClicks[0].target).toBe(el);

          // 5. DOM Reconciliation: disabled collapses tabindex and aria-disabled live
          btn.assign({ disabled: true });
          expect(btn.attributes['aria-disabled']).toBe('true');
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          // 6. Teardown: detached host no longer synthesizes activation
          btn.destroy();
          expect(btn.current).toBeNull();

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);
        });
      }));

    it('preserves an author-declared type across mount and reactive reconciliation on a native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { type: 'submit' } satisfies ButtonProps);

          // 1. Creation & SSR: declared type wins over the defensive default
          expect(btn.attributes.type).toBe('submit');

          // 2. DOM Binding
          const el = bind(document.createElement('button'), btn);
          expect(el.type).toBe('submit');

          // 3. Interaction + 5. Reconciliation
          btn.assign({ type: 'reset' });
          expect(btn.attributes.type).toBe('reset');
          expect(el.type).toBe('reset');

          // 6. Teardown
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('leaves non-activation keys untouched on a non-native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          const el = bind(document.createElement('div'), btn);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          for (const key of ['ArrowDown', 'Tab', 'Escape', 'a', ' ']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);

            // Space on keydown is the scroll-suppression exception: prevented, never activating
            expect(event.defaultPrevented).toBe(key === ' ');
          }

          expect(hostClicks).toHaveLength(0);

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('keeps a non-native host declared disabled at creation inert across every activation path', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', { disabled: true }, { native: false });

          // 1. Creation & SSR: inert state compiled before any DOM exists
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.role).toBe('button');
          expect(btn.attributes['aria-disabled']).toBe('true');
          expect(btn.attributes.tabindex).toBe('-1');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), btn);
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          // 3. Interaction + 4. Dispatch suppression across all keyboard activation stimuli
          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          const enterDown = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enterDown);

          const spaceDown = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(spaceDown);

          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          el.dispatchEvent(spaceUp);

          expect(hostClicks).toHaveLength(0);
          expect(enterDown.defaultPrevented).toBe(false);
          expect(spaceDown.defaultPrevented).toBe(false);
          expect(spaceUp.defaultPrevented).toBe(false);

          // 6. Teardown
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('delegates inertness to the browser on a native host declared disabled at creation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { disabled: true });

          // 1. Creation & SSR
          expect(btn.attributes.disabled).toBe(true);
          expect(btn.attributes['aria-disabled']).toBeUndefined();
          expect(btn.attributes.tabindex).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('button'), btn);
          expect(el.disabled).toBe(true);
          expect(el.hasAttribute('aria-disabled')).toBe(false);

          // 3/4. Native host: the browser itself refuses activation
          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          el.click();
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

          expect(hostClicks).toHaveLength(0);

          // 6. Teardown
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('goes inert live on a mounted non-native host without rebinding', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });
          const el = bind(document.createElement('div'), btn);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          // Baseline: activation works while enabled
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);

          // 5. Reconciliation: guard + tabindex collapse on the same live node
          btn.assign({ disabled: true });
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);

          // Restoring the comparator re-arms the polyfill on the same node
          btn.assign({ disabled: false });
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('0');

          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(2);

          // 6. Teardown
          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('exposes disabled and isNative as comparators that never accept writes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');
          bind(document.createElement('button'), btn);

          const writable = btn as unknown as { disabled: boolean; isNative: boolean };

          expect(btn.disabled).toBe(false);
          try {
            writable.disabled = true;
          } catch {
            // A getter-only accessor throwing under strict mode is the contract, not a failure
          }
          expect(btn.disabled).toBe(false);
          expect(btn.attributes.disabled).toBe(false);

          const nativeFlag = btn.isNative;
          try {
            writable.isNative = false;
          } catch {
            // Same: parity flag is fixed at construction by options
          }
          expect(btn.isNative).toBe(nativeFlag);

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Native Delegation Invariant', () => {
    it('activates exactly once per Space press on a non-native host despite key repeat', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });
          const el = bind(document.createElement('div'), btn);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          // Held key repeats keydown and delivers a single keyup: activation on keyup is repeat-safe
          for (let repeat = 0; repeat < 3; repeat += 1) {
            el.dispatchEvent(
              new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
            );
          }
          expect(hostClicks).toHaveLength(0);

          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(1);

          // A second press is a second activation, not a residual listener
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(2);

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('adds no synthetic activation for the same key sequence on a native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');
          const el = bind(document.createElement('button'), btn);

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          const stimuli: KeyboardEvent[] = [
            new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
            new KeyboardEvent('keyup', { key: 'Enter', cancelable: true, bubbles: true }),
          ];

          for (const event of stimuli) {
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(hostClicks).toHaveLength(0);

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('compiles strictly from options, never from the mounted tag', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const implicit = aria('button');
          const explicit = aria<HTMLButtonElement>('button', {}, { native: true });

          // Button wraps a native element by default: no boilerplate required
          expect(implicit.isNative).toBe(true);
          expect(implicit.attributes).toEqual(explicit.attributes);

          // Declaring native on a non-semantic host keeps native output: no role, no tabindex, no polyfill
          const nativeFlaggedDiv = bind(document.createElement('div'), implicit);
          expect(nativeFlaggedDiv.getAttribute('role')).toBeNull();
          expect(nativeFlaggedDiv.getAttribute('tabindex')).toBeNull();
          expect(
            Object.keys(implicit.attributes).filter((key) => key.startsWith('aria-')),
          ).toEqual([]);

          const hostClicks: MouseEvent[] = [];
          nativeFlaggedDiv.addEventListener('click', (event) => hostClicks.push(event));

          nativeFlaggedDiv.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          nativeFlaggedDiv.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(hostClicks).toHaveLength(0);

          implicit.destroy();
          explicit.destroy();
          expect(implicit.current).toBeNull();
          expect(explicit.current).toBeNull();
        });
      }));

    it('projects equivalent assistive-technology state from the same props on both hosts', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBtn = aria('button', { disabled: true });
          const customBtn = aria<HTMLDivElement>('button', { disabled: true }, { native: false });

          const nativeEl = bind(document.createElement('button'), nativeBtn);
          const customEl = bind(document.createElement('div'), customBtn);

          // Same comparator state, host-appropriate mechanism
          expect(nativeBtn.disabled).toBe(customBtn.disabled);
          expect(nativeEl.disabled).toBe(true);
          expect(customEl.getAttribute('aria-disabled')).toBe('true');

          // Native host relies on implicit role; custom host requires the explicit one
          expect(nativeEl.hasAttribute('role')).toBe(false);
          expect(customEl.getAttribute('role')).toBe('button');

          // Neither host is reachable as an actionable control
          expect(customEl.getAttribute('tabindex')).toBe('-1');

          nativeBtn.destroy();
          customBtn.destroy();
          expect(nativeBtn.current).toBeNull();
          expect(customBtn.current).toBeNull();
        });
      }));
  });
});
