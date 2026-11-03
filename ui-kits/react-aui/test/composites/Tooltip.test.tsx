import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Button, Tooltip } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicTooltip() {
  return (
    <Button>
      Save
      <Tooltip>Stored on this device</Tooltip>
    </Button>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Tooltip', () => {
  it('starts hidden, takes no tab stop, and describes nothing', async () => {
    destroy = await runApp(async () => {
      render(<BasicTooltip />);
      const trigger = screen.getByRole('button', { name: 'Save' });
      expect(trigger.hasAttribute('aria-describedby')).toBe(false);
      const panel = screen.getByRole('tooltip', { hidden: true });
      expect(panel).toHaveProperty('hidden', true);
      expect(panel.hasAttribute('tabindex')).toBe(false);
    });
  });

  it('opens on focus without waiting and links itself through aria-describedby', async () => {
    destroy = await runApp(async () => {
      render(<BasicTooltip />);
      const trigger = screen.getByRole('button', { name: 'Save' });
      await act(async () => {
        trigger.focus();
      });
      const panel = screen.getByRole('tooltip');
      expect(panel).not.toHaveProperty('hidden', true);
      expect(trigger.getAttribute('aria-describedby')).toBe(panel.id);
    });
  });

  it('closes on blur and drops the description link', async () => {
    destroy = await runApp(async () => {
      render(<BasicTooltip />);
      const trigger = screen.getByRole('button', { name: 'Save' });
      await act(async () => {
        trigger.focus();
      });
      await act(async () => {
        trigger.blur();
      });
      expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  it('closes on Escape without moving focus', async () => {
    destroy = await runApp(async () => {
      render(<BasicTooltip />);
      const trigger = screen.getByRole('button', { name: 'Save' });
      await act(async () => {
        trigger.focus();
      });
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      await waitFor(() => expect(trigger.hasAttribute('aria-describedby')).toBe(false));
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('binds open two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <Button>
          Save
          <Tooltip open={$bind(state, 'open')}>Stored on this device</Tooltip>
        </Button>
      );
      const trigger = screen.getByRole('button', { name: 'Save' });
      await act(async () => {
        trigger.focus();
      });
      expect(state.open).toBe(true);
      await act(async () => {
        state.open = false;
      });
      expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  it('forwards the consumer ref and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const first = render(
        <Button>
          Save
          <Tooltip ref={ref} className="my-tooltip">
            Stored on this device
          </Tooltip>
        </Button>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.className).toContain('aui-tooltip');
      expect(ref.current?.className).toContain('my-tooltip');
      first.unmount();
      configure({ overrides: true });
      render(
        <Button>
          Save
          <Tooltip className="only-me">Stored on this device</Tooltip>
        </Button>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
