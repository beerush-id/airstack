import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  aria,
  type NumberStepperProps,
  StepperButtonAria,
  type StepperEvent,
  type StepperProps,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

function key(el: HTMLElement, type: 'keydown' | 'keyup', keyName: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { key: keyName, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

function buildTree(props: StepperProps, inputOptions: { native?: boolean } = {}) {
  const container = aria('stepper', props);
  const input = aria('stepper-input', {}, inputOptions);
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

function teardown(parts: {
  container: { destroy(): void };
  input: { destroy(): void };
  increment: { destroy(): void };
  decrement: { destroy(): void };
  containerEl: HTMLElement;
}): void {
  parts.container.destroy();
  parts.input.destroy();
  parts.increment.destroy();
  parts.decrement.destroy();
  document.body.removeChild(parts.containerEl);
}

describe('Stepper - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('resolves value fallbacks, step/page defaults, and commit identity', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const valued = aria('stepper', { value: 5, min: 1, max: 9 });
        expect(valued.value).toBe(5);

        const floor = aria('stepper', { min: 7 });
        expect(floor.value).toBe(7);

        const empty = aria('stepper');
        expect(empty.value).toBe(0);
        expect(empty.step).toBe(1);
        expect(empty.page).toBe(10);
        expect(empty.min).toBeUndefined();
        expect(empty.max).toBeUndefined();

        expect(valued.step).toBe(1);
        expect(valued.page).toBe(10);

        expect(valued.commit(5)).toBe(false);
        expect(valued.commit(6)).toBe(true);
        expect(valued.value).toBe(6);
        expect(valued.commit(6)).toBe(false);

        valued.destroy();
        floor.destroy();
        empty.destroy();
      });
    }));

  it('leaves coordinator-less parts inert and safe to activate', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const input = aria('stepper-input');
        expect(input.value).toBe(0);
        expect(input.attributes.role).toBe('spinbutton');
        expect(input.attributes.tabindex).toBe(0);
        expect(input.attributes['aria-disabled']).toBe('false');

        const increment = aria('stepper-inc');
        const decrement = aria('stepper-dec');
        expect(increment.disabled).toBe(true);
        expect(decrement.disabled).toBe(true);
        expect(increment.attributes.disabled).toBe(true);
        expect(decrement.attributes.disabled).toBe(true);

        increment.click();
        decrement.click();

        input.destroy();
        increment.destroy();
        decrement.destroy();
      });
    }));

  it('constructs a coordinator-less button with defaults that stays inert', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const button = new StepperButtonAria();
        const el = bind(document.createElement('button'), button);
        expect(button.disabled).toBe(true);
        expect(el.disabled).toBe(true);
        button.click();
        button.destroy();
      });
    }));

  it('projects the shared range onto a native input and commits typed values', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<StepperProps>({ value: 4, min: 0, max: 10, step: 2, readonly: false, disabled: false });
        const parts = buildTree(props, { native: true });

        const inputEl = parts.inputEl as unknown as HTMLInputElement;
        expect(parts.input.attributes.type).toBe('number');
        expect(parts.input.attributes.value).toBeUndefined();
        expect(parts.input.attributes.defaultValue).toBe(4);
        expect(parts.input.attributes.min).toBe(0);
        expect(parts.input.attributes.max).toBe(10);
        expect(parts.input.attributes.step).toBe(2);

        inputEl.value = '6';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(6);

        inputEl.value = '   ';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(6);

        teardown(parts);
      });
    }));

  it('refuses stepping when readonly or already handled', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const frozen = buildTree({ value: 5, min: 0, max: 10, readonly: true });
        expect(key(frozen.inputEl, 'keydown', 'ArrowUp').defaultPrevented).toBe(false);
        expect(frozen.container.value).toBe(5);
        expect(frozen.inputEl.getAttribute('aria-readonly')).toBe('true');
        teardown(frozen);

        const live = buildTree({ value: 5, min: 0, max: 10 });
        const pre = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true });
        pre.preventDefault();
        live.inputEl.dispatchEvent(pre);
        expect(live.container.value).toBe(5);
        teardown(live);
      });
    }));

  it('leaves Home and End unclaimed without bounds', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5 });
        expect(key(parts.inputEl, 'keydown', 'Home').defaultPrevented).toBe(false);
        expect(key(parts.inputEl, 'keydown', 'End').defaultPrevented).toBe(false);
        expect(parts.container.value).toBe(5);
        expect(key(parts.inputEl, 'keydown', 'Enter').defaultPrevented).toBe(false);
        teardown(parts);
      });
    }));

  it('emits no input event when stepping cannot move the value', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 10, min: 0, max: 10 });
        const live: unknown[] = [];
        parts.inputEl.addEventListener('input', (event) => live.push((event as StepperEvent).detail));
        expect(key(parts.inputEl, 'keydown', 'ArrowUp').defaultPrevented).toBe(true);
        expect(live).toEqual([]);
        expect(parts.container.value).toBe(10);
        teardown(parts);
      });
    }));

  it('commits stepped values on key release and ignores unrelated keys', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10 });
        const committed: unknown[] = [];
        parts.inputEl.addEventListener('change', (event) => committed.push((event as StepperEvent).detail));

        key(parts.inputEl, 'keyup', 'Tab');
        expect(committed).toEqual([]);

        key(parts.inputEl, 'keyup', 'ArrowUp');
        expect(committed).toEqual([]);

        key(parts.inputEl, 'keydown', 'ArrowUp');
        key(parts.inputEl, 'keyup', 'ArrowUp');
        expect(committed).toEqual([6]);

        parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(committed).toEqual([6]);
        teardown(parts);
      });
    }));

  it('constructs every part without frozen reactive reads in setup-like context', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const reads: string[] = [];
        const restore = setStaticTracker((_init, key) => {
          if (typeof key === 'symbol') return;
          reads.push(String(key));
        });
        try {
          const props = mutable<StepperProps>({ value: 4, min: 0, max: 10 });
          const parts = buildTree(props);
          const solo = aria('number-stepper', { value: 4, min: 0, max: 10 });
          teardown(parts);
          solo.destroy();
        } finally {
          restore();
        }
        expect(reads).toEqual([]);
      });
    }));

  it('disables step buttons through the container and stays live without bounds', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<StepperProps>({ value: 5, min: 0, max: 10 });
        const parts = buildTree(props);
        expect(parts.increment.disabled).toBe(false);
        expect(parts.decrement.disabled).toBe(false);

        props.disabled = true;
        expect(parts.increment.disabled).toBe(true);
        expect(parts.decrement.disabled).toBe(true);
        parts.increment.click();
        parts.decrement.click();
        expect(parts.container.value).toBe(5);
        teardown(parts);

        const open = buildTree({ value: 5 });
        expect(open.increment.disabled).toBe(false);
        expect(open.decrement.disabled).toBe(false);
        open.increment.click();
        expect(open.container.value).toBe(6);
        open.decrement.click();
        expect(open.container.value).toBe(5);
        teardown(open);
      });
    }));
});

describe('NumberStepper - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('falls back through value, minimum, and zero', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const fallback = aria('number-stepper');
        expect(fallback.value).toBe(0);

        const floor = aria('number-stepper', { min: 7 });
        expect(floor.value).toBe(7);

        const valued = aria('number-stepper', { value: 4, min: 7 });
        expect(valued.value).toBe(7);

        fallback.destroy();
        floor.destroy();
        valued.destroy();
      });
    }));

  it('refuses native input while disabled and ignores non-numeric text', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<NumberStepperProps>({ value: 5, min: 0, max: 10, disabled: true });
        const locked = aria<HTMLInputElement>('number-stepper', props, { native: true });
        const lockedEl = bind(document.createElement('input'), locked);
        lockedEl.value = '8';
        lockedEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(5);
        locked.destroy();

        const free = aria<HTMLInputElement>('number-stepper', { value: 5, min: 0, max: 10 }, { native: true });
        const el = bind(document.createElement('input'), free);
        el.setAttribute('type', 'text');
        el.value = 'abc';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        expect(free.value).toBe(5);
        free.destroy();
      });
    }));
});
