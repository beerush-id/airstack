import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Toggle, ToggleGroup } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('ToggleGroup', () => {
  it('holds one shared value across members in single mode', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ align: 'left' as string | string[] });
      render(
        <ToggleGroup value={$bind(state, 'align')}>
          <Toggle value="left">Left</Toggle>
          <Toggle value="center">Center</Toggle>
          <Toggle value="right">Right</Toggle>
        </ToggleGroup>
      );
      const center = screen.getByRole('button', { name: 'Center' });
      expect(screen.getByRole('button', { name: 'Left' }).getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        await userEvent.click(center);
      });
      expect(state.align).toBe('center');
      expect(center.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Left' }).getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('clears the single value when the pressed member is activated again', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ align: 'left' as string | string[] | null });
      render(
        <ToggleGroup
          value={state.align}
          onchange={(event) => {
            state.align = event.detail;
          }}
        >
          <Toggle value="left">Left</Toggle>
          <Toggle value="center">Center</Toggle>
        </ToggleGroup>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Left' }));
      });
      expect(state.align).toBeNull();
      expect(screen.getByRole('button', { name: 'Left' }).getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('flips membership in the array in multiple mode', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ style: ['bold'] as string[] });
      render(
        <ToggleGroup multiple value={$bind(state, 'style')}>
          <Toggle value="bold">Bold</Toggle>
          <Toggle value="italic">Italic</Toggle>
        </ToggleGroup>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Italic' }));
      });
      expect(state.style).toEqual(['bold', 'italic']);
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
      });
      expect(state.style).toEqual(['italic']);
    });
  });

  it('locks every member while the group is disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const state = mutable({ align: 'left' as string | string[] });
      render(
        <ToggleGroup disabled value={$bind(state, 'align')} onchange={() => (changes += 1)}>
          <Toggle value="left">Left</Toggle>
          <Toggle value="center">Center</Toggle>
        </ToggleGroup>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Center' }));
      });
      expect(state.align).toBe('left');
      expect(changes).toBe(0);
    });
  });

  it('forwards events and consumer ref from the container', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const ref = React.createRef<HTMLDivElement>();
      const state = mutable({ align: 'left' as string | string[] });
      render(
        <ToggleGroup ref={ref} value={$bind(state, 'align')} onchange={() => (changes += 1)}>
          <Toggle value="left">Left</Toggle>
          <Toggle value="center">Center</Toggle>
        </ToggleGroup>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('group');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Center' }));
      });
      expect(changes).toBe(1);
    });
  });

  it('lends size and color to members without their own', async () => {
    destroy = await runApp(async () => {
      render(
        <ToggleGroup size="sm" color="error">
          <Toggle value="left">Left</Toggle>
          <Toggle value="center" size="lg">
            Center
          </Toggle>
        </ToggleGroup>
      );
      expect(screen.getByRole('button', { name: 'Left' }).className).toBe(
        'aui-control aui-control-sm aui-control-error aui-toggle aui-toggle-sm aui-toggle-error'
      );
      expect(screen.getByRole('button', { name: 'Center' }).className).toBe(
        'aui-control aui-control-lg aui-control-error aui-toggle aui-toggle-lg aui-toggle-error'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <ToggleGroup className="my-group">
          <Toggle value="left">Left</Toggle>
        </ToggleGroup>
      );
      const group = screen.getByRole('group');
      expect(group.className).toContain('my-group');
      expect(group.className).toContain('aui-toggle-group');
      unmount();
      configure({ overrides: true });
      render(
        <ToggleGroup className="only-me">
          <Toggle value="left">Left</Toggle>
        </ToggleGroup>
      );
      expect(screen.getByRole('group').className).toBe('only-me');
    });
  });
});
