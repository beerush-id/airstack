import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Toggle } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Toggle', () => {
  it('inverts pressed state on click and announces it', async () => {
    destroy = await runApp(async () => {
      render(<Toggle>Bold</Toggle>);
      const toggle = screen.getByRole('button', { name: 'Bold' });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Toggle disabled onchange={() => (changes += 1)}>
          Locked
        </Toggle>
      );
      const toggle = screen.getByRole('button', { name: 'Locked' });
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(changes).toBe(0);
    });
  });

  it('binds pressed two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ on: false });
      render(<Toggle pressed={$bind(state, 'on')}>Bound</Toggle>);
      const toggle = screen.getByRole('button', { name: 'Bound' });
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(state.on).toBe(true);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        state.on = false;
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('forwards events, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLButtonElement>();
      render(
        <Toggle ref={ref} onchange={() => (changes += 1)}>
          Click me
        </Toggle>
      );
      const toggle = screen.getByRole('button', { name: 'Click me' });
      expect(ref.current).toBe(toggle);
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(changes).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ toggle: { size: 'sm', color: 'error' } });
      const { unmount } = render(<Toggle>Fallback</Toggle>);
      expect(screen.getByRole('button', { name: 'Fallback' }).className).toBe(
        'aui-control aui-control-sm aui-control-error aui-toggle aui-toggle-sm aui-toggle-error'
      );
      unmount();
      render(
        <Toggle size="lg" color="info">
          Explicit
        </Toggle>
      );
      expect(screen.getByRole('button', { name: 'Explicit' }).className).toBe(
        'aui-control aui-control-lg aui-control-info aui-toggle aui-toggle-lg aui-toggle-info'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Toggle className="my-toggle">Additive</Toggle>);
      expect(screen.getByRole('button', { name: 'Additive' }).className).toContain('my-toggle');
      expect(screen.getByRole('button', { name: 'Additive' }).className).toContain('aui-toggle');
      unmount();
      configure({ overrides: true });
      render(<Toggle className="only-me">Replacement</Toggle>);
      expect(screen.getByRole('button', { name: 'Replacement' }).className).toBe('only-me');
    });
  });
});
