import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aria, type SliderEvent, type SliderProps } from '../../src/index.js';
import { component } from '../utils.js';

function press(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true }));
}

describe('Slider - Consumer Event Contract', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('calls the consumer input handler once per stepped commit with the new value', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const props = mutable<SliderProps>({ value: 30, min: 0, max: 100, step: 10, oninput });
        const slider = aria('slider', props);
        const track = document.createElement('div');

        Object.assign(track, slider.props);
        slider.ref(track);

        press(track, 'ArrowRight');

        expect(oninput).toHaveBeenCalledTimes(1);
        expect((oninput.mock.calls[0][0] as CustomEvent<number>).detail).toBe(40);
        expect(track.oninput).toBeNull();

        slider.destroy();
      });
    }));

  it('keeps browser-generated input events away from the consumer handler', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const oninput = vi.fn();
        const props = mutable<SliderProps>({ value: 30, min: 0, max: 100, step: 10, oninput });
        const slider = aria('slider', props);
        const track = document.createElement('div');

        Object.assign(track, slider.props);
        slider.ref(track);

        track.dispatchEvent(new Event('input'));

        expect(oninput).not.toHaveBeenCalled();
        expect(track.oninput).toBeNull();

        slider.destroy();
      });
    }));

  it('types the committed payload for consumers without a cast', () => {
    const props: SliderProps = {
      oninput: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number | [number, number]>();
      },
      onchange: (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<number | [number, number]>();
      },
    };

    void props;

    expectTypeOf<SliderEvent>().toEqualTypeOf<CustomEvent<number | [number, number]>>();
  });
});
