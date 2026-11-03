import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Checkbox, CheckboxGroup } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('CheckboxGroup', () => {
  it('holds one committed set across members', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ channels: ['email'] as string[] });
      render(
        <CheckboxGroup value={$bind(state, 'channels')}>
          <Checkbox value="email">Email</Checkbox>
          <Checkbox value="sms">SMS</Checkbox>
        </CheckboxGroup>
      );
      expect((screen.getByRole('checkbox', { name: 'Email' }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole('checkbox', { name: 'SMS' }) as HTMLInputElement).checked).toBe(false);
      await act(async () => {
        await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
      });
      expect(state.channels).toEqual(['email', 'sms']);
      await act(async () => {
        await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
      });
      expect(state.channels).toEqual(['sms']);
    });
  });

  it('locks every member while the group is disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const state = mutable({ channels: ['email'] as string[] });
      render(
        <CheckboxGroup disabled value={$bind(state, 'channels')} onchange={() => (changes += 1)}>
          <Checkbox value="email">Email</Checkbox>
          <Checkbox value="sms">SMS</Checkbox>
        </CheckboxGroup>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
      });
      expect(state.channels).toEqual(['email']);
      expect(changes).toBe(0);
    });
  });

  it('names the grouping with label', async () => {
    destroy = await runApp(async () => {
      render(
        <CheckboxGroup label="Notification channels">
          <Checkbox value="email">Email</Checkbox>
        </CheckboxGroup>
      );
      expect(screen.getByRole('group', { name: 'Notification channels' }).getAttribute('aria-label')).toBe(
        'Notification channels'
      );
    });
  });

  it('forwards events and consumer ref from the container', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLDivElement>();
      const state = mutable({ channels: ['email'] as string[] });
      render(
        <CheckboxGroup ref={ref} value={$bind(state, 'channels')} onchange={() => (changes += 1)}>
          <Checkbox value="email">Email</Checkbox>
          <Checkbox value="sms">SMS</Checkbox>
        </CheckboxGroup>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('group');
      await act(async () => {
        await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
      });
      expect(changes).toBe(1);
    });
  });

  it('lends size and color to members without their own', async () => {
    destroy = await runApp(async () => {
      render(
        <CheckboxGroup size="sm" color="error">
          <Checkbox value="email">Email</Checkbox>
          <Checkbox value="sms" size="lg">
            SMS
          </Checkbox>
        </CheckboxGroup>
      );
      expect(screen.getByRole('checkbox', { name: 'Email' }).className).toBe(
        'aui-checkbox-box aui-checkbox-box-sm aui-checkbox-box-error'
      );
      expect(screen.getByRole('checkbox', { name: 'SMS' }).className).toBe(
        'aui-checkbox-box aui-checkbox-box-lg aui-checkbox-box-error'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <CheckboxGroup className="my-group">
          <Checkbox value="email">Email</Checkbox>
        </CheckboxGroup>
      );
      const group = screen.getByRole('group');
      expect(group.className).toContain('my-group');
      expect(group.className).toContain('aui-checkbox-group');
      unmount();
      configure({ overrides: true });
      render(
        <CheckboxGroup className="only-me">
          <Checkbox value="email">Email</Checkbox>
        </CheckboxGroup>
      );
      expect(screen.getByRole('group').className).toBe('only-me');
    });
  });
});
