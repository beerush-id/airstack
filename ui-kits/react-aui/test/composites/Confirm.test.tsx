import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import {
  Confirm,
  ConfirmAction,
  ConfirmCancel,
  ConfirmDescription,
  ConfirmPanel,
  ConfirmTitle,
  ConfirmTrigger,
} from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicConfirm(props: { open?: boolean; onconfirm?: () => void; oncancel?: () => void }) {
  return (
    <Confirm open={props.open} onconfirm={props.onconfirm} oncancel={props.oncancel}>
      <ConfirmTrigger>Delete project</ConfirmTrigger>
      <ConfirmPanel>
        <ConfirmTitle>Delete project?</ConfirmTitle>
        <ConfirmDescription>Every notebook in it is removed for good.</ConfirmDescription>
        <ConfirmCancel>Keep project</ConfirmCancel>
        <ConfirmAction>Delete</ConfirmAction>
      </ConfirmPanel>
    </Confirm>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Confirm', () => {
  it('renders an alertdialog that names and describes itself while hidden', async () => {
    destroy = await runApp(async () => {
      render(<BasicConfirm />);
      const trigger = screen.getByRole('button', { name: 'Delete project' });
      const panel = screen.getByRole('alertdialog', { hidden: true });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(panel).toHaveProperty('hidden', true);
      expect(panel.getAttribute('aria-modal')).toBe('true');
      expect(panel.getAttribute('aria-labelledby')).toBe(
        screen.getByText('Delete project?', { selector: '.aui-confirm-title' }).id
      );
      expect(panel.getAttribute('aria-describedby')).toBe(
        screen.getByText('Every notebook in it is removed for good.').id
      );
    });
  });

  it('opens on the trigger and suppresses Escape', async () => {
    destroy = await runApp(async () => {
      render(<BasicConfirm />);
      const trigger = screen.getByRole('button', { name: 'Delete project' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('starts focus on the safe choice', async () => {
    destroy = await runApp(async () => {
      render(<BasicConfirm />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep project' }));
    });
  });

  it('cancels, reports it, and closes', async () => {
    destroy = await runApp(async () => {
      let cancelled = 0;
      let confirmed = 0;
      render(<BasicConfirm oncancel={() => (cancelled += 1)} onconfirm={() => (confirmed += 1)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Keep project' }));
      });
      expect(cancelled).toBe(1);
      expect(confirmed).toBe(0);
      expect(screen.getByRole('button', { name: 'Delete project' }).getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('confirms, reports it, and closes', async () => {
    destroy = await runApp(async () => {
      let cancelled = 0;
      let confirmed = 0;
      render(<BasicConfirm oncancel={() => (cancelled += 1)} onconfirm={() => (confirmed += 1)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      });
      expect(confirmed).toBe(1);
      expect(cancelled).toBe(0);
      expect(screen.getByRole('button', { name: 'Delete project' }).getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('binds open two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <Confirm open={$bind(state, 'open')}>
          <ConfirmTrigger>Delete project</ConfirmTrigger>
          <ConfirmPanel>
            <ConfirmTitle>Delete project?</ConfirmTitle>
            <ConfirmDescription>Every notebook in it is removed for good.</ConfirmDescription>
            <ConfirmCancel>Keep project</ConfirmCancel>
            <ConfirmAction>Delete</ConfirmAction>
          </ConfirmPanel>
        </Confirm>
      );
      const trigger = screen.getByRole('button', { name: 'Delete project' });
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

  it('forwards refs and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const panelRef = React.createRef<HTMLDivElement>();
      const first = render(
        <Confirm ref={ref} className="my-confirm">
          <ConfirmTrigger>Delete project</ConfirmTrigger>
          <ConfirmPanel ref={panelRef} className="my-confirm-panel">
            <ConfirmTitle>Delete project?</ConfirmTitle>
            <ConfirmAction>Delete</ConfirmAction>
          </ConfirmPanel>
        </Confirm>
      );
      expect(ref.current?.className).toContain('aui-confirm');
      expect(ref.current?.className).toContain('my-confirm');
      expect(panelRef.current?.className).toContain('aui-confirm-panel');
      expect(panelRef.current?.className).toContain('my-confirm-panel');
      first.unmount();
      configure({ overrides: true });
      render(
        <Confirm className="only-me">
          <ConfirmTrigger>Delete project</ConfirmTrigger>
          <ConfirmPanel>
            <ConfirmTitle>Delete project?</ConfirmTitle>
          </ConfirmPanel>
        </Confirm>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
