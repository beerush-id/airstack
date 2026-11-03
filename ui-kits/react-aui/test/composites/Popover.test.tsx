import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Button, Popover } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicPopover(props: { dismissable?: boolean; open?: boolean }) {
  return (
    <Button>
      Shortcuts
      <Popover dismissable={props.dismissable} open={props.open}>
        <span>Find anything</span>
      </Popover>
    </Button>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Popover', () => {
  it('links the panel to its trigger and starts closed', async () => {
    destroy = await runApp(async () => {
      render(<BasicPopover />);
      const trigger = screen.getByRole('button', { name: 'Shortcuts' });
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      const panel = screen.getByRole('dialog', { hidden: true });
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel).toHaveProperty('hidden', true);
    });
  });

  it('opens on activation and closes on Escape', async () => {
    destroy = await runApp(async () => {
      render(<BasicPopover />);
      const trigger = screen.getByRole('button', { name: 'Shortcuts' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('dialog')).not.toHaveProperty('hidden', true);
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('keeps Escape working while outside presses are locked', async () => {
    destroy = await runApp(async () => {
      render(<BasicPopover dismissable={false} />);
      const trigger = screen.getByRole('button', { name: 'Shortcuts' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.click(document.body);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('binds open two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <Button>
          Shortcuts
          <Popover open={$bind(state, 'open')}>
            <span>Find anything</span>
          </Popover>
        </Button>
      );
      const trigger = screen.getByRole('button', { name: 'Shortcuts' });
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

  it('announces the configured popup role on the panel', async () => {
    destroy = await runApp(async () => {
      render(
        <Button>
          Shortcuts
          <Popover popupRole="menu">
            <span>Find anything</span>
          </Popover>
        </Button>
      );
      expect(screen.getByRole('menu', { hidden: true })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Shortcuts' }).getAttribute('aria-haspopup')).toBe('dialog');
    });
  });

  it('forwards the consumer ref to the panel', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Button>
          Shortcuts
          <Popover ref={ref}>
            <span>Find anything</span>
          </Popover>
        </Button>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.className).toContain('aui-popover');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const first = render(
        <Button>
          Shortcuts
          <Popover className="my-popover">
            <span>Find anything</span>
          </Popover>
        </Button>
      );
      expect((first.container.querySelector('.aui-popover') as HTMLElement).className).toContain('my-popover');
      first.unmount();
      configure({ overrides: true });
      render(
        <Button>
          Shortcuts
          <Popover className="only-me">
            <span>Find anything</span>
          </Popover>
        </Button>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
