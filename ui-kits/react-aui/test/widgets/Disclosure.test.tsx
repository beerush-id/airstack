import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Disclosure, DisclosurePanel, DisclosureTrigger } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicDisclosure(props: { disabled?: boolean; expanded?: boolean }) {
  return (
    <Disclosure disabled={props.disabled} expanded={props.expanded}>
      <DisclosureTrigger>Shipping details</DisclosureTrigger>
      <DisclosurePanel>Arrives in 2–3 business days.</DisclosurePanel>
    </Disclosure>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Disclosure', () => {
  it('starts collapsed and announces expansion on the trigger', async () => {
    destroy = await runApp(async () => {
      render(<BasicDisclosure />);
      const trigger = screen.getByRole('button', { name: 'Shipping details' });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('region', { hidden: true })).toHaveProperty('hidden', true);
    });
  });

  it('toggles the panel once per click', async () => {
    destroy = await runApp(async () => {
      render(<BasicDisclosure />);
      const trigger = screen.getByRole('button', { name: 'Shipping details' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('region')).not.toHaveProperty('hidden', true);
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Disclosure disabled ontoggle={() => (changes += 1)}>
          <DisclosureTrigger>Locked section</DisclosureTrigger>
          <DisclosurePanel>Membership unlocks this content.</DisclosurePanel>
        </Disclosure>
      );
      const trigger = screen.getByRole('button', { name: 'Locked section' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(changes).toBe(0);
    });
  });

  it('binds expanded two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <Disclosure expanded={$bind(state, 'open')}>
          <DisclosureTrigger>Shipping details</DisclosureTrigger>
          <DisclosurePanel>Arrives in 2–3 business days.</DisclosurePanel>
        </Disclosure>
      );
      const trigger = screen.getByRole('button', { name: 'Shipping details' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(state.open).toBe(true);
      await act(async () => {
        state.open = false;
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('forwards consumer ref to the root', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Disclosure ref={ref}>
          <DisclosureTrigger>Shipping details</DisclosureTrigger>
          <DisclosurePanel>Arrives in 2–3 business days.</DisclosurePanel>
        </Disclosure>
      );
      expect(ref.current).toBeInstanceOf(HTMLElement);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const first = render(
        <Disclosure className="my-disclosure">
          <DisclosureTrigger>Shipping details</DisclosureTrigger>
          <DisclosurePanel>Arrives in 2–3 business days.</DisclosurePanel>
        </Disclosure>
      );
      const root = first.container.firstElementChild as HTMLElement;
      expect(root.className).toContain('my-disclosure');
      expect(root.className).toContain('aui-disclosure');
      first.unmount();
      configure({ overrides: true });
      const second = render(
        <Disclosure className="only-me">
          <DisclosureTrigger>Shipping details</DisclosureTrigger>
          <DisclosurePanel>Arrives in 2–3 business days.</DisclosurePanel>
        </Disclosure>
      );
      expect((second.container.firstElementChild as HTMLElement).className).toBe('only-me');
    });
  });
});
