import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Radio } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Radio', () => {
  it('takes the slot on click and announces it', async () => {
    destroy = await runApp(async () => {
      render(<Radio value="pro">Pro</Radio>);
      const option = screen.getByRole('radio', { name: 'Pro' });
      expect((option as HTMLInputElement).checked).toBe(false);
      await act(async () => {
        await userEvent.click(option);
      });
      expect((option as HTMLInputElement).checked).toBe(true);
    });
  });

  it('never turns itself off once holding the slot', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Radio value="pro" checked onchange={() => (changes += 1)}>
          Pro
        </Radio>
      );
      const option = screen.getByRole('radio', { name: 'Pro' });
      await act(async () => {
        await userEvent.click(option);
      });
      expect((option as HTMLInputElement).checked).toBe(true);
      expect(changes).toBe(0);
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Radio value="pro" disabled onchange={() => (changes += 1)}>
          Pro
        </Radio>
      );
      const option = screen.getByRole('radio', { name: 'Pro' });
      await act(async () => {
        await userEvent.click(option);
      });
      expect((option as HTMLInputElement).checked).toBe(false);
      expect(changes).toBe(0);
    });
  });

  it('binds checked two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ on: false });
      render(<Radio value="pro" checked={$bind(state, 'on')}>Pro</Radio>);
      const option = screen.getByRole('radio', { name: 'Pro' });
      await act(async () => {
        await userEvent.click(option);
      });
      expect(state.on).toBe(true);
      expect((option as HTMLInputElement).checked).toBe(true);
    });
  });

  it('forwards events, label text, and consumer ref', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLInputElement>();
      render(
        <Radio ref={ref} value="pro" onchange={() => (changes += 1)}>
          Click me
        </Radio>
      );
      const option = screen.getByRole('radio', { name: 'Click me' });
      expect(ref.current).toBe(option);
      await act(async () => {
        await userEvent.click(option);
      });
      expect(changes).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ radio: { size: 'sm', color: 'error' } });
      const { unmount } = render(<Radio value="a">Fallback</Radio>);
      expect(screen.getByRole('radio', { name: 'Fallback' }).className).toBe(
        'aui-radio-box aui-radio-box-sm aui-radio-box-error'
      );
      unmount();
      render(
        <Radio value="b" size="lg" color="info">
          Explicit
        </Radio>
      );
      expect(screen.getByRole('radio', { name: 'Explicit' }).className).toBe(
        'aui-radio-box aui-radio-box-lg aui-radio-box-info'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Radio value="a" className="my-box">Additive</Radio>);
      expect(screen.getByRole('radio', { name: 'Additive' }).className).toContain('my-box');
      expect(screen.getByRole('radio', { name: 'Additive' }).className).toContain('aui-radio-box');
      unmount();
      configure({ overrides: true });
      render(<Radio value="b" className="only-me">Replacement</Radio>);
      expect(screen.getByRole('radio', { name: 'Replacement' }).className).toBe('only-me');
    });
  });
});
