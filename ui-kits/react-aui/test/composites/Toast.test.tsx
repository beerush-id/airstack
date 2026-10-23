import type { StateUnsubscribe } from '@airlib/react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Toast, ToastClose } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicToast(props: { critical?: boolean; duration?: number; ondismiss?: () => void; disabled?: boolean }) {
  return (
    <Toast critical={props.critical} duration={props.duration} ondismiss={props.ondismiss}>
      <span>Draft saved</span>
      <ToastClose disabled={props.disabled} aria-label="Dismiss">
        Dismiss
      </ToastClose>
    </Toast>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Toast', () => {
  it('announces itself once as a polite status region', async () => {
    destroy = await runApp(async () => {
      render(<BasicToast />);
      const toast = screen.getByRole('status');
      expect(toast.textContent).toContain('Draft saved');
      expect(toast.getAttribute('aria-live')).toBe('polite');
      expect(toast.getAttribute('aria-atomic')).toBe('false');
      expect(toast.className).toContain('aui-toast');
    });
  });

  it('interrupts as an alert when critical', async () => {
    destroy = await runApp(async () => {
      render(<BasicToast critical />);
      const toast = screen.getByRole('alert');
      expect(toast.getAttribute('aria-live')).toBe('assertive');
    });
  });

  it('dismisses through the close button and leaves the node to its owner', async () => {
    destroy = await runApp(async () => {
      let dismissed = 0;
      render(<BasicToast ondismiss={() => (dismissed += 1)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      });
      await waitFor(() => expect(dismissed).toBe(1));
      expect(screen.getByRole('status')).toBeInstanceOf(HTMLElement);
    });
  });

  it('expires after its lifetime when one is declared', async () => {
    destroy = await runApp(async () => {
      let dismissed = 0;
      render(<BasicToast duration={60} ondismiss={() => (dismissed += 1)} />);
      await waitFor(() => expect(dismissed).toBe(1), { timeout: 1500 });
    });
  });

  it('dismisses nothing while the close button is locked', async () => {
    destroy = await runApp(async () => {
      let dismissed = 0;
      render(<BasicToast disabled ondismiss={() => (dismissed += 1)} />);
      const close = screen.getByRole('button', { name: 'Dismiss' });
      expect(close.hasAttribute('disabled') || close.getAttribute('aria-disabled') === 'true').toBe(true);
      await act(async () => {
        await userEvent.click(close);
      });
      expect(dismissed).toBe(0);
    });
  });

  it('forwards a consumer ref and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const first = render(
        <Toast ref={ref} className="my-toast">
          <span>Saved</span>
          <ToastClose className="my-close">Dismiss</ToastClose>
        </Toast>
      );
      expect(ref.current?.className).toContain('aui-toast');
      expect(ref.current?.className).toContain('my-toast');
      expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('aui-toast-close');
      expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('my-close');
      first.unmount();
      configure({ overrides: true });
      render(
        <Toast className="only-me">
          <span>Saved</span>
        </Toast>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
