import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Tree, TreeGroup, TreeItem } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function Files(props: { disabled?: boolean; multiple?: boolean; value?: string | string[] }) {
  return (
    <Tree label="Project files" value={props.value} disabled={props.disabled} multiple={props.multiple}>
      <TreeItem name="src" label="src" expanded={true}>
        <span>src</span>
        <TreeGroup>
          <TreeItem name="index.ts">
            <span>index.ts</span>
          </TreeItem>
        </TreeGroup>
      </TreeItem>
      <TreeItem name="package.json">
        <span>package.json</span>
      </TreeItem>
    </Tree>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Tree', () => {
  it('renders the hierarchy with branches and leaves distinct', async () => {
    destroy = await runApp(async () => {
      render(<Files />);
      expect(screen.getByRole('tree', { name: 'Project files' })).toBeInstanceOf(HTMLElement);
      expect(screen.getAllByRole('treeitem')).toHaveLength(3);
      expect(screen.getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('treeitem', { name: 'index.ts' }).hasAttribute('aria-expanded')).toBe(false);
      expect(screen.getByRole('group')).toBeInstanceOf(HTMLElement);
    });
  });

  it('selects a leaf and reports the tree value', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Tree label="Project files" onchange={(event) => (committed = event.detail)}>
          <TreeItem name="package.json">
            <span>package.json</span>
          </TreeItem>
        </Tree>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('treeitem', { name: 'package.json' }));
      });
      expect(committed).toBe('package.json');
      expect(screen.getByRole('treeitem', { name: 'package.json' }).getAttribute('aria-selected')).toBe('true');
    });
  });

  it('expands a closed branch with ArrowRight', async () => {
    destroy = await runApp(async () => {
      render(
        <Tree label="Project files" value="src">
          <TreeItem name="src" label="src" expanded={false}>
            <span>src</span>
            <TreeGroup>
              <TreeItem name="index.ts">
                <span>index.ts</span>
              </TreeItem>
            </TreeGroup>
          </TreeItem>
        </Tree>
      );
      const branch = screen.getByRole('treeitem', { name: 'src' });
      act(() => branch.focus());
      await act(async () => {
        await userEvent.keyboard('{ArrowRight}');
      });
      expect(screen.getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('group').hasAttribute('hidden')).toBe(false);
    });
  });

  it('holds every chosen node in a multiple value', async () => {
    destroy = await runApp(async () => {
      const state = mutable<{ chosen: string[] }>({ chosen: ['src'] });
      render(
        <Tree label="Export targets" multiple value={$bind(state, 'chosen')}>
          <TreeItem name="src">
            <span>src</span>
          </TreeItem>
          <TreeItem name="types">
            <span>types</span>
          </TreeItem>
        </Tree>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('treeitem', { name: 'types' }));
      });
      expect(state.chosen).toContain('src');
      expect(state.chosen).toContain('types');
    });
  });

  it('locks selection while the tree is disabled', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Tree label="Project files" disabled onchange={(event) => (committed = event.detail)}>
          <TreeItem name="package.json">
            <span>package.json</span>
          </TreeItem>
        </Tree>
      );
      const item = screen.getByRole('treeitem', { name: 'package.json' });
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.getAttribute('tabindex')).toBe('-1');
      fireEvent.click(item);
      expect(committed).toBeUndefined();
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Files />);
      const tree = screen.getByRole('tree', { name: 'Project files' });
      expect(tree.className).toContain('aui-tree');
      expect(screen.getByRole('treeitem', { name: 'src' }).className).toContain('aui-tree-item');
      expect(screen.getByRole('group').className).toContain('aui-tree-group');
      unmount();
      configure({ overrides: true });
      render(
        <Tree label="Project files" className="only-me">
          <TreeItem name="src" label="src">
            <span>src</span>
          </TreeItem>
        </Tree>
      );
      expect(screen.getByRole('tree', { name: 'Project files' }).className).toBe('only-me');
    });
  });
});
