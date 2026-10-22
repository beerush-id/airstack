import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Slider, SliderThumb } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Slider', () => {
  it('steps the single value with arrow keys and binds it back', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ volume: 30 });
      render(
        <Slider value={$bind(state, 'volume')} min={0} max={100} step={5}>
          <SliderThumb />
        </Slider>
      );
      const track = screen.getByRole('slider');
      await act(async () => {
        track.focus();
        await userEvent.keyboard('{ArrowRight}');
      });
      expect(state.volume).toBe(35);
      expect(track.getAttribute('aria-valuenow')).toBe('35');
    });
  });

  it('moves a range endpoint without crossing its sibling', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ range: [20, 80] as [number, number] });
      render(
        <Slider value={$bind(state, 'range')} min={0} max={100} step={5}>
          <SliderThumb />
          <SliderThumb />
        </Slider>
      );
      const thumbs = screen.getAllByRole('slider');
      expect(thumbs).toHaveLength(2);
      await act(async () => {
        thumbs[0].focus();
        await userEvent.keyboard('{ArrowRight}');
      });
      expect(state.range).toEqual([25, 80]);
    });
  });

  it('stays inert while disabled', async () => {
    destroy = await runApp(async () => {
      let changes = 0;
      const state = mutable({ volume: 30 });
      render(
        <Slider value={$bind(state, 'volume')} disabled onchange={() => (changes += 1)}>
          <SliderThumb />
        </Slider>
      );
      await act(async () => {
        screen.getByRole('slider', { hidden: true }).focus();
        await userEvent.keyboard('{ArrowRight}');
      });
      expect(state.volume).toBe(30);
      expect(changes).toBe(0);
    });
  });

  it('forwards events and consumer ref from the track', async () => {
    destroy = await runApp(async () => {
      let inputs = 0;
      const ref = React.createRef<HTMLDivElement>();
      const state = mutable({ volume: 30 });
      render(
        <Slider ref={ref} value={$bind(state, 'volume')} oninput={() => (inputs += 1)}>
          <SliderThumb />
        </Slider>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('slider');
      await act(async () => {
        screen.getByRole('slider').focus();
        await userEvent.keyboard('{ArrowRight}');
      });
      expect(inputs).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ slider: { size: 'sm', color: 'error' } });
      const { unmount } = render(
        <Slider value={30}>
          <SliderThumb />
        </Slider>
      );
      expect(screen.getByRole('slider').className).toBe(
        'aui-slider aui-slider-sm aui-slider-error'
      );
      unmount();
      render(
        <Slider value={30} size="lg" color="info">
          <SliderThumb />
        </Slider>
      );
      expect(screen.getByRole('slider').className).toBe(
        'aui-slider aui-slider-lg aui-slider-info'
      );
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Slider value={30} className="my-slider">
          <SliderThumb />
        </Slider>
      );
      const track = screen.getByRole('slider');
      expect(track.className).toContain('my-slider');
      expect(track.className).toContain('aui-slider');
      unmount();
      configure({ overrides: true });
      render(
        <Slider value={30} className="only-me">
          <SliderThumb />
        </Slider>
      );
      expect(screen.getByRole('slider').className).toBe('only-me');
    });
  });
});
