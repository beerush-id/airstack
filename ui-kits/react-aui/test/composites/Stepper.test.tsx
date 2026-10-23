import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Stepper, StepperDecrement, StepperIncrement, StepperInput } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type QuantityProps = {
  value?: number;
  disabled?: boolean;
  readonly?: boolean;
  oninput?: (event: CustomEvent<number>) => void;
  onchange?: (event: CustomEvent<number>) => void;
};

function Quantity(props: QuantityProps) {
  return (
    <Stepper
      aria-label="Quantity"
      value={props.value}
      min={1}
      max={8}
      disabled={props.disabled}
      readonly={props.readonly}
      oninput={props.oninput}
      onchange={props.onchange}
    >
      <StepperDecrement aria-label="Decrease quantity">−</StepperDecrement>
      <StepperInput aria-label="Quantity" />
      <StepperIncrement aria-label="Increase quantity">+</StepperIncrement>
    </Stepper>
  );
}

const increment = () => screen.getByRole('button', { name: 'Increase quantity' }) as HTMLButtonElement;
const decrement = () => screen.getByRole('button', { name: 'Decrease quantity' }) as HTMLButtonElement;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Stepper', () => {
  it('shares one bounded number between the field and the buttons', async () => {
    destroy = await runApp(async () => {
      render(<Quantity value={2} />);
      expect(screen.getByRole('group', { name: 'Quantity' })).toBeInstanceOf(HTMLElement);
      const field = screen.getByRole('spinbutton', { name: 'Quantity' });
      expect(field.getAttribute('aria-valuenow')).toBe('2');
      expect(field.getAttribute('aria-valuemin')).toBe('1');
      expect(field.getAttribute('aria-valuemax')).toBe('8');
      expect((field as HTMLInputElement).value).toBe('2');
      expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInstanceOf(HTMLElement);
    });
  });

  it('steps the shared value on a press and reports it', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ qty: 2 });
      const inputs: number[] = [];
      render(
        <Stepper
          aria-label="Quantity"
          value={$bind(state, 'qty')}
          min={1}
          max={8}
          oninput={(event) => inputs.push(event.detail)}
        >
          <StepperDecrement aria-label="Decrease quantity">−</StepperDecrement>
          <StepperInput aria-label="Quantity" />
          <StepperIncrement aria-label="Increase quantity">+</StepperIncrement>
        </Stepper>
      );
      await act(async () => {
        await userEvent.click(increment());
      });
      expect(state.qty).toBe(3);
      expect(inputs).toContain(3);
      expect(screen.getByRole('spinbutton', { name: 'Quantity' }).getAttribute('aria-valuenow')).toBe('3');
      await act(async () => {
        await userEvent.click(decrement());
      });
      expect(state.qty).toBe(2);
    });
  });

  it('disables each button at its own bound', async () => {
    destroy = await runApp(async () => {
      render(<Quantity value={8} />);
      expect(increment().disabled).toBe(true);
      expect(decrement().disabled).toBe(false);
      render(<Quantity value={1} />);
      const [firstDecrement, secondDecrement] = screen.getAllByRole('button', { name: 'Decrease quantity' });
      expect((firstDecrement as HTMLButtonElement).disabled).toBe(false);
      expect((secondDecrement as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('steps with the vertical and page keys but leaves the horizontal arrows', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ qty: 2 });
      render(
        <Stepper aria-label="Quantity" value={$bind(state, 'qty')} min={0} max={20}>
          <StepperInput aria-label="Quantity" />
        </Stepper>
      );
      const field = screen.getByRole('spinbutton', { name: 'Quantity' });
      await act(async () => {
        fireEvent.keyDown(field, { key: 'ArrowUp' });
      });
      expect(state.qty).toBe(3);
      await act(async () => {
        fireEvent.keyDown(field, { key: 'PageDown' });
      });
      expect(state.qty).toBe(0);
      await act(async () => {
        fireEvent.keyDown(field, { key: 'ArrowRight' });
      });
      expect(state.qty).toBe(0);
    });
  });

  it('closes the value while read-only', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ qty: 4 });
      render(
        <Stepper aria-label="Quantity" value={$bind(state, 'qty')} min={1} max={8} readonly>
          <StepperDecrement aria-label="Decrease quantity">−</StepperDecrement>
          <StepperInput aria-label="Quantity" />
          <StepperIncrement aria-label="Increase quantity">+</StepperIncrement>
        </Stepper>
      );
      expect(increment().disabled).toBe(true);
      expect(decrement().disabled).toBe(true);
      expect((screen.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement).readOnly).toBe(true);
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Quantity' }), { key: 'ArrowUp' });
      });
      expect(state.qty).toBe(4);
    });
  });

  it('locks the whole group while disabled', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ qty: 5 });
      render(
        <Stepper aria-label="Quantity" value={$bind(state, 'qty')} min={0} max={10} disabled>
          <StepperDecrement aria-label="Decrease quantity">−</StepperDecrement>
          <StepperInput aria-label="Quantity" />
          <StepperIncrement aria-label="Increase quantity">+</StepperIncrement>
        </Stepper>
      );
      expect(increment().disabled).toBe(true);
      expect(decrement().disabled).toBe(true);
      expect((screen.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement).disabled).toBe(true);
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Quantity' }), { key: 'ArrowUp' });
      });
      expect(state.qty).toBe(5);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Stepper aria-label="Quantity" value={2} className="my-stepper">
          <StepperInput aria-label="Quantity" className="my-field" />
          <StepperIncrement aria-label="Increase quantity" className="my-button">
            +
          </StepperIncrement>
        </Stepper>
      );
      expect(screen.getByRole('group').className).toContain('my-stepper');
      expect(screen.getByRole('group').className).toContain('aui-stepper');
      expect(screen.getByRole('spinbutton').className).toContain('aui-stepper-input');
      expect(increment().className).toContain('aui-stepper-button');
      unmount();
      configure({ overrides: true });
      render(
        <Stepper aria-label="Quantity" value={2} className="only-me">
          <StepperInput aria-label="Quantity" className="only-field" />
          <StepperIncrement aria-label="Increase quantity" className="only-button">
            +
          </StepperIncrement>
        </Stepper>
      );
      expect(screen.getByRole('group').className).toBe('only-me');
      expect(screen.getByRole('spinbutton').className).toBe('only-field');
      expect(increment().className).toBe('only-button');
    });
  });
});
