import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxPanel } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicCity() {
  return (
    <Combobox>
      <ComboboxInput label="City" placeholder="Type to filter" />
      <ComboboxPanel>
        <ComboboxOption value="ams">Amsterdam</ComboboxOption>
        <ComboboxOption value="ber">Berlin</ComboboxOption>
      </ComboboxPanel>
    </Combobox>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Combobox', () => {
  it('renders an editable field that owns the popup', async () => {
    destroy = await runApp(async () => {
      render(<BasicCity />);
      const field = screen.getByRole('combobox', { name: 'City' });
      expect(field.tagName).toBe('INPUT');
      expect(field.getAttribute('aria-autocomplete')).toBe('list');
    });
  });

  it('opens on typing and commits the chosen option', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Combobox onchange={(event) => (committed = event.detail)}>
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ams">Amsterdam</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      const field = screen.getByRole('combobox', { name: 'City' });
      await act(async () => {
        await userEvent.click(field);
        await userEvent.keyboard('ams');
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Amsterdam' }));
      });
      expect(committed).toBe('ams');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ city: '' });
      render(
        <Combobox value={$bind(state, 'city')}>
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ber">Berlin</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'City' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Berlin' }));
      });
      expect(state.city).toBe('ber');
    });
  });

  it('locks typing and committing while disabled', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Combobox disabled onchange={(event) => (committed = event.detail)}>
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ams">Amsterdam</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      const field = screen.getByRole('combobox', { name: 'City' });
      expect(field.hasAttribute('disabled') || field.getAttribute('aria-disabled') === 'true').toBe(true);
      await act(async () => {
        await userEvent.click(field);
        await userEvent.keyboard('ams');
      });
      expect(field.getAttribute('aria-expanded')).toBe('false');
      expect(committed).toBeUndefined();
    });
  });

  it('forwards consumer ref to the root', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Combobox ref={ref}>
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ams">Amsterdam</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Combobox className="my-combo">
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ams">Amsterdam</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      const root = screen.getByRole('combobox', { name: 'City' }).closest('.aui-combobox, .my-combo');
      expect(root?.className).toContain('my-combo');
      expect(root?.className).toContain('aui-combobox');
      unmount();
      configure({ overrides: true });
      render(
        <Combobox className="only-me">
          <ComboboxInput label="City" />
          <ComboboxPanel>
            <ComboboxOption value="ams">Amsterdam</ComboboxOption>
          </ComboboxPanel>
        </Combobox>
      );
      expect(screen.getByRole('combobox', { name: 'City' }).closest('.only-me')?.className).toBe('only-me');
    });
  });
});
