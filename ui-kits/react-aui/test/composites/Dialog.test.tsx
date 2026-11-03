import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Dialog, DialogClose, DialogDescription, DialogPanel, DialogTitle, DialogTrigger } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicDialog(props: { dismissable?: boolean; nonmodal?: boolean; open?: boolean }) {
  return (
    <Dialog dismissable={props.dismissable} modality={props.nonmodal ? 'nonmodal' : undefined} open={props.open}>
      <DialogTrigger>Account settings</DialogTrigger>
      <DialogPanel>
        <DialogTitle>Account settings</DialogTitle>
        <DialogDescription>Update the details tied to your account.</DialogDescription>
        <DialogClose>Close</DialogClose>
      </DialogPanel>
    </Dialog>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Dialog', () => {
  it('links the trigger to a hidden panel that names and describes itself', async () => {
    destroy = await runApp(async () => {
      render(<BasicDialog />);
      const trigger = screen.getByRole('button', { name: 'Account settings' });
      const panel = screen.getByRole('dialog', { hidden: true });
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel).toHaveProperty('hidden', true);
      expect(panel.getAttribute('aria-modal')).toBe('true');
      const title = screen.getByText('Account settings', { selector: '.aui-dialog-title' });
      const description = screen.getByText('Update the details tied to your account.');
      expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
      expect(panel.getAttribute('aria-describedby')).toBe(description.id);
    });
  });

  it('opens on trigger activation and closes on Escape', async () => {
    destroy = await runApp(async () => {
      render(<BasicDialog />);
      const trigger = screen.getByRole('button', { name: 'Account settings' });
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

  it('ignores Escape while not dismissable', async () => {
    destroy = await runApp(async () => {
      render(<BasicDialog dismissable={false} />);
      const trigger = screen.getByRole('button', { name: 'Account settings' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.keyboard('{Escape}');
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('declares its modality on the panel', async () => {
    destroy = await runApp(async () => {
      render(<BasicDialog nonmodal />);
      expect(screen.getByRole('dialog', { hidden: true }).getAttribute('aria-modal')).toBe('false');
    });
  });

  it('closes through the close button and returns focus to the trigger', async () => {
    destroy = await runApp(async () => {
      render(<BasicDialog />);
      const trigger = screen.getByRole('button', { name: 'Account settings' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('binds open two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <Dialog open={$bind(state, 'open')}>
          <DialogTrigger>Account settings</DialogTrigger>
          <DialogPanel>
            <DialogTitle>Account settings</DialogTitle>
            <DialogDescription>Update the details tied to your account.</DialogDescription>
          </DialogPanel>
        </Dialog>
      );
      const trigger = screen.getByRole('button', { name: 'Account settings' });
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

  it('forwards refs to root and panel, and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const panelRef = React.createRef<HTMLDivElement>();
      const first = render(
        <Dialog ref={ref} className="my-dialog">
          <DialogTrigger>Account settings</DialogTrigger>
          <DialogPanel ref={panelRef} className="my-panel">
            <DialogTitle>Account settings</DialogTitle>
          </DialogPanel>
        </Dialog>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(panelRef.current?.className).toContain('aui-dialog-panel');
      expect(panelRef.current?.className).toContain('my-panel');
      expect(ref.current?.className).toContain('aui-dialog');
      expect(ref.current?.className).toContain('my-dialog');
      first.unmount();
      configure({ overrides: true });
      render(
        <Dialog className="only-me">
          <DialogTrigger>Account settings</DialogTrigger>
          <DialogPanel>
            <DialogTitle>Account settings</DialogTitle>
          </DialogPanel>
        </Dialog>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
