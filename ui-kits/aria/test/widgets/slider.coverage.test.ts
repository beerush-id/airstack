import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type SliderEvent, type SliderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

function release(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keyup', { key, cancelable: true, bubbles: true }));
}

function pointer(el: HTMLElement, type: string, init: MouseEventInit = {}): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, buttons: 1, ...init }));
}

describe('Slider - Coverage (events, drag, tightening & guards)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Attribute Shielding Contract', () => {
    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const slider = aria('slider', {
            value: 30,
            min: 0,
            max: 100,
            step: 5,
            page: 20,
            valuetext: 'thirty',
            orientation: 'vertical',
          });

          for (const key of ['value', 'min', 'max', 'step', 'page', 'valuetext', 'orientation', 'disabled']) {
            expect(slider.ownKeys).toContain(key);
          }

          slider.destroy();
          expect(slider.current).toBeNull();
        });
      }));
  });

  describe('Setup-Scope Safety Contract', () => {
    it('constructs slider and thumbs without frozen reactive reads in setup-like context', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const reads: string[] = [];
          const restore = setStaticTracker((_init, key) => {
            if (typeof key === 'symbol') return;
            reads.push(String(key));
          });
          try {
            const slider = aria('slider', { value: [20, 80] });
            const low = aria('slider-thumb');
            const high = aria('slider-thumb');
            slider.destroy();
            low.destroy();
            high.destroy();
          } finally {
            restore();
          }
          expect(reads).toEqual([]);
        });
      }));
  });

  describe('Interaction Event Contract', () => {
    it('dispatches input per step and change when the press ends', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));
          trackEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          press(trackEl, 'ArrowRight');
          press(trackEl, 'ArrowRight');
          expect(inputs).toEqual([55, 60]);
          expect(changes).toEqual([]);

          release(trackEl, 'ArrowRight');
          expect(changes).toEqual([60]);

          release(trackEl, 'Tab');
          trackEl.dispatchEvent(new FocusEvent('blur'));
          expect(changes).toEqual([60]);

          press(trackEl, 'ArrowLeft');
          trackEl.dispatchEvent(new FocusEvent('blur'));
          expect(inputs).toEqual([55, 60, 55]);
          expect(changes).toEqual([60, 55]);

          const kinds = new Set<string>();
          trackEl.addEventListener('input', (event) => kinds.add(event.constructor.name));
          press(trackEl, 'ArrowRight');
          release(trackEl, 'ArrowRight');
          expect(kinds.has('CustomEvent')).toBe(true);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('carries the tuple through dual-thumb interaction events', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          const highEl = bind(document.createElement('div'), high);
          trackEl.appendChild(lowEl);
          trackEl.appendChild(highEl);

          const details: unknown[] = [];
          lowEl.addEventListener('input', (event) => details.push((event as SliderEvent).detail));
          lowEl.addEventListener('change', (event) => details.push((event as SliderEvent).detail));

          press(lowEl, 'ArrowRight');
          release(lowEl, 'ArrowRight');
          expect(details).toEqual([
            [25, 80],
            [25, 80],
          ]);

          slider.destroy();
          low.destroy();
          high.destroy();
        });
      }));

    it('stays silent when a press commits nothing', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 100, min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          const inputs = vi.fn();
          const changes = vi.fn();
          trackEl.addEventListener('input', inputs);
          trackEl.addEventListener('change', changes);

          press(trackEl, 'ArrowRight');
          release(trackEl, 'ArrowRight');
          expect(inputs).not.toHaveBeenCalled();
          expect(changes).not.toHaveBeenCalled();

          slider.destroy();
          thumb.destroy();
        });
      }));
  });

  describe('Dual-Thumb Tightening Contract', () => {
    it('bounds each thumb against the other endpoint', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          const highEl = bind(document.createElement('div'), high);
          trackEl.appendChild(lowEl);
          trackEl.appendChild(highEl);

          expect(lowEl.getAttribute('aria-valuemin')).toBe('0');
          expect(lowEl.getAttribute('aria-valuemax')).toBe('80');
          expect(highEl.getAttribute('aria-valuemin')).toBe('20');
          expect(highEl.getAttribute('aria-valuemax')).toBe('100');

          for (let repeat = 0; repeat < 20; repeat += 1) {
            press(lowEl, 'ArrowRight');
          }
          expect(props.value).toEqual([80, 80]);
          expect(lowEl.getAttribute('aria-valuenow')).toBe('80');

          for (let repeat = 0; repeat < 20; repeat += 1) {
            press(highEl, 'ArrowLeft');
          }
          expect(props.value).toEqual([80, 80]);

          const third = aria('slider-thumb');
          const thirdEl = bind(document.createElement('div'), third);
          trackEl.appendChild(thirdEl);
          expect(thirdEl.getAttribute('aria-valuenow')).toBe('80');
          expect(thirdEl.getAttribute('aria-valuemin')).toBe('80');

          slider.destroy();
          low.destroy();
          high.destroy();
          third.destroy();
        });
      }));

    it('refuses keys while disabled and passes unhandled keys through on dual thumbs', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          const highEl = bind(document.createElement('div'), high);
          trackEl.appendChild(lowEl);
          trackEl.appendChild(highEl);

          press(lowEl, 'ArrowRight');
          expect(props.value).toEqual([25, 80]);
          expect(press(lowEl, 'Tab').defaultPrevented).toBe(false);
          expect(props.value).toEqual([25, 80]);

          props.disabled = true;
          expect(lowEl.getAttribute('tabindex')).toBe('-1');
          expect(highEl.getAttribute('tabindex')).toBe('-1');
          expect(lowEl.getAttribute('aria-disabled')).toBe('true');

          expect(press(lowEl, 'ArrowRight').defaultPrevented).toBe(false);
          expect(press(highEl, 'Home').defaultPrevented).toBe(false);
          expect(props.value).toEqual([25, 80]);

          expect(press(lowEl, 'Tab').defaultPrevented).toBe(false);
          release(lowEl, 'Tab');
          expect(props.value).toEqual([25, 80]);

          props.disabled = false;
          expect(lowEl.getAttribute('tabindex')).toBe('0');

          press(highEl, 'ArrowLeft');
          expect(props.value).toEqual([25, 75]);
          release(highEl, 'ArrowLeft');
          highEl.dispatchEvent(new FocusEvent('blur'));
          expect(props.value).toEqual([25, 75]);

          slider.destroy();
          low.destroy();
          high.destroy();
        });
      }));

    it('announces derived text and zero offsets on degenerate dual bounds', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({
            value: [20, 80],
            min: 0,
            max: 100,
            step: 5,
            valuetext: (val: number) => `${val} percent`,
          });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          const highEl = bind(document.createElement('div'), high);
          trackEl.appendChild(lowEl);
          trackEl.appendChild(highEl);

          expect(lowEl.getAttribute('aria-valuetext')).toBe('20 percent');
          expect(highEl.getAttribute('aria-valuetext')).toBe('80 percent');

          props.min = 50;
          props.max = 50;
          expect(slider.value).toEqual([50, 50]);
          expect(low.attributes.style).toEqual({ '--aria-slider-thumb-offset': '0%' });
          expect(high.attributes.style).toEqual({ '--aria-slider-thumb-offset': '0%' });

          slider.destroy();
          low.destroy();
          high.destroy();
        });
      }));

    it('reads bare coordinators at native-scale defaults', () =>
      scope.run(() => {
        component().run(() => {
          const slider = aria('slider');
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          expect(slider.isDual).toBe(false);
          expect(slider.value).toBe(0);
          expect(trackEl.getAttribute('aria-valuenow')).toBe('0');
          expect(trackEl.getAttribute('aria-valuemin')).toBe('0');
          expect(trackEl.getAttribute('aria-valuemax')).toBe('100');

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('reads crossed tuples in endpoint order', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [80, 20], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          bind(document.createElement('div'), slider);

          expect(slider.value).toEqual([20, 80]);

          slider.destroy();
        });
      }));

    it('survives long press-and-hold runs without observation growth', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 0, min: 0, max: 100, step: 1 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          const inputs: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));

          for (let repeat = 0; repeat < 150; repeat += 1) {
            press(trackEl, 'ArrowRight');
          }
          expect(props.value).toBe(100);
          expect(inputs).toHaveLength(100);
          expect(trackEl.getAttribute('aria-valuenow')).toBe('100');

          release(trackEl, 'ArrowRight');

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('keeps tuple identity stable across dual commits', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          trackEl.appendChild(lowEl);

          const ref = props.value;
          press(lowEl, 'ArrowRight');
          expect(props.value).toEqual([25, 80]);
          expect(props.value).toBe(ref);

          slider.destroy();
          low.destroy();
        });
      }));

    it('switches a single slot to a tuple on ordered writes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 40, min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          bind(document.createElement('div'), slider);

          slider.value = [10, 90];
          expect(props.value).toEqual([10, 90]);

          slider.destroy();
        });
      }));

    it('orders crossed writes instead of inverting the tuple', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          bind(document.createElement('div'), slider);

          slider.value = [30, 70];
          expect(props.value).toEqual([30, 70]);

          slider.value = [90, 10];
          expect(props.value).toEqual([10, 90]);

          slider.destroy();
        });
      }));
  });

  describe('Pointer Drag Contract', () => {
    it('tracks stepped values along a mocked horizontal track', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));
          trackEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          pointer(thumbEl, 'pointerdown', { clientX: 40 });
          expect(props.value).toBe(20);

          pointer(thumbEl, 'pointermove', { clientX: 55 });
          expect(props.value).toBe(30);
          expect(inputs).toEqual([30]);

          pointer(thumbEl, 'pointermove', { clientX: 58 });
          expect(props.value).toBe(30);
          expect(inputs).toEqual([30]);

          pointer(thumbEl, 'pointermove', { clientX: 55, buttons: 0 });
          expect(inputs).toEqual([30]);

          pointer(thumbEl, 'pointerup', { clientX: 55 });
          expect(changes).toEqual([30]);

          pointer(thumbEl, 'pointerdown', { clientX: 150 });
          pointer(thumbEl, 'pointermove', { clientX: 160 });
          pointer(thumbEl, 'pointercancel');
          expect(props.value).toBe(80);
          expect(changes).toEqual([30]);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('keeps tracking after the pointer leaves the thumb', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const changes: unknown[] = [];
          thumbEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          pointer(thumbEl, 'pointerdown', { clientX: 40 });
          pointer(trackEl, 'pointermove', { clientX: 150 });
          expect(props.value).toBe(80);

          pointer(trackEl, 'pointerup', { clientX: 150 });
          expect(changes).toEqual([80]);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('drops the drag session when the thumb unmounts mid-drag', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);

          pointer(thumbEl, 'pointerdown', { clientX: 40 });
          thumb.destroy();
          pointer(trackEl, 'pointermove', { clientX: 150 });
          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
        });
      }));

    it('tracks vertical drags from the bottom edge', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({
            value: 20,
            min: 0,
            max: 100,
            step: 10,
            orientation: 'vertical',
          });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 20,
            top: 0,
            bottom: 200,
            width: 20,
            height: 200,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          pointer(thumbEl, 'pointerdown', { clientY: 160 });
          pointer(thumbEl, 'pointermove', { clientY: 50 });
          expect(props.value).toBe(80);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('ignores drags while disabled or off-button', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10, disabled: true });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);

          pointer(thumbEl, 'pointerdown', { clientX: 150 });
          pointer(thumbEl, 'pointermove', { clientX: 150 });
          pointer(thumbEl, 'pointerup', { clientX: 150 });
          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));
  });

  describe('Position Publication Contract', () => {
    it('exposes the endpoint ratio as an offset getter for script usage', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          expect(thumb.offset).toBe(20);

          props.value = 55;
          expect(thumb.offset).toBe(55);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('parks the offset at zero with no coordinator or no span', () =>
      scope.run(() => {
        component().run(() => {
          const lone = aria('slider-thumb');
          expect(lone.offset).toBe(0);
          lone.destroy();
        });

        component().run(() => {
          const flatSlider = aria('slider', { value: 5, min: 5, max: 5 });
          const flatThumb = aria('slider-thumb');
          expect(flatThumb.offset).toBe(0);
          flatSlider.destroy();
          flatThumb.destroy();
        });
      }));

    it('publishes the committed endpoint as a CSS offset variable', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '20%' });
          expect(thumbEl.style.getPropertyValue('--aria-slider-thumb-offset')).toBe('20%');

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('mirrors the announced value position', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 27, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          expect(trackEl.getAttribute('aria-valuenow')).toBe('27');
          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '27%' });

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('publishes each dual endpoint independently', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');
          bind(document.createElement('div'), low);
          bind(document.createElement('div'), high);

          expect(low.attributes.style).toEqual({ '--aria-slider-thumb-offset': '20%' });
          expect(high.attributes.style).toEqual({ '--aria-slider-thumb-offset': '80%' });

          slider.destroy();
          low.destroy();
          high.destroy();
        });
      }));

    it('clamps the published offset to the bounds', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 150, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          bind(document.createElement('div'), thumb);

          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '100%' });

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('republishes the offset after keyboard commits', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          press(trackEl, 'ArrowRight');
          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '30%' });

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('publishes the same offset regardless of orientation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 40, min: 0, max: 100, step: 10, orientation: 'vertical' });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          bind(document.createElement('div'), thumb);

          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '40%' });

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('publishes zero on degenerate bounds', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 50, max: 50, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          bind(document.createElement('div'), thumb);

          expect(thumb.attributes.style).toEqual({ '--aria-slider-thumb-offset': '0%' });

          slider.destroy();
          thumb.destroy();
        });
      }));
  });

  describe('Track Press Contract', () => {
    it('jumps to the pressed ratio without any thumb', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const trackEl = bind(document.createElement('div'), slider);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const seen: Array<{ type: string; target: EventTarget | null; detail: unknown }> = [];
          trackEl.addEventListener('input', (event) =>
            seen.push({ type: 'input', target: event.target, detail: (event as SliderEvent).detail })
          );
          trackEl.addEventListener('change', (event) =>
            seen.push({ type: 'change', target: event.target, detail: (event as SliderEvent).detail })
          );

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          expect(props.value).toBe(70);

          pointer(trackEl, 'pointerup', { clientX: 140 });
          expect(seen).toEqual([
            { type: 'input', target: trackEl, detail: 70 },
            { type: 'change', target: trackEl, detail: 70 },
          ]);

          trackEl.remove();
          slider.destroy();
        });
      }));

    it('continues dragging after a track press', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          const rect = vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));
          trackEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          expect(props.value).toBe(70);
          pointer(trackEl, 'pointermove', { clientX: 140 });
          expect(inputs).toEqual([70]);
          pointer(trackEl, 'pointermove', { clientX: 180, buttons: 0 });
          expect(props.value).toBe(70);
          rect.mockReturnValue({
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => {},
          });
          pointer(trackEl, 'pointermove', { clientX: 180 });
          expect(props.value).toBe(70);
          rect.mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });
          pointer(trackEl, 'pointermove', { clientX: 180 });
          pointer(trackEl, 'pointerup', { clientX: 180 });
          expect(props.value).toBe(90);
          expect(inputs).toEqual([70, 90]);
          expect(changes).toEqual([90]);

          pointer(trackEl, 'pointerdown', { clientX: 100 });
          pointer(trackEl, 'pointercancel');
          pointer(trackEl, 'pointermove', { clientX: 180 });
          pointer(trackEl, 'pointerup', { clientX: 180 });
          expect(props.value).toBe(50);
          expect(inputs).toEqual([70, 90, 50]);
          expect(changes).toEqual([90]);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('jumps the nearer dual endpoint by value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const trackEl = bind(document.createElement('div'), slider);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          pointer(trackEl, 'pointerdown', { clientX: 170 });
          expect(props.value).toEqual([20, 85]);
          pointer(trackEl, 'pointerup', { clientX: 170 });

          trackEl.remove();
          slider.destroy();
        });
      }));

    it('jumps the low endpoint on near-low presses and ties', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const trackEl = bind(document.createElement('div'), slider);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          pointer(trackEl, 'pointerdown', { clientX: 60 });
          expect(props.value).toEqual([30, 80]);
          pointer(trackEl, 'pointerup', { clientX: 60 });

          pointer(trackEl, 'pointerdown', { clientX: 100 });
          expect(props.value).toEqual([50, 80]);
          pointer(trackEl, 'pointerup', { clientX: 100 });

          trackEl.remove();
          slider.destroy();
        });
      }));

    it('ignores presses starting on a thumb', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const inputs: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));

          pointer(thumbEl, 'pointerdown', { clientX: 40 });
          pointer(thumbEl, 'pointerup', { clientX: 40 });
          expect(props.value).toBe(20);
          expect(inputs).toEqual([]);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('ignores track presses while disabled or prevented', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10, disabled: true });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          pointer(trackEl, 'pointerup', { clientX: 140 });
          expect(props.value).toBe(20);

          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('ignores track presses with a prevented default', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });
          trackEl.addEventListener('pointerdown', (event) => event.preventDefault(), { capture: true });

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('withholds jumps on zero-size geometry', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          pointer(trackEl, 'pointerup', { clientX: 140 });
          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('stays silent pressing the current position', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          trackEl.addEventListener('input', (event) => inputs.push((event as SliderEvent).detail));
          trackEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          pointer(trackEl, 'pointerdown', { clientX: 40 });
          expect(props.value).toBe(20);
          pointer(trackEl, 'pointerup', { clientX: 40 });
          expect(inputs).toEqual([]);
          expect(changes).toEqual([]);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('ends the track session when the track unmounts mid-press', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const trackEl = bind(document.createElement('div'), slider);
          document.body.appendChild(trackEl);
          vi.spyOn(trackEl, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 200,
            top: 0,
            bottom: 20,
            width: 200,
            height: 20,
            x: 0,
            y: 0,
            toJSON: () => {},
          });

          const changes: unknown[] = [];
          trackEl.addEventListener('change', (event) => changes.push((event as SliderEvent).detail));

          pointer(trackEl, 'pointerdown', { clientX: 140 });
          expect(props.value).toBe(70);
          slider.ref(null);
          pointer(trackEl, 'pointermove', { clientX: 180 });
          pointer(trackEl, 'pointerup', { clientX: 180 });
          expect(props.value).toBe(70);
          expect(changes).toEqual([]);

          trackEl.remove();
          slider.destroy();
        });
      }));
  });

  describe('Defaults & Degenerate Input Contract', () => {
    it('falls back to native-scale bounds and unit steps', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 30 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          expect(trackEl.getAttribute('aria-valuemin')).toBe('0');
          expect(trackEl.getAttribute('aria-valuemax')).toBe('100');
          expect(trackEl.getAttribute('aria-orientation')).toBe('horizontal');

          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(31);

          press(trackEl, 'PageUp');
          expect(props.value).toBe(41);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('treats a non-positive step as a unit step', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 30, min: 0, max: 100, step: 0 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(31);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('snaps fractional steps without floating-point drift', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 0, min: 0, max: 1, step: 0.1 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          const trackEl = bind(document.createElement('div'), slider);
          trackEl.appendChild(thumbEl);

          press(trackEl, 'ArrowRight');
          press(trackEl, 'ArrowRight');
          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(0.3);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('renders an inert thumb with no coordinator', () =>
      scope.run(() => {
        component().run(() => {
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);

          expect(thumbEl.getAttribute('role')).toBe('slider');
          expect(thumbEl.getAttribute('tabindex')).toBe('0');
          expect(thumbEl.hasAttribute('aria-valuenow')).toBe(false);

          press(thumbEl, 'ArrowRight');
          expect(thumb.endpoint).toBeUndefined();

          thumb.destroy();
        });
      }));

    it('withholds drag resolution without a bound track', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const thumbEl = bind(document.createElement('div'), thumb);
          document.body.appendChild(thumbEl);

          pointer(thumbEl, 'pointerdown', { clientX: 150 });
          pointer(thumbEl, 'pointermove', { clientX: 150 });
          expect(props.value).toBe(20);

          thumbEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('resolves no ratio on a zero-size track', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 20, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          document.body.appendChild(trackEl);

          pointer(thumbEl, 'pointerdown', { clientX: 150 });
          pointer(thumbEl, 'pointermove', { clientX: 150 });
          expect(props.value).toBe(20);

          trackEl.remove();
          slider.destroy();
          thumb.destroy();
        });
      }));

    it('projects the low endpoint on a native dual binding', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props, { native: true });
          const el = bind(document.createElement('input'), slider);

          expect(el.value).toBe('20');

          slider.destroy();
        });
      }));

    it('withholds native sync while disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 0, max: 100, step: 5, disabled: true });
          const slider = aria('slider', props, { native: true });
          const el = bind(document.createElement('input'), slider);

          expect(el.disabled).toBe(true);

          el.value = '70';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(50);

          slider.destroy();
        });
      }));

    it('coerces native text to the lower bound', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 10, max: 90, step: 5 });
          const slider = aria('slider', props, { native: true });
          const el = bind(document.createElement('input'), slider);

          el.value = '0';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(10);

          slider.destroy();
        });
      }));
  });
});
