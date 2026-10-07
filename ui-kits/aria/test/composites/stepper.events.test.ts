import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type StepperInputProps, type StepperProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('StepperInput - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer input handler per step and change on blur', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const onchange = vi.fn();
        const stepper = aria('stepper', mutable<StepperProps>({ value: 10, min: 0, max: 20 }));
        const input = aria('stepper-input', mutable<StepperInputProps>({ oninput, onchange }), { native: false });
        const inputEl = bind(document.createElement('div'), input);

        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true }));

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent<number>).detail).toBe(11);

        inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

        expect(onchange).toHaveBeenCalledTimes(1);
        expect((onchange.mock.calls[0][0] as CustomEvent<number>).detail).toBe(11);
        expect(inputEl.oninput).toBeNull();

        input.destroy();
        stepper.destroy();
      });
    }));

  it('types the committed value for consumers without a cast', () => {
    const props: StepperInputProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number>();
      },
    };

    void props;
  });
});
