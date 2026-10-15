import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  aria,
  type NumberStepperProps,
  StepperButtonAria,
  type StepperInputEvent,
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

  it('projects the disarmed state through aria on a non-native button host', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 0, min: 0, max: 2 });
        const custom = aria('stepper-dec', {}, { native: false, direction: -1 });
        const customEl = bind(document.createElement('div'), custom);
        parts.containerEl.appendChild(customEl);

        expect(customEl.hasAttribute('disabled')).toBe(false);
        expect(customEl.getAttribute('aria-disabled')).toBe('true');

        parts.container.commit(1);
        expect(customEl.getAttribute('aria-disabled')).toBe('false');

        custom.destroy();
        teardown(parts);
      });
    }));

  it('projects the shared range onto a native input and commits typed values', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<StepperProps>({ value: 4, min: 0, max: 10, step: 2, readonly: false, disabled: false });
        const parts = buildTree(props, { native: true });

        const inputEl = parts.inputEl as unknown as HTMLInputElement;
        expect(parts.input.attributes.type).toBe('text');
        expect(parts.input.attributes.value).toBe(4);
        expect(parts.input.attributes.min).toBeUndefined();
        expect(parts.input.attributes.max).toBeUndefined();
        expect(parts.input.attributes.step).toBeUndefined();

        inputEl.value = '6';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(6);

        inputEl.value = '   ';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(6);

        props.disabled = true;
        expect(parts.input.attributes.tabindex).toBe(-1);
        expect(parts.input.attributes.disabled).toBe(true);

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
        expect(frozen.inputEl.hasAttribute('aria-readonly')).toBe(true);
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
        expect(key(parts.inputEl, 'keydown', 'Enter').defaultPrevented).toBe(true);
        expect(parts.container.value).toBe(5);
        teardown(parts);
      });
    }));

  it('announces the interaction even when the bound stops the move', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 10, min: 0, max: 10 });
        const live: unknown[] = [];
        const changed: unknown[] = [];
        parts.containerEl.addEventListener('input', (event) => live.push((event as StepperInputEvent).detail));
        parts.containerEl.addEventListener('change', (event) => changed.push((event as StepperInputEvent).detail));

        expect(key(parts.inputEl, 'keydown', 'ArrowUp').defaultPrevented).toBe(true);
        expect(live).toEqual([10]);
        expect(changed).toEqual([]);
        expect(parts.container.value).toBe(10);
        teardown(parts);
      });
    }));

  it('fires change on the value edge, not on key release or blur', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10 });
        const committed: unknown[] = [];
        parts.containerEl.addEventListener('change', (event) => committed.push((event as StepperInputEvent).detail));

        key(parts.inputEl, 'keyup', 'Tab');
        expect(committed).toEqual([]);

        key(parts.inputEl, 'keyup', 'ArrowUp');
        expect(committed).toEqual([]);

        key(parts.inputEl, 'keydown', 'ArrowUp');
        expect(committed).toEqual([6]);

        key(parts.inputEl, 'keyup', 'ArrowUp');
        parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(committed).toEqual([6]);
        teardown(parts);
      });
    }));

  it('restores the last committed value to a custom host on blur', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10 });

        parts.inputEl.textContent = '7';
        parts.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(parts.container.value).toBe(7);

        parts.inputEl.textContent = 'abc';
        parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(parts.inputEl.textContent).toBe('7');
        expect(parts.container.value).toBe(7);

        teardown(parts);
      });
    }));

  it('lets blur pass untouched while readonly', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10, readonly: true });
        parts.inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(parts.container.value).toBe(5);
        teardown(parts);
      });
    }));

  it('reads and writes the shared number through stepper.value', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const changed: unknown[] = [];
        const stepper = aria(
          'stepper',
          mutable<StepperProps & { onchange?: (event: StepperInputEvent) => void }>({
            value: 2,
            min: 0,
            max: 10,
            onchange: (event) => changed.push(event.detail),
          })
        );
        bind(document.createElement('div'), stepper);

        expect(stepper.value).toBe(2);

        stepper.value = 7;
        expect(stepper.value).toBe(7);

        stepper.value = '9';
        expect(stepper.value).toBe(9);

        stepper.value = 'abc';
        expect(stepper.value).toBe(0);

        stepper.value = undefined;
        expect(stepper.value).toBe(0);

        stepper.value = 500;
        expect(stepper.value).toBe(10);

        expect(changed).toEqual([7, 9, 0, 10]);

        stepper.destroy();
      });
    }));

  it('selects the whole number when a custom host takes focus from the keyboard', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10 });
        parts.inputEl.focus();
        expect(parts.inputEl.textContent).toBe('5');
        expect(parts.container.value).toBe(5);
        teardown(parts);
      });
    }));

  it('preserves a caret inside split custom-host text across a value write', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 12, min: 0, max: 99 });
        parts.inputEl.focus();

        const first = parts.inputEl.firstChild as Text;
        first.textContent = '1';
        const second = document.createTextNode('2');
        parts.inputEl.appendChild(second);

        const selection = window.getSelection()!;
        const caret = document.createRange();
        caret.setStart(second, 1);
        caret.setEnd(second, 1);
        selection.removeAllRanges();
        selection.addRange(caret);

        parts.container.value = 34;

        expect(parts.inputEl.textContent).toBe('34');
        const restored = selection.getRangeAt(0);
        expect(restored.startOffset).toBe(2);

        teardown(parts);
      });
    }));

  it('clamps the caret to the new text when the value loses a digit', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 120, min: 0, max: 999 });
        parts.inputEl.focus();

        const selection = window.getSelection()!;
        const caret = document.createRange();
        const text = parts.inputEl.firstChild as Text;
        caret.setStart(text, 3);
        caret.setEnd(text, 3);
        selection.removeAllRanges();
        selection.addRange(caret);

        parts.container.value = 34;

        expect(parts.inputEl.textContent).toBe('34');
        expect(selection.getRangeAt(0).startOffset).toBe(2);

        teardown(parts);
      });
    }));

  it('keeps a coordinator-less field safe to type into and to submit from', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const input = aria('stepper-input');
        const inputEl = bind(document.createElement('div'), input);

        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        expect(input.value).toBe(0);

        expect(key(inputEl, 'keydown', 'Enter').defaultPrevented).toBe(true);

        input.destroy();
      });
    }));

  it('skips the whole-number selection when focus follows the pointer', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const parts = buildTree({ value: 5, min: 0, max: 10 });
        parts.inputEl.dispatchEvent(new PointerEvent('pointerenter'));
        parts.inputEl.focus();
        expect(parts.container.value).toBe(5);
        expect(parts.inputEl.textContent).toBe('5');
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
