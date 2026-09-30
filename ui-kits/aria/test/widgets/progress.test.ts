import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ProgressProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Progress - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Progress Range & Progression Projection Invariant', () => {
    it('maps a native progress interval to zero-based units and clamps before mapping', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({ value: 30, min: 20, max: 60, label: 'Upload' });
          const bar = aria('progress', props);

          // 1. Creation & SSR: the ARIA view keeps the author's units
          expect(bar.current).toBeNull();
          expect(bar.value).toBe(30);

          // 2. DOM Binding: the native element is expressed from zero, and has no min to carry
          const el = bind(document.createElement('progress'), bar);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.hasAttribute('min')).toBe(false);
          expect(el.max).toBe(40);
          expect(el.value).toBe(10);

          // 3/5. Progression follows the same offset
          props.value = 50;
          expect(el.value).toBe(30);
          expect(el.max).toBe(40);

          // Out-of-range readings are clamped first, then mapped
          props.value = 500;
          expect(bar.value).toBe(60);
          expect(el.value).toBe(40);

          props.value = -500;
          expect(bar.value).toBe(20);
          expect(el.value).toBe(0);

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));

    it('compiles the author interval as ARIA on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({
            value: 30,
            min: 20,
            max: 60,
            label: 'Upload',
            valuetext: '30 of 60 megabytes',
          });
          const bar = aria<HTMLDivElement>('progress', props, { native: false });

          // 1. Creation & SSR: no remapping, no native scale keys
          expect(bar.attributes.role).toBe('progressbar');
          expect(bar.attributes['aria-valuemin']).toBe(20);
          expect(bar.attributes['aria-valuemax']).toBe(60);
          expect(bar.attributes['aria-valuenow']).toBe(30);
          expect(bar.attributes['aria-label']).toBe('Upload');
          expect(bar.attributes['aria-valuetext']).toBe('30 of 60 megabytes');
          expect(bar.attributes.min).toBeUndefined();
          expect(bar.attributes.max).toBeUndefined();
          expect(bar.attributes.value).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), bar);
          expect(el.getAttribute('aria-valuemin')).toBe('20');
          expect(el.getAttribute('aria-valuenow')).toBe('30');

          // 3/5. Progression re-announces in the original units
          props.value = 45;
          expect(el.getAttribute('aria-valuenow')).toBe('45');
          expect(el.getAttribute('aria-valuetext')).toBe('30 of 60 megabytes');

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Indeterminate State Invariant', () => {
    it('withholds the position from a native host while the mapped scale stays declared', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({ value: 30, min: 20, max: 60, label: 'Upload' });
          const bar = aria('progress', props);
          const el = bind(document.createElement('progress'), bar);

          expect(el.hasAttribute('value')).toBe(true);

          props.value = null;
          expect(el.hasAttribute('value')).toBe(false);
          expect(el.max).toBe(40);

          props.value = 25;
          expect(el.value).toBe(5);

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));

    it('omits the value attributes on a custom host and restores them with a position', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ProgressProps>({ value: null, min: 0, max: 100, label: 'Sync' });
          const bar = aria<HTMLDivElement>('progress', props, { native: false });

          // 1. Creation & SSR: the range is known, the position is not
          expect(bar.attributes['aria-valuenow']).toBeUndefined();
          expect(bar.attributes['aria-valuemin']).toBe(0);
          expect(bar.attributes['aria-valuemax']).toBe(100);
          expect(bar.attributes['aria-valuetext']).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), bar);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);

          // 3/5. A measurable task supplies the position
          props.value = 8;
          expect(el.getAttribute('aria-valuenow')).toBe('8');

          props.value = null;
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.getAttribute('aria-valuemax')).toBe('100');

          bar.destroy();
          expect(bar.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Semantic Invariant', () => {
    it('names the indicator through ARIA on the custom host while the native host stays bare', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const range = { value: 40, min: 0, max: 80, label: 'Storage' };

          const nativeBar = aria<HTMLProgressElement>('progress', range);
          const customBar = aria<HTMLDivElement>('progress', range, { native: false });

          const progressEl = bind(document.createElement('progress'), nativeBar);
          const divEl = bind(document.createElement('div'), customBar);

          expect(nativeBar.value).toBe(40);
          expect(customBar.value).toBe(40);

          // The native element carries the range in its own attributes and no ARIA mirror
          expect(progressEl.hasAttribute('role')).toBe(false);
          expect(progressEl.max).toBe(80);
          expect(progressEl.value).toBe(40);
          expect(progressEl.hasAttribute('aria-valuenow')).toBe(false);

          // The custom host is pure ARIA
          expect(divEl.getAttribute('role')).toBe('progressbar');
          expect(divEl.getAttribute('aria-label')).toBe('Storage');
          expect(divEl.getAttribute('aria-valuemax')).toBe('80');
          expect(customBar.attributes.max).toBeUndefined();

          nativeBar.destroy();
          customBar.destroy();
        });
      }));

    it('owns no focus and claims no interaction on either host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBar = aria<HTMLProgressElement>('progress', {
            value: 10,
            min: 0,
            max: 100,
            label: 'Cache',
          });
          const customBar = aria<HTMLDivElement>(
            'progress',
            { value: 10, min: 0, max: 100, label: 'Cache' },
            { native: false },
          );

          const progressEl = bind(document.createElement('progress'), nativeBar);
          const divEl = bind(document.createElement('div'), customBar);

          expect(nativeBar.attributes.tabindex).toBeUndefined();
          expect(customBar.attributes.tabindex).toBeUndefined();

          for (const el of [progressEl, divEl]) {
            expect(el.hasAttribute('tabindex')).toBe(false);

            for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']) {
              const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
              el.dispatchEvent(event);
              expect(event.defaultPrevented).toBe(false);
            }

            const click = new MouseEvent('click', { cancelable: true, bubbles: true });
            el.dispatchEvent(click);
            expect(click.defaultPrevented).toBe(false);
          }

          expect(nativeBar.value).toBe(10);
          expect(customBar.value).toBe(10);

          nativeBar.destroy();
          customBar.destroy();
          expect(nativeBar.current).toBeNull();
          expect(customBar.current).toBeNull();
        });
      }));
  });
});
