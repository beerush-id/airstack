import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Accordion, AccordionButton, AccordionPanel } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicAccordion(props: { disabled?: boolean; required?: boolean }) {
  return (
    <Accordion disabled={props.disabled} required={props.required}>
      <AccordionButton name="shipping">Shipping</AccordionButton>
      <AccordionPanel name="shipping">Ships in two business days.</AccordionPanel>
      <AccordionButton name="returns">Returns</AccordionButton>
      <AccordionPanel name="returns">Returns within 30 days.</AccordionPanel>
    </Accordion>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Accordion', () => {
  it('opens a section on header activation', async () => {
    destroy = await runApp(async () => {
      render(<BasicAccordion />);
      const shipping = screen.getByRole('button', { name: 'Shipping' });
      await act(async () => {
        await userEvent.click(shipping);
      });
      expect(shipping.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Ships in two business days.').parentElement).not.toBeNull();
    });
  });

  it('moves expansion between sections in single mode', async () => {
    destroy = await runApp(async () => {
      render(<BasicAccordion />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Shipping' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Returns' }));
      });
      expect(screen.getByRole('button', { name: 'Returns' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Shipping' }).getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('locks every header while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Accordion disabled onchange={() => (changes += 1)}>
          <AccordionButton name="shipping">Shipping</AccordionButton>
          <AccordionPanel name="shipping">Ships in two business days.</AccordionPanel>
        </Accordion>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Shipping' }));
      });
      expect(changes).toBe(0);
      expect(screen.getByRole('button', { name: 'Shipping' }).getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ section: '' });
      render(
        <Accordion value={$bind(state, 'section')}>
          <AccordionButton name="shipping">Shipping</AccordionButton>
          <AccordionPanel name="shipping">Ships in two business days.</AccordionPanel>
        </Accordion>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Shipping' }));
      });
      expect(state.section).toBe('shipping');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const first = render(
        <Accordion className="my-accordion">
          <AccordionButton name="shipping">Shipping</AccordionButton>
          <AccordionPanel name="shipping">Ships in two business days.</AccordionPanel>
        </Accordion>
      );
      const root = first.container.firstElementChild as HTMLElement;
      expect(root.className).toContain('my-accordion');
      expect(root.className).toContain('aui-accordion');
      first.unmount();
      configure({ overrides: true });
      const second = render(
        <Accordion className="only-me">
          <AccordionButton name="shipping">Shipping</AccordionButton>
          <AccordionPanel name="shipping">Ships in two business days.</AccordionPanel>
        </Accordion>
      );
      expect((second.container.firstElementChild as HTMLElement).className).toBe('only-me');
    });
  });
});
