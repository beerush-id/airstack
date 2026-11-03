import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type NumberStepperProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('NumberStepper - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Numeric Stepper Contract', () => {
    it('announces the value within its bounds and steps it with arrow keys across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<NumberStepperProps>({ value: 5, min: 0, max: 10 });
          const spin = aria<HTMLDivElement>('number-stepper', props);

          // 1. SSR Phase: pre-mount deterministic compilation
          expect(spin.current).toBeNull();
          expect(spin.attributes.role).toBe('spinbutton');
          expect(spin.attributes.tabindex).toBe(0);
          expect(spin.attributes['aria-valuenow']).toBe(5);
          expect(spin.attributes['aria-valuemin']).toBe(0);
          expect(spin.attributes['aria-valuemax']).toBe(10);

          // 2. Mount Phase: framework element binding
          const el = bind(document.createElement('div'), spin);
          expect(spin.current).toBe(el);
          expect(el.getAttribute('role')).toBe('spinbutton');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-valuenow')).toBe('5');

          // 3. Interaction Phase: arrow keys step the announced value
          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(true);
          expect(spin.value).toBe(6);
          expect(props.value).toBe(6);
          expect(el.getAttribute('aria-valuenow')).toBe('6');

          const down = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true });
          el.dispatchEvent(down);
          expect(spin.value).toBe(5);
          expect(el.getAttribute('aria-valuenow')).toBe('5');
        });
      }));
  });

  describe('Page Stepping & Boundary Contract', () => {
    it('steps by ten increments on Page keys and holds the value at the declared boundaries', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 50, min: 0, max: 100, step: 5 });
          const el = bind(document.createElement('div'), spin);

          // Page keys move ten times the declared step
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(100);
          expect(el.getAttribute('aria-valuenow')).toBe('100');

          // Holding at the upper boundary never overshoots
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(100);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(100);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(50);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(0);

          // Holding at the lower boundary never undershoots
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(0);
          expect(el.getAttribute('aria-valuenow')).toBe('0');
        });
      }));
  });

  describe('Unbounded Range Contract', () => {
    it('omits bound announcements and leaves Home and End to the browser when no limits are declared', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: -3 });

          // 1. SSR Phase: no bounds means no bound claims
          expect(spin.min).toBeUndefined();
          expect(spin.max).toBeUndefined();
          expect(spin.attributes['aria-valuenow']).toBe(-3);
          expect(spin.attributes['aria-valuemin']).toBeUndefined();
          expect(spin.attributes['aria-valuemax']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('div'), spin);
          expect(el.hasAttribute('aria-valuemin')).toBe(false);
          expect(el.hasAttribute('aria-valuemax')).toBe(false);

          // 3. Interaction Phase: boundary keys stay unclaimed, stepping stays unclamped
          const home = new KeyboardEvent('keydown', { key: 'Home', cancelable: true, bubbles: true });
          el.dispatchEvent(home);
          expect(home.defaultPrevented).toBe(false);
          expect(spin.value).toBe(-3);

          const end = new KeyboardEvent('keydown', { key: 'End', cancelable: true, bubbles: true });
          el.dispatchEvent(end);
          expect(end.defaultPrevented).toBe(false);
          expect(spin.value).toBe(-3);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
          expect(spin.value).toBe(-4);
          expect(el.getAttribute('aria-valuenow')).toBe('-4');
        });
      }));
  });

  describe('Readonly & Disabled Contract', () => {
    it('keeps a readonly field focusable but immutable', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5, max: 10, readonly: true });
          const el = bind(document.createElement('div'), spin);

          expect(el.getAttribute('aria-readonly')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(false);
          expect(spin.value).toBe(5);
          expect(el.getAttribute('aria-valuenow')).toBe('5');
        });
      }));

    it('takes a disabled field out of the tab order and refuses every stepping key', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5, max: 10, disabled: true });

          // 1. SSR Phase
          expect(spin.attributes.tabindex).toBe(-1);
          expect(spin.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('div'), spin);
          expect(el.getAttribute('tabindex')).toBe('-1');

          // 3. Interaction Phase
          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(false);
          expect(spin.value).toBe(5);
        });
      }));
  });

  describe('Announcement Contract', () => {
    it('announces readable value text and required validation, and omits both when unset', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const announced = aria<HTMLDivElement>('number-stepper', { value: 3, valuetext: '3 nights', required: true });
          expect(announced.attributes['aria-valuetext']).toBe('3 nights');
          expect(announced.attributes['aria-required']).toBe('true');

          const plain = aria<HTMLDivElement>('number-stepper', { value: 3 });
          expect(plain.attributes['aria-valuetext']).toBeUndefined();
          expect(plain.attributes['aria-required']).toBeUndefined();
          expect(plain.attributes['aria-readonly']).toBeUndefined();

          const el = bind(document.createElement('div'), announced);
          expect(el.getAttribute('aria-valuetext')).toBe('3 nights');
          expect(el.getAttribute('aria-required')).toBe('true');
        });
      }));
  });

  describe('Native Input Equivalence Contract', () => {
    it('projects onto <input type="number"> without a redundant role and synchronizes typed values', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<NumberStepperProps>({ value: 7, min: 0, max: 10, step: 2 });
          const spin = aria<HTMLInputElement>('number-stepper', props, { native: true });

          // 1. SSR Phase: the browser supplies the spinbutton role and the live value
          expect(spin.attributes.role).toBeUndefined();
          expect(spin.attributes.tabindex).toBeUndefined();
          expect(spin.attributes.type).toBe('number');
          expect(spin.attributes.min).toBe(0);
          expect(spin.attributes.max).toBe(10);
          expect(spin.attributes.step).toBe(2);
          expect(spin.attributes.value).toBe(7);
          expect(spin.attributes.defaultValue).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('input'), spin);
          expect(el.type).toBe('number');
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('value')).toBe('7');

          // 3. Interaction Phase: typing synchronizes back into props
          el.value = '9';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(9);
          expect(spin.value).toBe(9);

          // Typing past the bound is clamped on the way in
          el.value = '40';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(10);
          expect(spin.value).toBe(10);

          // Clearing the field withdraws the entered value instead of claiming zero
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBeUndefined();
          expect(spin.value).toBe(0);
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('stops stepping a detached field after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5 });
          const el = bind(document.createElement('div'), spin);

          expect(spin.current).toBe(el);

          spin.destroy();
          expect(spin.current).toBeNull();

          spin.value = 8;
          expect(el.getAttribute('aria-valuenow')).toBe('5');
        });
      }));
  });

  describe('Stepper Action & Event Dispatch Invariant', () => {
    it('claims exactly the declared keys and leaves caret and typing keys to the browser', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5, min: 0, max: 10 });
          const el = bind(document.createElement('div'), spin);

          // ArrowLeft/ArrowRight move a text caret, not a value: the table names Up/Down only
          for (const key of ['ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'a']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
          }

          expect(spin.value).toBe(5);
          expect(el.getAttribute('aria-valuenow')).toBe('5');

          // A claimed key moves the value exactly one step
          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(true);
          expect(spin.value).toBe(6);
          expect(el.getAttribute('aria-valuenow')).toBe('6');

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('hands the consumer an already-transitioned value on a native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<NumberStepperProps>({ value: 1, min: 0, max: 20 });
          const spin = aria<HTMLInputElement>('number-stepper', props, { native: true });
          const el = bind(document.createElement('input'), spin);

          const observed: Array<{ state: number; attribute: string; dom: string }> = [];
          el.addEventListener('input', () => {
            observed.push({
              state: spin.value,
              attribute: el.getAttribute('aria-valuenow') ?? '',
              dom: el.value,
            });
          });

          // 3/4. Internal synchronization runs before the forwarded event reaches a listener
          el.value = '12';
          el.dispatchEvent(new Event('input', { bubbles: true }));

          expect(observed).toHaveLength(1);
          expect(observed[0].state).toBe(12);
          expect(observed[0].dom).toBe('12');

          // The native host announces range through its own attributes, never ARIA mirrors
          expect(observed[0].attribute).toBe('');
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.hasAttribute('aria-valuemin')).toBe(false);
          expect(el.hasAttribute('aria-valuemax')).toBe(false);
          expect(el.hasAttribute('role')).toBe(false);

          // 5. Reconciliation: out-of-range typing is clamped on the way in, not on the way out
          el.value = '40';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(spin.value).toBe(20);
          expect(props.value).toBe(20);
          expect(observed).toHaveLength(2);
          expect(observed[1].state).toBe(20);

          // 6. Teardown
          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('leaves the native host arrow keys unclaimed for the built-in stepper', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLInputElement>('number-stepper', { value: 5, min: 0, max: 10 }, { native: true });
          const el = bind(document.createElement('input'), spin);

          // The polyfill is declared for !native hosts only
          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(false);
          expect(spin.value).toBe(5);

          const home = new KeyboardEvent('keydown', { key: 'Home', cancelable: true, bubbles: true });
          el.dispatchEvent(home);
          expect(home.defaultPrevented).toBe(false);
          expect(spin.value).toBe(5);

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('falls back to the minimum and then to zero when no value is declared', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const bounded = aria<HTMLDivElement>('number-stepper', { min: 3, max: 9 });
          expect(bounded.value).toBe(3);

          const unbounded = aria<HTMLDivElement>('number-stepper');
          expect(unbounded.value).toBe(0);

          bounded.destroy();
          unbounded.destroy();
        });
      }));

    it('withholds typed commits while disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const inputs: number[] = [];
          const spin = aria<HTMLInputElement>(
            'number-stepper',
            { value: 4, min: 0, max: 20, disabled: true, oninput: (event: AnyType) => inputs.push(event.detail) },
            { native: true }
          );
          const el = bind(document.createElement('input'), spin);

          el.value = '12';
          el.dispatchEvent(new Event('input', { bubbles: true }));

          expect(inputs).toEqual([]);
          expect(spin.value).toBe(4);

          spin.destroy();
        });
      }));
  });

  describe('Range Normalization & Boundary Clamping Invariant', () => {
    it('holds a programmatically assigned value inside the declared range', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5, min: 0, max: 10 });
          const el = bind(document.createElement('div'), spin);

          spin.value = 250;
          expect(spin.value).toBe(10);
          expect(spin.attributes['aria-valuenow']).toBe(10);
          expect(el.getAttribute('aria-valuenow')).toBe('10');

          spin.value = -250;
          expect(spin.value).toBe(0);
          expect(el.getAttribute('aria-valuenow')).toBe('0');

          // Inside the range the value is stored verbatim, not snapped to a step
          spin.value = 4;
          expect(spin.value).toBe(4);
          expect(el.getAttribute('aria-valuenow')).toBe('4');

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('re-clamps a live value when a narrowing range revision takes it past a bound', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<NumberStepperProps>({ value: 50, min: 0, max: 100 });
          const spin = aria<HTMLDivElement>('number-stepper', props);
          const el = bind(document.createElement('div'), spin);

          expect(el.getAttribute('aria-valuenow')).toBe('50');
          expect(el.getAttribute('aria-valuemax')).toBe('100');

          // The bound moves below the current value: the announcement cannot keep lying
          props.max = 20;
          expect(spin.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');
          expect(el.getAttribute('aria-valuemax')).toBe('20');

          // A lower bound inside the current value leaves it alone
          props.min = 5;
          expect(spin.value).toBe(20);

          // Squeezing both bounds pulls the value into the narrower window
          props.min = 8;
          props.max = 12;
          expect(spin.value).toBe(12);
          expect(el.getAttribute('aria-valuenow')).toBe('12');
          expect(el.getAttribute('aria-valuemin')).toBe('8');
          expect(el.getAttribute('aria-valuemax')).toBe('12');

          // Widening the range back never resurrects the discarded value
          props.min = 0;
          props.max = 100;
          expect(spin.value).toBe(12);

          spin.value = 60;
          expect(spin.value).toBe(60);
          expect(el.getAttribute('aria-valuenow')).toBe('60');

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Host Boundary Invariant', () => {
    it('keeps a readonly field reachable while refusing every stepping key', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>(
            'number-stepper',
            { value: 5, min: 0, max: 100, step: 5, readonly: true },
            { native: false }
          );

          const el = bind(document.createElement('div'), spin);

          expect(el.getAttribute('aria-readonly')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
          }

          expect(spin.value).toBe(5);
          expect(el.getAttribute('aria-valuenow')).toBe('5');

          // Dropping the readonly declaration re-arms the same node
          spin.assign({ readonly: false });
          expect(el.getAttribute('aria-readonly')).toBe('false');

          const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
          el.dispatchEvent(up);
          expect(up.defaultPrevented).toBe(true);
          expect(spin.value).toBe(10);

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('locks and re-arms stepping while a disabled field stays announced', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<NumberStepperProps>({ value: 5, min: 0, max: 100 });
          const spin = aria<HTMLDivElement>('number-stepper', props);
          const el = bind(document.createElement('div'), spin);

          const up = () => new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });

          el.dispatchEvent(up());
          expect(spin.value).toBe(6);

          props.disabled = true;
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          const locked = up();
          el.dispatchEvent(locked);
          expect(locked.defaultPrevented).toBe(false);
          expect(spin.value).toBe(6);

          // Disabled outranks readonly: both announcements stay truthful
          props.disabled = false;
          props.readonly = true;
          el.dispatchEvent(up());
          expect(spin.value).toBe(6);
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('aria-readonly')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          props.readonly = false;
          el.dispatchEvent(up());
          expect(spin.value).toBe(7);

          spin.destroy();
          expect(spin.current).toBeNull();
        });
      }));

    it('carries the same range constraints through native properties and ARIA attributes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const range = { value: 5, min: 0, max: 100, step: 5 };

          const nativeSpin = aria<HTMLInputElement>('number-stepper', range, { native: true });
          const customSpin = aria<HTMLDivElement>('number-stepper', range, { native: false });

          const nativeEl = bind(document.createElement('input'), nativeSpin);
          const customEl = bind(document.createElement('div'), customSpin);

          // Native host: the range is HTML, and the type carries the implicit role
          expect(nativeEl.type).toBe('number');
          expect(nativeEl.min).toBe('0');
          expect(nativeEl.max).toBe('100');
          expect(nativeEl.step).toBe('5');

          // Custom host: the range is ARIA, and the native range keys never reach the dictionary
          expect(customEl.getAttribute('role')).toBe('spinbutton');
          expect(customEl.getAttribute('aria-valuemin')).toBe('0');
          expect(customEl.getAttribute('aria-valuemax')).toBe('100');
          expect(customEl.getAttribute('aria-valuenow')).toBe('5');
          expect(customEl.getAttribute('tabindex')).toBe('0');
          expect(customSpin.attributes.min).toBeUndefined();
          expect(customSpin.attributes.max).toBeUndefined();
          expect(customSpin.attributes.step).toBeUndefined();

          // An out-of-range assignment meets the same ceiling on both hosts
          nativeSpin.assign({ value: 400 });
          customSpin.assign({ value: 400 });
          expect(nativeSpin.value).toBe(100);
          expect(customSpin.value).toBe(100);

          nativeSpin.destroy();
          customSpin.destroy();
          expect(nativeSpin.current).toBeNull();
          expect(customSpin.current).toBeNull();
        });
      }));

    it('cancels and contains every activation event on a custom host declared disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const spin = aria<HTMLDivElement>('number-stepper', { value: 5, min: 0, max: 10, disabled: true });

          const reached: string[] = [];
          const wrapper = document.createElement('div');
          wrapper.addEventListener('click', () => reached.push('click'));
          wrapper.addEventListener('keydown', () => reached.push('keydown'));
          wrapper.addEventListener('keyup', () => reached.push('keyup'));
          const el = bind(document.createElement('div'), spin);
          wrapper.append(el);

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });

          el.dispatchEvent(click);
          el.dispatchEvent(enterDown);
          el.dispatchEvent(spaceDown);
          el.dispatchEvent(spaceUp);

          expect(click.defaultPrevented).toBe(true);
          expect(enterDown.defaultPrevented).toBe(true);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(spaceUp.defaultPrevented).toBe(true);
          expect(reached).toEqual([]);
          expect(spin.value).toBe(5);

          spin.destroy();
        });
      }));
  });
});
