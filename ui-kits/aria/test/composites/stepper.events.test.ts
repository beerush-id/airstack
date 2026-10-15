import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  aria,
  type StepperChangeEvent,
  type StepperInputEvent,
  type StepperInputProps,
  type StepperProps,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

type StepperEventProps = {
  oninput?: (event: StepperInputEvent) => void;
  onchange?: (event: StepperChangeEvent) => void;
};

describe('Stepper - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('promises input and change on the stepper for a stepping key', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const onchange = vi.fn();
        const stepper = aria('stepper', mutable<StepperProps & StepperEventProps>({ value: 10, min: 0, max: 20, oninput, onchange }));
        const input = aria('stepper-input', mutable<StepperInputProps>({}));
        const containerEl = document.createElement('div');
        const inputEl = bind(document.createElement('div'), input);
        containerEl.appendChild(inputEl);
        document.body.appendChild(containerEl);
        bind(containerEl, stepper);

        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true }));

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as StepperInputEvent).detail).toBe(11);
        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as StepperChangeEvent).detail).toBe(11);

        // Blur announces nothing of its own
        inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        expect(oninput).toHaveBeenCalledTimes(1);
        expect(onchange).toHaveBeenCalledTimes(1);

        input.destroy();
        stepper.destroy();
        document.body.removeChild(containerEl);
      });
    }));

  it('hands a typed keystroke to the field part without putting it back on the element', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const stepper = aria('stepper', mutable<StepperProps>({ value: 2, min: 0, max: 10 }));
        const input = aria<HTMLInputElement>('stepper-input', mutable<StepperInputProps>({ oninput }), { native: true });
        const containerEl = document.createElement('div');
        const inputEl = bind(document.createElement('input'), input);
        containerEl.appendChild(inputEl);
        document.body.appendChild(containerEl);
        bind(containerEl, stepper);

        inputEl.value = '4';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as StepperInputEvent).detail).toBe(4);
        expect(inputEl.oninput).toBeNull();

        input.destroy();
        stepper.destroy();
        document.body.removeChild(containerEl);
      });
    }));

  it('types the event payloads for consumers without a cast', () => {
    const props: StepperInputProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<string | number | undefined | null>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number | undefined>();
      },
    };

    void props;
  });
});
