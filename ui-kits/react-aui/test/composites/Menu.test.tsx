import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import {
  Menu,
  MenuBar,
  MenuButton,
  MenuItem,
  MenuItemCheckbox,
  MenuItemGroup,
  MenuItemRadio,
  MenuPanel,
} from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicMenu(props: { disabled?: boolean; oncommand?: (name: string) => void; open?: boolean }) {
  return (
    <Menu
      label="Document actions"
      disabled={props.disabled}
      open={props.open}
      oncommand={(event) => props.oncommand?.(event.detail)}
    >
      <MenuButton>Options</MenuButton>
      <MenuPanel>
        <MenuItem name="new-file">New document</MenuItem>
        <MenuItem name="save-file" disabled>
          Save
        </MenuItem>
        <MenuItemCheckbox name="word-wrap" checked>
          Word wrap
        </MenuItemCheckbox>
        <MenuItemGroup label="Alignment" value="left">
          <MenuItemRadio value="left">Align left</MenuItemRadio>
          <MenuItemRadio value="center">Align center</MenuItemRadio>
        </MenuItemGroup>
      </MenuPanel>
    </Menu>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Menu', () => {
  it('links the trigger to a hidden vertical menu panel', async () => {
    destroy = await runApp(async () => {
      render(<BasicMenu />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      const panel = screen.getByRole('menu', { hidden: true });
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-orientation')).toBe('vertical');
      expect(panel.getAttribute('aria-label')).toBe('Document actions');
      expect(panel).toHaveProperty('hidden', true);
    });
  });

  it('opens on activation and exposes the three item roles', async () => {
    destroy = await runApp(async () => {
      render(<BasicMenu />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getAllByRole('menuitem').length).toBe(2);
      expect(screen.getByRole('menuitemcheckbox', { name: 'Word wrap' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('menuitemradio', { name: 'Align left' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('menuitemradio', { name: 'Align center' }).getAttribute('aria-checked')).toBe('false');
      expect(screen.getByRole('group', { name: 'Alignment' })).toBeDefined();
    });
  });

  it('invokes a command with its name, closes, and skips disabled items', async () => {
    destroy = await runApp(async () => {
      const commands: string[] = [];
      render(<BasicMenu oncommand={(name) => commands.push(name)} />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('menuitem', { name: 'Save' }));
      });
      expect(commands).toEqual([]);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      await act(async () => {
        await userEvent.click(screen.getByRole('menuitem', { name: 'New document' }));
      });
      expect(commands).toEqual(['new-file']);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('activates the focused item from the keyboard', async () => {
    destroy = await runApp(async () => {
      const commands: string[] = [];
      render(<BasicMenu oncommand={(name) => commands.push(name)} />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      const first = screen.getByRole('menuitem', { name: 'New document' });
      await act(async () => {
        first.focus();
      });
      await act(async () => {
        await userEvent.keyboard('{Enter}');
      });
      expect(commands).toEqual(['new-file']);
    });
  });

  it('toggles a checkbox item in place and keeps the menu open', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ wrap: false });
      render(
        <Menu label="Document actions">
          <MenuButton>Options</MenuButton>
          <MenuPanel>
            <MenuItemCheckbox name="word-wrap" checked={$bind(state, 'wrap')}>
              Word wrap
            </MenuItemCheckbox>
          </MenuPanel>
        </Menu>
      );
      const trigger = screen.getByRole('button', { name: 'Options' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      const item = screen.getByRole('menuitemcheckbox', { name: 'Word wrap' });
      expect(item.getAttribute('aria-checked')).toBe('false');
      await act(async () => {
        await userEvent.click(item);
      });
      expect(state.wrap).toBe(true);
      expect(item.getAttribute('aria-checked')).toBe('true');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('coordinates radio items around one bound value', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ alignment: 'left' });
      render(
        <Menu label="Document actions">
          <MenuButton>Options</MenuButton>
          <MenuPanel>
            <MenuItemGroup label="Alignment" value={$bind(state, 'alignment')}>
              <MenuItemRadio value="left">Align left</MenuItemRadio>
              <MenuItemRadio value="center">Align center</MenuItemRadio>
            </MenuItemGroup>
          </MenuPanel>
        </Menu>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Options' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'Align center' }));
      });
      expect(state.alignment).toBe('center');
      expect(screen.getByRole('menuitemradio', { name: 'Align center' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('menuitemradio', { name: 'Align left' }).getAttribute('aria-checked')).toBe('false');
    });
  });

  it('refuses to open while the root is disabled', async () => {
    destroy = await runApp(async () => {
      render(<BasicMenu disabled />);
      const trigger = screen.getByRole('button', { name: 'Options' });
      await act(async () => {
        await userEvent.click(trigger);
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('menu', { hidden: true })).toHaveProperty('hidden', true);
    });
  });

  it('binds open two-way inside a named menu bar', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <MenuBar label="Main">
          <Menu open={$bind(state, 'open')} label="File">
            <MenuButton>File</MenuButton>
            <MenuPanel>
              <MenuItem name="new-file">New document</MenuItem>
            </MenuPanel>
          </Menu>
        </MenuBar>
      );
      expect(screen.getByRole('menubar').getAttribute('aria-label')).toBe('Main');
      const trigger = screen.getByRole('button', { name: 'File' });
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
      const first = render(
        <Menu ref={ref} className="my-menu" label="Document actions">
          <MenuButton className="my-button">Options</MenuButton>
          <MenuPanel className="my-panel">
            <MenuItem name="new-file" className="my-item">
              New document
            </MenuItem>
          </MenuPanel>
        </Menu>
      );
      expect(ref.current?.className).toContain('aui-menu');
      expect(ref.current?.className).toContain('my-menu');
      expect(screen.getByRole('button', { name: 'Options' }).className).toContain('my-button');
      expect(screen.getByRole('menu', { hidden: true }).className).toContain('my-panel');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Options' }));
      });
      expect(screen.getByRole('menuitem', { name: 'New document' }).className).toContain('my-item');
      first.unmount();
      configure({ overrides: true });
      render(
        <Menu className="only-me" label="Document actions">
          <MenuButton>Options</MenuButton>
          <MenuPanel>
            <MenuItem name="new-file">New document</MenuItem>
          </MenuPanel>
        </Menu>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
