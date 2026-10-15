import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type StepperChangeEvent, type StepperInputEvent, type StepperProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

type StepperEventProps = {
  oninput?: (event: StepperInputEvent) => void;
  onchange?: (event: StepperChangeEvent) => void;
};

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

// 'number-stepper' is claimed by specs/widgets/number-stepper.md as a single-element role with a
// different key table; this suite addresses the multi-part entity through 'stepper'.
function buildTree(props: StepperProps & StepperEventProps) {
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

function teardown(parts: ReturnType<typeof buildTree>) {
  parts.container.destroy();
  parts.input.destroy();
  parts.increment.destroy();
  parts.decrement.destroy();
  document.body.removeChild(parts.containerEl);
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

          expect(parts.containerEl.getAttribute('role')).toBe('group');
          expect(parts.inputEl.getAttribute('role')).toBe('spinbutton');
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('3');
          expect(parts.inputEl.getAttribute('aria-valuemin')).toBe('0');
          expect(parts.inputEl.getAttribute('aria-valuemax')).toBe('5');

          // The buttons are auxiliary: outside the tab order, plain button contract
          expect(parts.incrementEl.type).toBe('button');
          expect(parts.incrementEl.tabIndex).toBe(-1);
          expect(parts.decrementEl.tabIndex).toBe(-1);

          parts.incrementEl.click();
          expect(props.value).toBe(4);
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('4');

          parts.incrementEl.click();
          expect(props.value).toBe(5);

          parts.decrementEl.click();
          expect(props.value).toBe(4);
          expect(parts.inputEl.getAttribute('aria-valuenow')).toBe('4');

          expect(parts.container.value).toBe(4);
          expect(parts.input.value).toBe(4);

          teardown(parts);
        });
      }));

    it('steps on the vertical and page keys and leaves the horizontal keys to the caret', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 50, min: 0, max: 100, step: 5, page: 20 });
          const parts = buildTree(props);

          parts.inputEl.focus();

          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(true);
          expect(props.value).toBe(55);

          expect(press(parts.inputEl, 'ArrowDown').defaultPrevented).toBe(true);
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

          // The caret keys stay the user's: unconsumed, and the number does not move
          expect(press(parts.inputEl, 'ArrowRight').defaultPrevented).toBe(false);
          expect(props.value).toBe(0);
          expect(press(parts.inputEl, 'ArrowLeft').defaultPrevented).toBe(false);
          expect(props.value).toBe(0);
          expect(press(parts.inputEl, 'Tab').defaultPrevented).toBe(false);

          // Enter is bypassed on the field so it cannot submit a form, and does not step
          expect(press(parts.inputEl, 'Enter').defaultPrevented).toBe(true);
          expect(props.value).toBe(0);

          teardown(parts);
        });
      }));

    it('promises the live step and the value edge on the stepper itself', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const live: unknown[] = [];
          const changed: unknown[] = [];
          const domLive: unknown[] = [];
          const domChanged: unknown[] = [];

          const props = mutable<StepperProps & StepperEventProps>({
            value: 10,
            min: 0,
            max: 20,
            step: 2,
            oninput: (event) => live.push(event.detail),
            onchange: (event) => changed.push(event.detail),
          });
          const parts = buildTree(props);

          parts.containerEl.addEventListener('input', (event) => domLive.push((event as StepperInputEvent).detail));
          parts.containerEl.addEventListener('change', (event) => domChanged.push((event as StepperChangeEvent).detail));

          parts.inputEl.focus();
          press(parts.inputEl, 'ArrowUp');
          press(parts.inputEl, 'ArrowUp');

          expect(props.value).toBe(14);
          expect(live).toEqual([12, 14]);
          expect(changed).toEqual([12, 14]);
          expect(domLive).toEqual([12, 14]);
          expect(domChanged).toEqual([12, 14]);

          // Blur announces nothing of its own
          parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(live).toEqual([12, 14]);
          expect(changed).toEqual([12, 14]);

          teardown(parts);
        });
      }));
  });

  describe('Boundary Clamping & Auto-Inert Invariant', () => {
    it('disarms the button that has nowhere left to go and keeps the other live', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 1, min: 1, max: 3, step: 1 });
          const parts = buildTree(props);

          expect(parts.decrementEl.disabled).toBe(true);
          expect(parts.incrementEl.disabled).toBe(false);

          parts.decrementEl.click();
          expect(props.value).toBe(1);

          parts.incrementEl.click();
          expect(props.value).toBe(2);
          expect(parts.decrementEl.disabled).toBe(false);

          parts.incrementEl.click();
          expect(props.value).toBe(3);
          expect(parts.incrementEl.disabled).toBe(true);
          expect(parts.decrementEl.disabled).toBe(false);

          parts.incrementEl.click();
          expect(props.value).toBe(3);

          props.value = 500;
          expect(parts.container.value).toBe(3);
          expect(parts.incrementEl.disabled).toBe(true);

          props.value = -500;
          expect(parts.container.value).toBe(1);
          expect(parts.decrementEl.disabled).toBe(true);

          teardown(parts);
        });
      }));

    it('refuses steps and typing while readonly and disarms the buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 5, min: 0, max: 10, readonly: true });
          const parts = buildTree(props);

          expect(parts.inputEl.getAttribute('tabindex')).toBe('-1');
          expect(parts.incrementEl.disabled).toBe(true);
          expect(parts.decrementEl.disabled).toBe(true);

          parts.inputEl.focus();
          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(false);
          expect(props.value).toBe(5);

          // A readonly custom host is not editable at all
          expect(parts.inputEl.hasAttribute('contenteditable')).toBe(false);

          teardown(parts);
        });
      }));

    it('takes the whole stepper out of reach when the container is disabled', () =>
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

          props.disabled = false;
          expect(parts.inputEl.getAttribute('tabindex')).toBe('0');
          expect(parts.incrementEl.disabled).toBe(false);

          parts.inputEl.focus();
          expect(press(parts.inputEl, 'ArrowUp').defaultPrevented).toBe(true);
          expect(props.value).toBe(6);

          teardown(parts);
        });
      }));

    it('cancels and contains an activation click on the step button that has nowhere left to go', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 10, min: 0, max: 10 });
          const parts = buildTree(props);

          expect(parts.increment.disabled).toBe(true);
          expect(parts.incrementEl.disabled).toBe(true);

          const reached: string[] = [];
          const onBubble = () => reached.push('click');
          parts.containerEl.addEventListener('click', onBubble);

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          parts.incrementEl.dispatchEvent(click);

          expect(click.defaultPrevented).toBe(true);
          expect(reached).toEqual([]);
          expect(props.value).toBe(10);

          parts.containerEl.removeEventListener('click', onBubble);
          teardown(parts);
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

          expect(parts.inputEl.getAttribute('role')).toBe('spinbutton');
          expect(parts.inputEl.getAttribute('aria-valuetext')).toBe('2 of 4 nights');
          expect(parts.inputEl.getAttribute('tabindex')).toBe('0');

          expect(parts.containerEl.getAttribute('role')).toBe('group');
          expect(parts.containerEl.hasAttribute('aria-valuenow')).toBe(false);

          for (const buttonEl of [parts.incrementEl, parts.decrementEl]) {
            expect(buttonEl.hasAttribute('role')).toBe(false);
            expect(buttonEl.hasAttribute('aria-pressed')).toBe(false);
            expect(buttonEl.hasAttribute('aria-valuenow')).toBe(false);
            expect(buttonEl.type).toBe('button');
            expect(buttonEl.tabIndex).toBe(-1);
          }

          teardown(parts);
        });
      }));

    it('keeps two steppers in the same page coordinating only themselves', () =>
      scope.run(() => {
        const firstTree = component();
        const first = firstTree.run(() => buildTree({ value: 1, min: 0, max: 9, step: 1 }));

        const secondTree = component();
        const second = secondTree.run(() => buildTree({ value: 5, min: 0, max: 9, step: 1 }));

        expect(first.inputEl.getAttribute('aria-valuenow')).toBe('1');
        expect(second.inputEl.getAttribute('aria-valuenow')).toBe('5');

        first.increment.click();
        expect(first.container.value).toBe(2);
        expect(second.container.value).toBe(5);

        second.decrement.click();
        expect(second.container.value).toBe(4);
        expect(first.container.value).toBe(2);

        teardown(first);
        teardown(second);
      }));
  });

  describe('Typed Reading Invariant', () => {
    it('parses free typing on a native text host and announces it without replaying the browser event', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const changed: unknown[] = [];
          const props = mutable<StepperProps & StepperEventProps>({
            value: 2,
            min: 0,
            max: 10,
            onchange: (event) => changed.push(event.detail),
          });
          const container = aria('stepper', props);

          const seen: unknown[] = [];
          const input = aria<HTMLInputElement>('stepper-input', {
            oninput: (event) => seen.push(event.detail),
          }, { native: true });

          const containerEl = document.createElement('div');
          const inputEl = bind(document.createElement('input'), input);
          containerEl.appendChild(inputEl);
          document.body.appendChild(containerEl);
          bind(containerEl, container);

          expect(inputEl.getAttribute('type')).toBe('text');

          const replayed: string[] = [];
          inputEl.addEventListener('input', () => replayed.push('input'));
          inputEl.addEventListener('change', () => replayed.push('change'));

          inputEl.value = '4';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));

          expect(props.value).toBe(4);
          expect(seen).toEqual([4]);
          expect(changed).toEqual([4]);
          expect(replayed).toEqual(['input']);

          // An unusable reading leaves the value untouched and reports the value at that moment
          inputEl.value = 'abc';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(4);
          expect(seen).toEqual([4, 4]);

          // Blur restores the last committed value instead of zeroing the field
          inputEl.dispatchEvent(new FocusEvent('blur'));
          expect(inputEl.value).toBe('4');
          expect(changed).toEqual([4]);

          container.destroy();
          input.destroy();
          document.body.removeChild(containerEl);
        });
      }));
  });

  describe('Required Constraint Projection', () => {
    it('states the required constraint on the spinbutton in the form its host understands', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<StepperProps>({ value: 2, min: 0, max: 6, required: true });
          const parts = buildTree(props);

          expect(parts.inputEl.hasAttribute('aria-required')).toBe(true);
          expect(parts.inputEl.hasAttribute('required')).toBe(false);

          const native = aria('stepper-input', {}, { native: true });
          const nativeEl = bind(document.createElement('input'), native);
          expect(nativeEl.required).toBe(true);
          expect(nativeEl.hasAttribute('aria-required')).toBe(false);

          props.required = false;
          expect(parts.inputEl.hasAttribute('aria-required')).toBe(false);
          expect(nativeEl.required).toBe(false);

          teardown(parts);
        });
      }));
  });
});
