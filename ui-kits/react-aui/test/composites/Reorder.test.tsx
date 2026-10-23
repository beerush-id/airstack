import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Reorder, ReorderHandle, ReorderItem } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

const STAGES = ['build', 'test', 'deploy'];

type ChecklistProps = {
  value: string[];
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  resetOnBuild?: boolean;
  oninput?: (event: CustomEvent<string[]>) => void;
  onchange?: (event: CustomEvent<string[]>) => void;
  oncancel?: (event: CustomEvent<string>) => void;
};

function Checklist(props: ChecklistProps) {
  return (
    <Reorder
      label="Release checklist"
      value={props.value}
      disabled={props.disabled}
      orientation={props.orientation}
      oninput={props.oninput}
      onchange={props.onchange}
      oncancel={props.oncancel}
    >
      {STAGES.map((stage) => (
        <ReorderItem key={stage} value={stage} disabled={props.resetOnBuild && stage === 'test'}>
          <span>{stage}</span>
          <ReorderHandle label={`Move ${stage}`}>Move</ReorderHandle>
        </ReorderItem>
      ))}
    </Reorder>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Reorder', () => {
  it('renders a named collection of movable items', async () => {
    destroy = await runApp(async () => {
      render(<Checklist value={[...STAGES]} />);
      expect(screen.getByRole('list', { name: 'Release checklist' })).toBeInstanceOf(HTMLElement);
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });
  });

  it('previews a move and commits it on drop', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ order: [...STAGES] });
      const previews: string[][] = [];
      let committed: string[] | undefined;
      render(
        <Reorder
          label="Release checklist"
          value={$bind(state, 'order')}
          oninput={(event) => previews.push(event.detail)}
          onchange={(event) => (committed = event.detail)}
        >
          {STAGES.map((stage) => (
            <ReorderItem key={stage} value={stage}>
              <span>{stage}</span>
              <ReorderHandle label={`Move ${stage}`}>Move</ReorderHandle>
            </ReorderItem>
          ))}
        </Reorder>
      );

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Move build' }));
      });
      expect(screen.getByRole('button', { name: 'Move build' }).closest('li')?.getAttribute('data-active')).toBe(
        'true'
      );

      const handle = screen.getByRole('button', { name: 'Move build' });
      await act(async () => {
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
      });
      expect(previews).toEqual([['test', 'build', 'deploy']]);
      expect(state.order).toEqual([...STAGES]);

      await act(async () => {
        fireEvent.keyDown(handle, { key: 'Enter' });
      });
      expect(committed).toEqual(['test', 'build', 'deploy']);
      expect(state.order).toEqual(['test', 'build', 'deploy']);
    });
  });

  it('restores the committed order when canceled', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ order: [...STAGES] });
      let canceled: string | undefined;
      render(
        <Reorder
          label="Release checklist"
          value={$bind(state, 'order')}
          oncancel={(event) => (canceled = event.detail)}
        >
          {STAGES.map((stage) => (
            <ReorderItem key={stage} value={stage}>
              <span>{stage}</span>
              <ReorderHandle label={`Move ${stage}`}>Move</ReorderHandle>
            </ReorderItem>
          ))}
        </Reorder>
      );

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Move deploy' }));
      });
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('button', { name: 'Move deploy' }), { key: 'ArrowUp' });
        fireEvent.keyDown(screen.getByRole('button', { name: 'Move deploy' }), { key: 'Escape' });
      });
      expect(canceled).toBe('deploy');
      expect(state.order).toEqual([...STAGES]);
      expect(screen.getByRole('button', { name: 'Move deploy' }).closest('li')?.hasAttribute('data-active')).toBe(
        false
      );
    });
  });

  it('stays silent when an item drops back into its slot', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      render(<Checklist value={[...STAGES]} onchange={() => (changes += 1)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Move test' }));
      });
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('button', { name: 'Move test' }), { key: 'Enter' });
      });
      expect(changes).toBe(0);
    });
  });

  it('refuses to pick up a disabled item', async () => {
    destroy = await runApp(async () => {
      render(<Checklist value={[...STAGES]} resetOnBuild />);
      const handle = screen.getByRole('button', { name: 'Move test' });
      expect(handle.getAttribute('aria-disabled')).toBe('true');
      await act(async () => {
        await userEvent.click(handle);
      });
      expect(handle.getAttribute('data-active')).toBe(null);
    });
  });

  it('locks the whole collection while disabled', async () => {
    destroy = await runApp(async () => {
      render(<Checklist value={[...STAGES]} disabled />);
      const handle = screen.getByRole('button', { name: 'Move build' });
      await act(async () => {
        await userEvent.click(handle);
      });
      expect(handle.getAttribute('data-active')).toBe(null);
    });
  });

  it('moves along the horizontal axis with the left and right arrows', async () => {
    destroy = await runApp(async () => {
      const previews: string[][] = [];
      render(
        <Reorder
          label="Board columns"
          orientation="horizontal"
          value={['todo', 'doing', 'done']}
          oninput={(event) => previews.push(event.detail)}
        >
          {['todo', 'doing', 'done'].map((stage) => (
            <ReorderItem key={stage} value={stage}>
              <span>{stage}</span>
              <ReorderHandle label={`Move ${stage}`}>Move</ReorderHandle>
            </ReorderItem>
          ))}
        </Reorder>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Move todo' }));
      });
      await act(async () => {
        fireEvent.keyDown(screen.getByRole('button', { name: 'Move todo' }), { key: 'ArrowRight' });
      });
      expect(previews).toEqual([['doing', 'todo', 'done']]);
    });
  });

  it('supports horizontal orientation and class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Checklist value={[...STAGES]} orientation="horizontal" />);
      const list = screen.getByRole('list', { name: 'Release checklist' });
      expect(list.className).toContain('aui-reorder-horizontal');
      expect(screen.getAllByRole('listitem')[0].className).toContain('aui-reorder-item');
      unmount();
      configure({ overrides: true });
      render(
        <Reorder label="Release checklist" className="only-me" value={[...STAGES]}>
          <ReorderItem value="build" className="only-item">
            <ReorderHandle label="Move build" className="only-handle">
              Move
            </ReorderHandle>
          </ReorderItem>
        </Reorder>
      );
      expect(screen.getByRole('list').className).toBe('only-me');
      expect(screen.getByRole('listitem').className).toBe('only-item');
      expect(screen.getByRole('button').className).toBe('only-handle');
    });
  });
});
