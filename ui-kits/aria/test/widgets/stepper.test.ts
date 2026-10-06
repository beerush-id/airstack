import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type StepperEvent, type StepperProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

// 'number-stepper' is claimed by specs/widgets/number-stepper.md as a single-element role with a
// different key table; this suite addresses the multi-part entity through 'stepper'.
function buildTree(props: StepperProps) {
  const container = aria('stepper', props);
  const input = aria('stepper-input');
  const increment = aria('stepper-inc');
  const decrement = aria('stepper-dec');

  const containerEl = document.createElement('div');
  const inputEl = document.createElement('div');
  const incrementEl = document.createElement('button');
  const decrementEl = document.createElement('button');

  containerEl.appendChild(inputEl);
  containerEl.appendChild(incrementEl);
  containerEl.appendChild(decrementEl);
  document.body.appendChild(containerEl);

  bind(containerEl, container);
  bind(inputEl, input);
  bind(incrementEl, increment);
  bind(decrementEl, decrement);

  return { container, input, increment, decrement, containerEl, inputEl, incrementEl, decrementEl };
}

describe('Stepper - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Coordinated Step Traversal Invariant', () => {
    it('drives one value from either step button and the display follows', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 3, min: 0, max: 5, step: 1 });
          const parts = buildTree(props);

          // 1/2. The container groups the parts and the input carries the range
          expect(parts.containerEl.getAttribute('role')).toBe('group');
          expect(parts.inputEl.getAttribute('role')).toBe('spinbutton');
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('3');
          expect(parts.inputEl.getAttribute('aria-valuemin')).toBe('0');
          expect(parts.inputEl.getAttribute('aria-valuemax')).toBe('5');

          expect(parts.incrementEl.type).toBe('button');

          parts.incrementEl.click();
          expect(props.value).toBe(4);
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('4');

          parts.incrementEl.click();
          expect(props.value).toBe(5);

          parts.decrementEl.click();
          expect(props.value).toBe(4);
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('4');

          // Both buttons and the display read the same single value
          expect(parts.container.value).toBe(4);
          expect(parts.input.value).toBe(4);

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));

    it('maps every stepping key onto the shared value from the input', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 50, min: 0, max: 100, step: 5, page: 20 });
          const parts = buildTree(props);

          parts.inputEl.focus();

          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(true);
          expect(props.value).toBe(55);

          expect(press(parts.inputEl, 'ArrowRight').defaultPrevented).toBe(true);
          expect(props.value).toBe(60);

          expect(press(parts.inputEl, 'ArrowDown').defaultPrevented).toBe(true);
          expect(props.value).toBe(55);

          expect(press(parts.inputEl, 'ArrowLeft').defaultPrevented).toBe(true);
          expect(props.value).toBe(50);

          expect(press(parts.inputEl, 'PageUp').defaultPrevented).toBe(true);
          expect(props.value).toBe(70);

          expect(press(parts.inputEl, 'PageDown').defaultPrevented).toBe(true);
          expect(props.value).toBe(50);

          expect(press(parts.inputEl, 'End').defaultPrevented).toBe(true);
          expect(props.value).toBe(100);
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('100');

          expect(press(parts.inputEl, 'Home').defaultPrevented).toBe(true);
          expect(props.value).toBe(0);

          // Keys outside the table stay with the page
          expect(press(parts.inputEl, 'Tab').defaultPrevented).toBe(false);
          expect(press(parts.inputEl, 'Enter').defaultPrevented).toBe(false);

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));

    it('announces stepping as it happens and commits it on blur', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 10, min: 0, max: 20, step: 2 });
          const parts = buildTree(props);

          const live: unknown[] = [];
          const committed: unknown[] = [];
          parts.inputEl.addEventListener('input', (event) =>
            live.push((event as StepperEvent).detail),
          );
          parts.inputEl.addEventListener('change', (event) =>
            committed.push((event as StepperEvent).detail),
          );

          parts.inputEl.focus();
          press(parts.inputEl, 'ArrowUp');
          press(parts.inputEl, 'ArrowUp');

          expect(props.value).toBe(14);
          expect(live).toEqual([12, 14]);
          expect(committed).toEqual([]);

          parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(committed).toEqual([14]);

          // A blur with nothing left to commit announces nothing
          parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(committed).toEqual([14]);

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));
  });

  describe('Boundary Clamping & Auto-Inert Invariant', () => {
    it('disables the button that has nowhere left to go and keeps the other live', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 1, min: 1, max: 3, step: 1 });
          const parts = buildTree(props);

          // At the floor: decrement is inert, increment still operates
          expect(parts.decrementEl.getAttribute('aria-disabled')).toBe('true');
          expect(parts.incrementEl.getAttribute('aria-disabled')).toBe('false');

          parts.decrementEl.click();
          expect(props.value).toBe(1);

          parts.incrementEl.click();
          expect(props.value).toBe(2);
          expect(parts.decrementEl.getAttribute('aria-disabled')).toBe('false');

          // At the ceiling: the roles reverse without any rebinding
          parts.incrementEl.click();
          expect(props.value).toBe(3);
          expect(parts.incrementEl.getAttribute('aria-disabled')).toBe('true');
          expect(parts.decrementEl.getAttribute('aria-disabled')).toBe('false');

          parts.incrementEl.click();
          expect(props.value).toBe(3);

          // A parent write past the bound clamps and re-derives both buttons
          props.value = 500;
          expect(parts.container.value).toBe(3);
          expect(parts.incrementEl.getAttribute('aria-disabled')).toBe('true');

          props.value = -500;
          expect(parts.container.value).toBe(1);
          expect(parts.decrementEl.getAttribute('aria-disabled')).toBe('true');

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));

    it('takes the whole stepper out of the tab order when the container is disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 5, min: 0, max: 10, disabled: true });
          const parts = buildTree(props);

          expect(parts.container.disabled).toBe(true);
          expect(parts.inputEl.getAttribute('aria-disabled')).toBe('true');
          expect(parts.inputEl.getAttribute('tabindex')).toBe('-1');
          expect(parts.incrementEl.disabled).toBe(true);
          expect(parts.decrementEl.disabled).toBe(true);

          parts.incrementEl.click();
          expect(props.value).toBe(5);

          parts.inputEl.focus();
          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(false);
          expect(props.value).toBe(5);

          // Re-enabling restores traversal and stepping on the same nodes
          props.disabled = false;
          expect(parts.inputEl.getAttribute('tabindex')).toBe('0');
          expect(parts.incrementEl.disabled).toBe(false);

          parts.inputEl.focus();
          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(true);
          expect(props.value).toBe(6);

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));
  });

  describe('Sub-Component Association Invariant', () => {
    it('compiles the spinbutton semantics onto the input and leaves the buttons on the button contract', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const parts = buildTree({
            value: 2,
            min: 1,
            max: 4,
            step: 1,
            valuetext: '2 of 4 nights',
          });

          // The input is the value-bearing control
          expect(parts.inputEl.getAttribute('role')).toBe('spinbutton');
          expect(parts.inputEl.getAttribute('aria-valuetext')).toBe('2 of 4 nights');
          expect(parts.inputEl.getAttribute('tabindex')).toBe('0');

          // The container groups without taking the value role itself
          expect(parts.containerEl.getAttribute('role')).toBe('group');
          expect(parts.containerEl.hasAttribute('aria-valuenow')).toBe(false);

          // Step buttons stay plain buttons: not toggles, not spinbuttons, not linked by state
          for (const buttonEl of [parts.incrementEl, parts.decrementEl]) {
            expect(buttonEl.hasAttribute('role')).toBe(false);
            expect(buttonEl.hasAttribute('aria-pressed')).toBe(false);
            expect(buttonEl.hasAttribute('aria-valuenow')).toBe(false);
            expect(buttonEl.type).toBe('button');
          }

          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        });
      }));

    it('keeps two steppers in the same page coordinating only themselves', () =>
      scope.run(() => {
        const firstTree = component();
        const first = firstTree.run(() => {
          const parts = buildTree({ value: 1, min: 0, max: 9, step: 1 });
          return parts;
        });

        const secondTree = component();
        const second = secondTree.run(() => {
          const parts = buildTree({ value: 5, min: 0, max: 9, step: 1 });
          return parts;
        });

        expect(first.inputEl.getAttribute('aria-valuenow')).toBe('1');
        expect(second.inputEl.getAttribute('aria-valuenow')).toBe('5');

        first.increment.click();
        expect(first.container.value).toBe(2);
        expect(second.container.value).toBe(5);
        expect(second.inputEl.getAttribute('aria-valuenow')).toBe('5');

        second.decrement.click();
        expect(second.container.value).toBe(4);
        expect(first.container.value).toBe(2);

        for (const parts of [first, second]) {
          parts.container.destroy();
          parts.input.destroy();
          parts.increment.destroy();
          parts.decrement.destroy();
          document.body.removeChild(parts.containerEl);
        }
      }));
  });
});
