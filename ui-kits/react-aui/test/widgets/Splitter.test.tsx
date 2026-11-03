import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Splitter } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type LayoutProps = {
  value?: number;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  oninput?: (event: CustomEvent<number>) => void;
  onchange?: (event: CustomEvent<number>) => void;
};

function Layout(props: LayoutProps) {
  return (
    <div>
      <div>Canvas</div>
      <Splitter
        label="Preview width"
        value={props.value}
        min={10}
        max={90}
        orientation={props.orientation}
        disabled={props.disabled}
        oninput={props.oninput}
        onchange={props.onchange}
      />
      <div>Inspector</div>
    </div>
  );
}

const separator = () => screen.getByRole('separator', { name: 'Preview width' });

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Splitter', () => {
  it('renders a named separator with its range and axis', async () => {
    destroy = await runApp(async () => {
      render(<Layout value={40} orientation="vertical" />);
      const handle = separator();
      expect(handle.getAttribute('aria-valuenow')).toBe('40');
      expect(handle.getAttribute('aria-valuemin')).toBe('10');
      expect(handle.getAttribute('aria-valuemax')).toBe('90');
      expect(handle.getAttribute('aria-orientation')).toBe('vertical');
      expect(handle.getAttribute('tabindex')).toBe('0');
      expect(handle.style.getPropertyValue('--aria-splitter-offset')).toBe('37.5%');
      expect(handle.className).toContain('aui-splitter');
    });
  });

  it('steps with the arrows and reports both edges of the interaction', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ split: 40 });
      const inputs: number[] = [];
      const changes: number[] = [];
      render(
        <Splitter
          label="Preview width"
          value={$bind(state, 'split')}
          min={10}
          max={90}
          oninput={(event) => inputs.push(event.detail)}
          onchange={(event) => changes.push(event.detail)}
        />
      );
      await act(async () => {
        fireEvent.keyDown(separator(), { key: 'ArrowRight' });
      });
      expect(state.split).toBe(41);
      expect(inputs).toEqual([41]);
      expect(changes).toEqual([41]);
      await act(async () => {
        fireEvent.keyDown(separator(), { key: 'ArrowUp' });
      });
      expect(state.split).toBe(40);
    });
  });

  it('holds at the bounds instead of overshooting', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ split: 90 });
      let changes = 0;
      render(
        <Splitter
          label="Preview width"
          value={$bind(state, 'split')}
          min={10}
          max={90}
          onchange={() => (changes += 1)}
        />
      );
      await act(async () => {
        fireEvent.keyDown(separator(), { key: 'ArrowRight' });
      });
      expect(state.split).toBe(90);
      expect(changes).toBe(0);
    });
  });

  it('leaves the tab order and refuses moves while disabled', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ split: 50 });
      render(<Splitter label="Preview width" value={$bind(state, 'split')} min={0} max={100} disabled />);
      const handle = separator();
      expect(handle.getAttribute('aria-disabled')).toBe('true');
      expect(handle.getAttribute('tabindex')).toBe('-1');
      await act(async () => {
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      });
      expect(state.split).toBe(50);
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Splitter label="Preview width" value={50} className="my-splitter" />);
      expect(separator().className).toContain('my-splitter');
      expect(separator().className).toContain('aui-splitter');
      unmount();
      configure({ overrides: true });
      render(<Splitter label="Preview width" value={50} className="only-me" />);
      expect(separator().className).toBe('only-me');
    });
  });
});
