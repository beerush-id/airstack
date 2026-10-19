import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { configure, resetConfig } from '../../src/config.js';
import { Select, SelectOption, SelectPanel, SelectTrigger } from '../../src/index.js';
import { runApp } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

const LABELS = { red: 'Red', green: 'Green', blue: 'Blue' };

function BasicSelect(props: { disabled?: boolean }) {
  return (
    <Select labels={LABELS} disabled={props.disabled}>
      <SelectTrigger />
      <SelectPanel>
        <SelectOption value="red">Red</SelectOption>
        <SelectOption value="green">Green</SelectOption>
        <SelectOption value="blue">Blue</SelectOption>
      </SelectPanel>
    </Select>
  );
}

afterEach(() => {
  destroy?.();
});

describe('Select', () => {
  it('starts closed with fallback trigger text and opens on activation', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      render(<BasicSelect />);
      const trigger = screen.getByRole('combobox');
      expect(trigger.textContent).toContain('Choose a value');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('commits an option and shows its label on the trigger', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      let committed: unknown;
      render(
        <Select labels={LABELS} onchange={(event) => (committed = event.detail)}>
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="green">Green</SelectOption>
          </SelectPanel>
        </Select>
      );
      const trigger = screen.getByRole('combobox');
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Green' }));
      });
      expect(committed).toBe('green');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.textContent).toContain('Green');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      const state = mutable({ color: '' });
      render(
        <Select labels={LABELS} value={$bind(state, 'color')}>
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="blue">Blue</SelectOption>
          </SelectPanel>
        </Select>
      );
      const trigger = screen.getByRole('combobox');
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('option', { name: 'Blue' }));
      });
      expect(state.color).toBe('blue');
    });
  });

  it('closes an open single select on Escape', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      render(<BasicSelect />);
      const trigger = screen.getByRole('combobox');
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('stays shut while disabled', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      render(<BasicSelect disabled />);
      const trigger = screen.getByRole('combobox');
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('forwards consumer ref to the root', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Select ref={ref} labels={LABELS}>
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="red">Red</SelectOption>
          </SelectPanel>
        </Select>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(within(ref.current as HTMLDivElement).getByRole('combobox')).toBeDefined();
    });
  });

  it('uses configured fallbacks and explicit props win on the root', async () => {
    destroy = await runApp(async () => {
      configure({ select: { size: 'sm', variant: 'outlined', color: 'error' } });
      const { unmount } = render(<BasicSelect />);
      expect(screen.getByRole('combobox').closest('.aui-select')?.className).toBe(
        'aui-select aui-select-sm aui-select-outlined aui-select-error'
      );
      expect(screen.getByRole('combobox').className).toBe('aui-action aui-select-trigger');
      unmount();
      render(
        <Select labels={LABELS} size="lg" variant="filled" color="info">
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="red">Red</SelectOption>
          </SelectPanel>
        </Select>
      );
      expect(screen.getByRole('combobox').closest('.aui-select')?.className).toBe(
        'aui-select aui-select-lg aui-select-filled aui-select-info'
      );
      resetConfig();
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      const { unmount } = render(
        <Select labels={LABELS} className="my-select">
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="red">Red</SelectOption>
          </SelectPanel>
        </Select>
      );
      const root = screen.getByRole('combobox').closest('.aui-select, .my-select');
      expect(root?.className).toContain('my-select');
      expect(root?.className).toContain('aui-select');
      unmount();
      configure({ overrides: true });
      render(
        <Select labels={LABELS} className="only-me">
          <SelectTrigger />
          <SelectPanel>
            <SelectOption value="red">Red</SelectOption>
          </SelectPanel>
        </Select>
      );
      expect(screen.getByRole('combobox').closest('.only-me')?.className).toBe('only-me');
      resetConfig();
    });
  });
});
