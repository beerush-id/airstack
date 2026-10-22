import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Checkbox } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Checkbox', () => {
  it('marks and unmarks on click and announces it', async () => {
    destroy = await runApp(async () => {
      render(<Checkbox>Weekly digest</Checkbox>);
      const box = screen.getByRole('checkbox', { name: 'Weekly digest' });
      expect(box).toBeInstanceOf(HTMLInputElement);
      expect((box as HTMLInputElement).checked).toBe(false);
      await act(async () => {
        await userEvent.click(box);
      });
      expect((box as HTMLInputElement).checked).toBe(true);
      await act(async () => {
        await userEvent.click(box);
      });
      expect((box as HTMLInputElement).checked).toBe(false);
    });
  });

  it('holds the undecided state and settles it on activation', async () => {
    destroy = await runApp(async () => {
      render(<Checkbox indeterminate>Select all topics</Checkbox>);
      const box = screen.getByRole('checkbox', { name: 'Select all topics' }) as HTMLInputElement;
      expect(box.indeterminate).toBe(true);
      await act(async () => {
        await userEvent.click(box);
      });
      expect(box.indeterminate).toBe(false);
      expect((box as HTMLInputElement).checked).toBe(true);
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Checkbox disabled onchange={() => (changes += 1)}>
          Legacy SMS alerts
        </Checkbox>
      );
      const box = screen.getByRole('checkbox', { name: 'Legacy SMS alerts' });
      await act(async () => {
        await userEvent.click(box);
      });
      expect((box as HTMLInputElement).checked).toBe(false);
      expect(changes).toBe(0);
    });
  });

  it('binds checked two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ on: false });
      render(<Checkbox checked={$bind(state, 'on')}>Push notifications</Checkbox>);
      const box = screen.getByRole('checkbox', { name: 'Push notifications' });
      await act(async () => {
        await userEvent.click(box);
      });
      expect(state.on).toBe(true);
      expect((box as HTMLInputElement).checked).toBe(true);
      await act(async () => {
        state.on = false;
      });
      expect((box as HTMLInputElement).checked).toBe(false);
    });
  });

  it('forwards events, label text, and consumer ref', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLInputElement>();
      render(
        <Checkbox ref={ref} onchange={() => (changes += 1)}>
          Click me
        </Checkbox>
      );
      const box = screen.getByRole('checkbox', { name: 'Click me' });
      expect(ref.current).toBe(box);
      await act(async () => {
        await userEvent.click(box);
      });
      expect(changes).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ checkbox: { size: 'sm', color: 'error' } });
      const { unmount } = render(<Checkbox>Fallback</Checkbox>);
      expect(screen.getByRole('checkbox', { name: 'Fallback' }).className).toBe(
        'aui-checkbox-box aui-checkbox-box-sm aui-checkbox-box-error'
      );
      unmount();
      render(
        <Checkbox size="lg" color="info">
          Explicit
        </Checkbox>
      );
      expect(screen.getByRole('checkbox', { name: 'Explicit' }).className).toBe(
        'aui-checkbox-box aui-checkbox-box-lg aui-checkbox-box-info'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Checkbox className="my-box">Additive</Checkbox>);
      expect(screen.getByRole('checkbox', { name: 'Additive' }).className).toContain('my-box');
      expect(screen.getByRole('checkbox', { name: 'Additive' }).className).toContain('aui-checkbox-box');
      unmount();
      configure({ overrides: true });
      render(<Checkbox className="only-me">Replacement</Checkbox>);
      expect(screen.getByRole('checkbox', { name: 'Replacement' }).className).toBe('only-me');
    });
  });
});
