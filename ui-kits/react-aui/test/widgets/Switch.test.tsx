import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Switch } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Switch', () => {
  it('starts off, flips on click, and announces the state', async () => {
    destroy = await runApp(async () => {
      render(<Switch aria-label="Wi-Fi" />);
      const control = screen.getByRole('switch', { name: 'Wi-Fi' });
      expect(control.getAttribute('aria-checked')).toBe('false');
      expect(control.querySelector('.aui-switch-track')).not.toBeNull();
      expect(control.querySelector('.aui-switch-thumb')).not.toBeNull();
      await act(async () => {
        await userEvent.click(control);
      });
      expect(control.getAttribute('aria-checked')).toBe('true');
      await act(async () => {
        await userEvent.click(control);
      });
      expect(control.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('renders only the track and names itself from aria-labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="wifi-setting">Wi-Fi</span>
          <Switch aria-labelledby="wifi-setting" />
        </>
      );
      const control = screen.getByRole('switch', { name: 'Wi-Fi' });
      expect(control.textContent).toBe('');
      expect(control.children).toHaveLength(1);
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(<Switch disabled aria-label="Locked" onchange={() => (changes += 1)} />);
      const control = screen.getByRole('switch', { name: 'Locked' });
      await act(async () => {
        await userEvent.click(control);
      });
      expect(control.getAttribute('aria-checked')).toBe('false');
      expect(changes).toBe(0);
    });
  });

  it('binds checked two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ on: false });
      render(<Switch aria-label="Bound" checked={$bind(state, 'on')} />);
      const control = screen.getByRole('switch', { name: 'Bound' });
      await act(async () => {
        await userEvent.click(control);
      });
      expect(state.on).toBe(true);
      expect(control.getAttribute('aria-checked')).toBe('true');
      await act(async () => {
        state.on = false;
      });
      expect(control.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('forwards events and consumer ref', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLButtonElement>();
      render(<Switch ref={ref} aria-label="Click me" onchange={() => (changes += 1)} />);
      const control = screen.getByRole('switch', { name: 'Click me' });
      expect(ref.current).toBe(control);
      await act(async () => {
        await userEvent.click(control);
      });
      expect(changes).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ switch: { size: 'sm', color: 'error' } });
      const { unmount } = render(<Switch aria-label="Fallback" />);
      expect(screen.getByRole('switch', { name: 'Fallback' }).className).toBe(
        'aui-control aui-control-sm aui-control-error aui-switch aui-switch-sm aui-switch-error'
      );
      unmount();
      render(<Switch size="lg" color="info" aria-label="Explicit" />);
      expect(screen.getByRole('switch', { name: 'Explicit' }).className).toBe(
        'aui-control aui-control-lg aui-control-info aui-switch aui-switch-lg aui-switch-info'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Switch aria-label="Additive" className="my-switch" />);
      expect(screen.getByRole('switch', { name: 'Additive' }).className).toContain('my-switch');
      expect(screen.getByRole('switch', { name: 'Additive' }).className).toContain('aui-switch');
      unmount();
      configure({ overrides: true });
      render(<Switch aria-label="Replacement" className="only-me" />);
      expect(screen.getByRole('switch', { name: 'Replacement' }).className).toBe('only-me');
    });
  });
});
