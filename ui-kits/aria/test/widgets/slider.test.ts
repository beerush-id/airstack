import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SliderProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe('Slider - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Multi/Single Endpoint Value Projection Invariant', () => {
    it('gives a single value exactly one focusable slider on the track', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 30, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');

          // 1. Creation & SSR: a single endpoint makes the track the slider
          expect(slider.attributes.role).toBe('slider');
          expect(slider.attributes.tabindex).toBe(0);
          expect(thumb.attributes.role).toBeUndefined();
          expect(thumb.attributes.tabindex).toBeUndefined();

          // 2. DOM Binding
          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          expect(trackEl.getAttribute('role')).toBe('slider');
          expect(trackEl.getAttribute('tabindex')).toBe('0');
          expect(trackEl.getAttribute('aria-valuenow')).toBe('30');
          expect(trackEl.getAttribute('aria-valuemin')).toBe('0');
          expect(trackEl.getAttribute('aria-valuemax')).toBe('100');
          expect(thumbEl.hasAttribute('role')).toBe(false);
          expect(thumbEl.hasAttribute('tabindex')).toBe(false);

          // 3/5. The track follows the endpoint it owns
          props.value = 70;
          expect(trackEl.getAttribute('aria-valuenow')).toBe('70');
          expect(thumb.endpoint).toBe(70);

          slider.destroy();
          thumb.destroy();
          expect(thumb.current).toBeNull();
        });
      }));

    it('keeps a low and high thumb independent inside a grouped track', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: [20, 80], min: 0, max: 100, step: 5 });
          const slider = aria('slider', props);
          const low = aria('slider-thumb');
          const high = aria('slider-thumb');

          // 1. Creation & SSR: two endpoints make the track a group
          expect(slider.attributes.role).toBe('group');

          // 2. DOM Binding
          const trackEl = bind(document.createElement('div'), slider);
          const lowEl = bind(document.createElement('div'), low);
          const highEl = bind(document.createElement('div'), high);
          trackEl.appendChild(lowEl);
          trackEl.appendChild(highEl);

          expect(trackEl.getAttribute('role')).toBe('group');
          expect(lowEl.getAttribute('aria-valuenow')).toBe('20');
          expect(highEl.getAttribute('aria-valuenow')).toBe('80');

          // 3/4. Stepping the low thumb leaves the high thumb's announcement alone
          lowEl.focus();
          press(lowEl, 'ArrowRight');

          expect(lowEl.getAttribute('aria-valuenow')).toBe('25');
          expect(highEl.getAttribute('aria-valuenow')).toBe('80');

          // 5. The container sees the moved endpoint
          expect(props.value).toEqual([25, 80]);

          press(highEl, 'ArrowLeft');
          expect(highEl.getAttribute('aria-valuenow')).toBe('75');
          expect(lowEl.getAttribute('aria-valuenow')).toBe('25');
          expect(props.value).toEqual([25, 75]);

          slider.destroy();
          low.destroy();
          high.destroy();
        });
      }));
  });

  describe('Continuous Step & Boundary Invariant', () => {
    it('steps by the declared increment and page size across the horizontal axis', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 0, max: 100, step: 5, page: 20 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');

          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          trackEl.focus();

          expect(trackEl.getAttribute('aria-valuenow')).toBe('50');

          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(55);
          expect(trackEl.getAttribute('aria-valuenow')).toBe('55');

          press(trackEl, 'ArrowLeft');
          press(trackEl, 'ArrowLeft');
          expect(props.value).toBe(45);

          press(trackEl, 'PageUp');
          expect(props.value).toBe(65);

          press(trackEl, 'PageDown');
          expect(props.value).toBe(45);

          // Home and End go to the declared bounds, not to zero and one hundred
          press(trackEl, 'End');
          expect(props.value).toBe(100);

          press(trackEl, 'Home');
          expect(props.value).toBe(0);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('holds both bounds and claims only the keys it acts on', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 90, min: 80, max: 90, step: 5 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');

          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);
          trackEl.focus();

          // Pressing past the ceiling changes nothing and is still consumed
          for (let repeat = 0; repeat < 3; repeat += 1) {
            expect(press(trackEl, 'ArrowRight').defaultPrevented).toBe(true);
          }
          expect(props.value).toBe(90);
          expect(trackEl.getAttribute('aria-valuenow')).toBe('90');

          // Out-of-range writes are pulled inside
          props.value = 500;
          expect(slider.value).toBe(90);

          props.value = -500;
          expect(slider.value).toBe(80);

          // Keys outside the slider's table are left to the page
          for (const key of ['Tab', 'Escape', 'Enter', 'a']) {
            expect(press(trackEl, key).defaultPrevented).toBe(false);
          }
          expect(slider.value).toBe(80);

          slider.destroy();
          thumb.destroy();
        });
      }));

    it('conforms stepping to the declared vertical orientation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({
            value: 50,
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
          trackEl.focus();

          expect(trackEl.getAttribute('aria-orientation')).toBe('vertical');

          press(trackEl, 'ArrowUp');
          expect(props.value).toBe(60);

          press(trackEl, 'ArrowDown');
          expect(props.value).toBe(50);

          slider.destroy();
          thumb.destroy();
        });
      }));
  });

  describe('Host Parity & Form Boundary Invariant', () => {
    it('synchronizes a native range input without compiling a role or a form field', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps & { name?: string }>({
            value: 25,
            min: 10,
            max: 90,
            step: 5,
            name: 'volume',
          });
          const slider = aria('slider', props, { native: true });

          // 1. Creation & SSR: the native plane carries the range
          expect(slider.attributes.role).toBeUndefined();
          expect(slider.attributes.tabindex).toBeUndefined();
          expect(slider.attributes['aria-valuenow']).toBeUndefined();
          expect(slider.attributes.name).toBeUndefined();
          expect(slider.attributes.value).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('input'), slider);
          expect(el.type).toBe('range');
          expect(el.min).toBe('10');
          expect(el.max).toBe('90');
          expect(el.step).toBe('5');
          expect(el.value).toBe('25');

          // 3. Dragging the native control feeds the same state
          el.value = '60';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe(60);
          expect(slider.value).toBe(60);

          // 4. Native keys belong to the browser
          expect(press(el, 'ArrowRight').defaultPrevented).toBe(false);
          expect(slider.value).toBe(60);

          // 5. A value write reaches the element
          slider.value = 70;
          expect(el.value).toBe('70');

          slider.destroy();
          expect(slider.current).toBeNull();
        });
      }));

    it('announces readable value text, static or derived, beside the numeric claim', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({
            value: 40,
            min: 0,
            max: 100,
            valuetext: 'Forty percent',
          });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');

          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          expect(trackEl.getAttribute('aria-valuetext')).toBe('Forty percent');
          expect(trackEl.getAttribute('aria-valuenow')).toBe('40');

          // A derived label tracks each endpoint instead of freezing on one
          const dynamic = mutable<SliderProps>({
            value: 40,
            min: 0,
            max: 100,
            valuetext: (val: number) => `${val} degrees`,
          });
          const dynamicSlider = aria('slider', dynamic);
          const dynamicThumb = aria('slider-thumb');
          const dynamicTrack = bind(document.createElement('div'), dynamicSlider);
          const dynamicEl = bind(document.createElement('div'), dynamicThumb);
          dynamicTrack.appendChild(dynamicEl);

          expect(dynamicTrack.getAttribute('aria-valuetext')).toBe('40 degrees');

          dynamic.value = 55;
          expect(dynamicTrack.getAttribute('aria-valuetext')).toBe('55 degrees');
          expect(dynamicTrack.getAttribute('aria-valuenow')).toBe('55');

          slider.destroy();
          thumb.destroy();
          dynamicSlider.destroy();
          dynamicThumb.destroy();
        });
      }));

    it('stays out of the tab order and refuses operation when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SliderProps>({ value: 50, min: 0, max: 100, step: 10 });
          const slider = aria('slider', props);
          const thumb = aria('slider-thumb');

          const trackEl = bind(document.createElement('div'), slider);
          const thumbEl = bind(document.createElement('div'), thumb);
          trackEl.appendChild(thumbEl);

          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(60);

          props.disabled = true;
          expect(trackEl.getAttribute('aria-disabled')).toBe('true');
          expect(trackEl.getAttribute('tabindex')).toBe('-1');

          for (const key of ['ArrowRight', 'ArrowLeft', 'PageUp', 'Home', 'End']) {
            expect(press(trackEl, key).defaultPrevented).toBe(false);
          }
          expect(props.value).toBe(60);

          props.disabled = false;
          expect(trackEl.getAttribute('aria-disabled')).toBe('false');
          expect(trackEl.getAttribute('tabindex')).toBe('0');

          press(trackEl, 'ArrowRight');
          expect(props.value).toBe(70);

          slider.destroy();
          thumb.destroy();
        });
      }));
  });
});
