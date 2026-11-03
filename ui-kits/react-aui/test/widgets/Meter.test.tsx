import type { StateUnsubscribe } from '@airlib/react';
import { mutable, setup } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Meter } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Meter', () => {
  it('reports the reading in the units it was given', async () => {
    destroy = await runApp(async () => {
      render(<Meter value={45} min={10} max={90} label="Storage" />);
      const gauge = screen.getByRole('meter', { name: 'Storage' });
      expect(gauge.getAttribute('aria-valuenow')).toBe('45');
      expect(gauge.getAttribute('aria-valuemin')).toBe('10');
      expect(gauge.getAttribute('aria-valuemax')).toBe('90');
      expect(gauge.style.getPropertyValue('--aria-meter-offset')).toBe('43.75%');
      expect(gauge.querySelector('.aui-meter-fill')).toBeInstanceOf(HTMLElement);
    });
  });

  it('reports the lower bound when no reading is passed', async () => {
    destroy = await runApp(async () => {
      render(<Meter min={10} max={90} label="Storage" />);
      expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('10');
    });
  });

  it('clamps a reading past either bound', async () => {
    destroy = await runApp(async () => {
      render(<Meter value={240} max={200} label="Storage" />);
      expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('200');
      expect(screen.getByRole('meter').style.getPropertyValue('--aria-meter-offset')).toBe('100%');
    });
  });

  it('spells the reading out beside the number', async () => {
    destroy = await runApp(async () => {
      render(<Meter value={72} label="Storage" valuetext="72 GB of 100 GB" />);
      const gauge = screen.getByRole('meter');
      expect(gauge.getAttribute('aria-valuetext')).toBe('72 GB of 100 GB');
    });
  });

  it('follows a reading written by the consumer', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ reading: 20 });
      const Live = setup(() => () => <Meter value={state.reading} label="Storage" />);
      render(<Live />);
      expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('20');
      await act(async () => {
        state.reading = 80;
      });
      expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('80');
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ meter: { size: 'lg', color: 'warning' } });
      const first = render(<Meter value={30} label="Storage" />);
      expect(screen.getByRole('meter').className).toBe('aui-meter aui-meter-lg aui-meter-warning');
      first.unmount();
      render(<Meter value={30} size="xs" color="primary" label="Storage" />);
      expect(screen.getByRole('meter').className).toBe('aui-meter aui-meter-xs aui-meter-primary');
    });
  });

  it('forwards a consumer ref and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const first = render(<Meter ref={ref} value={30} label="Storage" className="my-gauge" />);
      expect(ref.current?.className).toContain('aui-meter');
      expect(ref.current?.className).toContain('my-gauge');
      first.unmount();
      configure({ overrides: true });
      render(<Meter value={30} label="Storage" className="only-me" />);
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
