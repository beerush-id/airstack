import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { TabButton, TabList, TabPanel, Tabs } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicTabs(props: { disabled?: boolean; value?: string }) {
  return (
    <Tabs disabled={props.disabled} value={props.value}>
      <TabList label="Account settings">
        <TabButton name="account">Account</TabButton>
        <TabButton name="security">Security</TabButton>
      </TabList>
      <TabPanel name="account">Personal details and email.</TabPanel>
      <TabPanel name="security">Sessions and security keys.</TabPanel>
    </Tabs>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Tabs', () => {
  it('keeps one tab open behind the strip', async () => {
    destroy = await runApp(async () => {
      render(<BasicTabs />);
      expect(screen.getByRole('tablist', { name: 'Account settings' })).toBeInstanceOf(HTMLElement);
      expect(screen.getAllByRole('tab')).toHaveLength(2);
      expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2);
    });
  });

  it('switches panels on trigger activation', async () => {
    destroy = await runApp(async () => {
      render(<BasicTabs />);
      await act(async () => {
        await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
      });
      expect(screen.getByRole('tab', { name: 'Security' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  it('locks switching while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(
        <Tabs disabled onchange={() => (changes += 1)}>
          <TabList label="Account settings">
            <TabButton name="account">Account</TabButton>
            <TabButton name="security">Security</TabButton>
          </TabList>
          <TabPanel name="account">Personal details and email.</TabPanel>
          <TabPanel name="security">Sessions and security keys.</TabPanel>
        </Tabs>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
      });
      expect(changes).toBe(0);
      expect(screen.getByRole('tab', { name: 'Security' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ current: 'account' });
      render(
        <Tabs value={$bind(state, 'current')}>
          <TabList label="Account settings">
            <TabButton name="account">Account</TabButton>
            <TabButton name="security">Security</TabButton>
          </TabList>
          <TabPanel name="account">Personal details and email.</TabPanel>
          <TabPanel name="security">Sessions and security keys.</TabPanel>
        </Tabs>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
      });
      expect(state.current).toBe('security');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const first = render(<BasicTabs />);
      first.unmount();
      const second = render(
        <Tabs className="my-tabs">
          <TabList label="Account settings">
            <TabButton name="account">Account</TabButton>
          </TabList>
          <TabPanel name="account">Personal details and email.</TabPanel>
        </Tabs>
      );
      const root = second.container.firstElementChild as HTMLElement;
      expect(root.className).toContain('my-tabs');
      expect(root.className).toContain('aui-tab');
      second.unmount();
      configure({ overrides: true });
      const third = render(
        <Tabs className="only-me">
          <TabList label="Account settings">
            <TabButton name="account">Account</TabButton>
          </TabList>
          <TabPanel name="account">Personal details and email.</TabPanel>
        </Tabs>
      );
      expect((third.container.firstElementChild as HTMLElement).className).toBe('only-me');
    });
  });
});
