import type { StateUnsubscribe } from '@airlib/react';
import { mutable, setup } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Progress } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Progress', () => {
  it('reports position inside the declared interval', async () => {
    destroy = await runApp(async () => {
      render(<Progress value={40} label="Upload" />);
      const bar = screen.getByRole('progressbar', { name: 'Upload' });
      expect(bar.getAttribute('aria-valuenow')).toBe('40');
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
      expect(bar.querySelector('.aui-progress-fill')).toBeInstanceOf(HTMLElement);
      expect(bar.hasAttribute('tabindex')).toBe(false);
    });
  });

  it('clamps the reading without rewriting the prop', async () => {
    destroy = await runApp(async () => {
      render(<Progress value={140} label="Upload" />);
      const bar = screen.getByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('100');
      expect(bar.style.getPropertyValue('--aria-progress-offset')).toBe('100%');
    });
  });

  it('reports no position while the task is unmeasurable', async () => {
    destroy = await runApp(async () => {
      render(<Progress value={null} label="Scanning" />);
      const bar = screen.getByRole('progressbar');
      expect(bar.hasAttribute('aria-valuenow')).toBe(false);
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });
  });

  it('maps a declared interval onto the published fraction', async () => {
    destroy = await runApp(async () => {
      render(<Progress value={45} min={20} max={60} label="Quota" />);
      const bar = screen.getByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('45');
      expect(bar.getAttribute('aria-valuemin')).toBe('20');
      expect(bar.getAttribute('aria-valuemax')).toBe('60');
      expect(bar.style.getPropertyValue('--aria-progress-offset')).toBe('62.5%');
    });
  });

  it('follows a bound value from the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ progress: 10 });
      const Live = setup(() => () => <Progress value={state.progress} label="Upload" />);
      render(<Live />);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('10');
      await act(async () => {
        state.progress = 70;
      });
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('70');
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ progress: { size: 'sm', color: 'error' } });
      const first = render(<Progress value={20} label="Upload" />);
      expect(screen.getByRole('progressbar').className).toBe('aui-progress aui-progress-sm aui-progress-error');
      first.unmount();
      render(<Progress value={20} size="xl" color="success" label="Upload" />);
      expect(screen.getByRole('progressbar').className).toBe('aui-progress aui-progress-xl aui-progress-success');
    });
  });

  it('forwards a consumer ref and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const first = render(<Progress ref={ref} value={30} label="Upload" className="my-track" />);
      expect(ref.current?.className).toContain('aui-progress');
      expect(ref.current?.className).toContain('my-track');
      first.unmount();
      configure({ overrides: true });
      render(<Progress value={30} label="Upload" className="only-me" />);
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
