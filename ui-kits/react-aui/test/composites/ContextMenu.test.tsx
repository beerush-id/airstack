import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { ContextMenu, ContextMenuPanel, MenuItem } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function BasicContextMenu(props: { disabled?: boolean; open?: boolean; oncommand?: (name: string) => void }) {
  return (
    <ContextMenu
      label="Step actions"
      disabled={props.disabled}
      open={props.open}
      oncommand={(event) => props.oncommand?.(event.detail)}
    >
      <button type="button">Ship the docs</button>
      <button type="button">Announce in the forum</button>
      <ContextMenuPanel>
        <MenuItem name="duplicate-step">Duplicate step</MenuItem>
        <MenuItem name="delete-step" disabled>
          Delete
        </MenuItem>
      </ContextMenuPanel>
    </ContextMenu>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('ContextMenu', () => {
  it('mounts a hidden menu panel without compiling a role on the surface', async () => {
    destroy = await runApp(async () => {
      const { container } = render(<BasicContextMenu />);
      const surface = container.firstElementChild as HTMLElement;
      expect(surface.className).toContain('aui-context-menu');
      const panel = screen.getByRole('menu', { hidden: true });
      expect(panel).toHaveProperty('hidden', true);
      expect(panel.getAttribute('aria-label')).toBe('Step actions');
    });
  });

  it('opens at the pointer on a secondary click', async () => {
    destroy = await runApp(async () => {
      const { container } = render(<BasicContextMenu />);
      const surface = container.firstElementChild as HTMLElement;
      await act(async () => {
        fireEvent.contextMenu(surface, { clientX: 24, clientY: 48 });
      });
      const panel = screen.getByRole('menu');
      expect(panel).not.toHaveProperty('hidden', true);
      expect(surface.getAttribute('aria-haspopup')).toBe('menu');
      expect(surface.getAttribute('aria-expanded')).toBe('true');
      expect(surface.getAttribute('aria-controls')).toBe(`${surface.id}-menu`);
      expect(panel.id).toBe(surface.id);
      expect(panel.style.getPropertyValue('--anchor-x')).toBe('24px');
      expect(panel.style.getPropertyValue('--anchor-y')).toBe('48px');
    });
  });

  it('opens from the keyboard under the focused descendant', async () => {
    destroy = await runApp(async () => {
      render(<BasicContextMenu />);
      const row = screen.getByText('Ship the docs');
      await act(async () => {
        row.focus();
        await userEvent.keyboard('{Shift>}{F10}{/Shift}');
      });
      expect(screen.getByRole('menu')).not.toHaveProperty('hidden', true);
    });
  });

  it('invokes a command and closes itself', async () => {
    destroy = await runApp(async () => {
      const commands: string[] = [];
      const { container } = render(<BasicContextMenu oncommand={(name) => commands.push(name)} />);
      const surface = container.firstElementChild as HTMLElement;
      await act(async () => {
        fireEvent.contextMenu(surface, { clientX: 10, clientY: 10 });
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate step' }));
      });
      expect(commands).toEqual(['duplicate-step']);
      expect(surface.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('refuses both ways in while disabled', async () => {
    destroy = await runApp(async () => {
      const { container } = render(<BasicContextMenu disabled />);
      const surface = container.firstElementChild as HTMLElement;
      await act(async () => {
        fireEvent.contextMenu(surface, { clientX: 10, clientY: 10 });
      });
      expect(screen.getByRole('menu', { hidden: true })).toHaveProperty('hidden', true);
      const row = screen.getByText('Ship the docs');
      await act(async () => {
        row.focus();
        await userEvent.keyboard('{Shift>}{F10}{/Shift}');
      });
      expect(screen.getByRole('menu', { hidden: true })).toHaveProperty('hidden', true);
    });
  });

  it('binds open two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ open: false });
      render(
        <ContextMenu label="Step actions" open={$bind(state, 'open')}>
          <button type="button">Ship the docs</button>
          <ContextMenuPanel>
            <MenuItem name="duplicate-step">Duplicate step</MenuItem>
          </ContextMenuPanel>
        </ContextMenu>
      );
      const row = screen.getByText('Ship the docs');
      await act(async () => {
        row.focus();
        await userEvent.keyboard('{Shift>}{F10}{/Shift}');
      });
      expect(state.open).toBe(true);
      await act(async () => {
        state.open = false;
      });
      expect(screen.getByRole('menu', { hidden: true })).toHaveProperty('hidden', true);
    });
  });

  it('forwards refs and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const { container } = render(
        <ContextMenu ref={ref} className="my-surface" label="Step actions">
          <button type="button">Ship the docs</button>
          <ContextMenuPanel className="my-panel">
            <MenuItem name="duplicate-step">Duplicate step</MenuItem>
          </ContextMenuPanel>
        </ContextMenu>
      );
      expect((container.firstElementChild as HTMLElement).className).toContain('my-surface');
      expect(ref.current?.className).toContain('aui-context-menu');
      expect(ref.current?.className).toContain('my-surface');
      const panel = screen.getByRole('menu', { hidden: true });
      expect(panel.className).toContain('aui-context-menu-panel');
      expect(panel.className).toContain('my-panel');
      configure({ overrides: true });
      const second = render(
        <ContextMenu className="only-me" label="Step actions">
          <button type="button">Ship the docs</button>
          <ContextMenuPanel>
            <MenuItem name="duplicate-step">Duplicate step</MenuItem>
          </ContextMenuPanel>
        </ContextMenu>
      );
      expect((second.container.firstElementChild as HTMLElement).className).toBe('only-me');
    });
  });
});
