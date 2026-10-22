import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Radio, RadioGroup } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('RadioGroup', () => {
  it('holds one shared value and moves the slot between members', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ plan: 'pro' as string });
      render(
        <RadioGroup value={$bind(state, 'plan')}>
          <Radio value="starter">Starter</Radio>
          <Radio value="pro">Pro</Radio>
          <Radio value="team">Team</Radio>
        </RadioGroup>
      );
      expect((screen.getByRole('radio', { name: 'Pro' }) as HTMLInputElement).checked).toBe(true);
      await act(async () => {
        await userEvent.click(screen.getByRole('radio', { name: 'Team' }));
      });
      expect(state.plan).toBe('team');
      expect((screen.getByRole('radio', { name: 'Team' }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole('radio', { name: 'Pro' }) as HTMLInputElement).checked).toBe(false);
    });
  });

  it('locks every member while the group is disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const state = mutable({ plan: 'pro' as string });
      render(
        <RadioGroup disabled value={$bind(state, 'plan')} onchange={() => (changes += 1)}>
          <Radio value="starter">Starter</Radio>
          <Radio value="pro">Pro</Radio>
        </RadioGroup>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('radio', { name: 'Starter' }));
      });
      expect(state.plan).toBe('pro');
      expect(changes).toBe(0);
    });
  });

  it('forwards events and consumer ref from the container', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLDivElement>();
      const state = mutable({ plan: 'pro' as string });
      render(
        <RadioGroup ref={ref} value={$bind(state, 'plan')} onchange={() => (changes += 1)}>
          <Radio value="starter">Starter</Radio>
          <Radio value="pro">Pro</Radio>
        </RadioGroup>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('radiogroup');
      await act(async () => {
        await userEvent.click(screen.getByRole('radio', { name: 'Starter' }));
      });
      expect(changes).toBe(1);
    });
  });

  it('lends size and color to members without their own', async () => {
    destroy = await runApp(async () => {
      render(
        <RadioGroup size="sm" color="error">
          <Radio value="starter">Starter</Radio>
          <Radio value="pro" size="lg">
            Pro
          </Radio>
        </RadioGroup>
      );
      expect(screen.getByRole('radio', { name: 'Starter' }).className).toBe(
        'aui-radio-box aui-radio-box-sm aui-radio-box-error'
      );
      expect(screen.getByRole('radio', { name: 'Pro' }).className).toBe(
        'aui-radio-box aui-radio-box-lg aui-radio-box-error'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <RadioGroup className="my-group">
          <Radio value="starter">Starter</Radio>
        </RadioGroup>
      );
      const group = screen.getByRole('radiogroup');
      expect(group.className).toContain('my-group');
      expect(group.className).toContain('aui-radio-group');
      unmount();
      configure({ overrides: true });
      render(
        <RadioGroup className="only-me">
          <Radio value="starter">Starter</Radio>
        </RadioGroup>
      );
      expect(screen.getByRole('radiogroup').className).toBe('only-me');
    });
  });
});
