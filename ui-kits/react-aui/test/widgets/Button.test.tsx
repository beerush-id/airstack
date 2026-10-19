import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { configure, resetConfig } from '../../src/config.js';
import { Button } from '../../src/index.js';
import { runApp } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

afterEach(() => {
  destroy?.();
});

describe('Button', () => {
  it('does not submit a form by default', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      let submissions = 0;
      render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submissions += 1;
          }}
        >
          <Button>Save</Button>
        </form>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      });
      expect(submissions).toBe(0);
    });
  });

  it('submits when type is submit', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      let submissions = 0;
      render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submissions += 1;
          }}
        >
          <Button type="submit">Submit</Button>
        </form>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
      });
      expect(submissions).toBe(1);
    });
  });

  it('blocks activation when disabled', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      let activations = 0;
      render(
        <Button disabled onClick={() => (activations += 1)}>
          Locked
        </Button>
      );
      const button = screen.getByRole('button', { name: 'Locked' });
      await act(async () => {
        await userEvent.click(button);
      });
      expect(activations).toBe(0);
    });
  });

  it('forwards events, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      let clicks = 0;
      const ref = React.createRef<HTMLButtonElement>();
      render(
        <Button ref={ref} onClick={() => (clicks += 1)}>
          Click me
        </Button>
      );
      const button = screen.getByRole('button', { name: 'Click me' });
      expect(ref.current).toBe(button);
      await act(async () => {
        await userEvent.click(button);
      });
      expect(clicks).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ button: { size: 'sm', variant: 'text', color: 'error' } });
      const { unmount } = render(<Button>Fallback</Button>);
      expect(screen.getByRole('button', { name: 'Fallback' }).className).toBe(
        'aui-action aui-button aui-button-sm aui-button-text aui-button-error'
      );
      unmount();
      render(
        <Button size="lg" variant="outlined" color="info">
          Explicit
        </Button>
      );
      expect(screen.getByRole('button', { name: 'Explicit' }).className).toBe(
        'aui-action aui-button aui-button-lg aui-button-outlined aui-button-info'
      );
      resetConfig();
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      resetConfig();
      const { unmount } = render(<Button className="my-btn">Additive</Button>);
      expect(screen.getByRole('button', { name: 'Additive' }).className).toContain('my-btn');
      expect(screen.getByRole('button', { name: 'Additive' }).className).toContain('aui-button');
      unmount();
      configure({ overrides: true });
      render(<Button className="only-me">Replacement</Button>);
      expect(screen.getByRole('button', { name: 'Replacement' }).className).toBe('only-me');
      resetConfig();
    });
  });

  it('emits no controlled classes when configured with overrides: true and className is provided', async () => {
    destroy = await runApp(async () => {
      configure({ overrides: true });
      render(<Button className={'custom-button'}>Bare</Button>);
      const button = screen.getByRole('button', { name: 'Bare' });
      expect(button.className).toBe('custom-button');
      expect(button.getAttribute('type')).toBe('button');
      resetConfig();
    });
  });
});
