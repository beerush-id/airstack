import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Listbox, ListboxOption } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicListbox(props: { disabled?: boolean; multiple?: boolean }) {
  return (
    <Listbox label="Delivery speed" disabled={props.disabled} multiple={props.multiple}>
      <ListboxOption value="standard">Standard</ListboxOption>
      <ListboxOption value="express">Express</ListboxOption>
      <ListboxOption value="overnight" disabled>
        Overnight
      </ListboxOption>
    </Listbox>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Listbox', () => {
  it('renders options with listbox semantics', async () => {
    destroy = await runApp(async () => {
      render(<BasicListbox />);
      expect(screen.getByRole('listbox', { name: 'Delivery speed' })).toBeInstanceOf(HTMLElement);
      expect(screen.getByRole('option', { name: 'Standard' })).toHaveLength;
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });
  });

  it('commits an option and reports the whole value', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Listbox label="Speed" onchange={(event) => (committed = event.detail)}>
          <ListboxOption value="express">Express</ListboxOption>
        </Listbox>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Express' }));
      });
      expect(committed).toBe('express');
      expect(screen.getByRole('option', { name: 'Express' }).getAttribute('aria-selected')).toBe('true');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ speed: '' });
      render(
        <Listbox label="Speed" value={$bind(state, 'speed')}>
          <ListboxOption value="express">Express</ListboxOption>
        </Listbox>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Express' }));
      });
      expect(state.speed).toBe('express');
    });
  });

  it('locks every option while disabled', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Listbox label="Speed" disabled onchange={(event) => (committed = event.detail)}>
          <ListboxOption value="express">Express</ListboxOption>
        </Listbox>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Express' }));
      });
      expect(committed).toBeUndefined();
      expect(screen.getByRole('option', { name: 'Express' }).getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('forwards consumer ref to the root', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Listbox ref={ref} label="Speed">
          <ListboxOption value="standard">Standard</ListboxOption>
        </Listbox>
      );
      expect(ref.current).toBe(screen.getByRole('listbox', { name: 'Speed' }));
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Listbox label="Speed" className="my-list">
          <ListboxOption value="standard">Standard</ListboxOption>
        </Listbox>
      );
      expect(screen.getByRole('listbox', { name: 'Speed' }).className).toContain('my-list');
      expect(screen.getByRole('listbox', { name: 'Speed' }).className).toContain('aui-listbox');
      unmount();
      configure({ overrides: true });
      render(
        <Listbox label="Speed" className="only-me">
          <ListboxOption value="standard">Standard</ListboxOption>
        </Listbox>
      );
      expect(screen.getByRole('listbox', { name: 'Speed' }).className).toBe('only-me');
    });
  });
});
