import { createLifecycle, mutable } from '@airlib/core';
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
          expect(spin.attributes.value).toBeUndefined();
          expect(spin.attributes.defaultValue).toBe(7);

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
});
