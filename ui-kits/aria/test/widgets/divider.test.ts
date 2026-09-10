import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SplitterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Divider - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Static Divider Contract', () => {
    it('renders a native <hr> divider with no redundant role, tab stop, or value claim', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');

          // 1. SSR Phase: <hr> carries the separator role implicitly
          expect(divider.current).toBeNull();
          expect(divider.attributes.role).toBeUndefined();
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-valuenow']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('hr'), divider);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));

    it('declares role="separator" on custom dividers while keeping them unfocusable and value-less', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria<HTMLDivElement>('divider', {}, { native: false });

          // 1. SSR Phase
          expect(divider.attributes.role).toBe('separator');
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-valuemin']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('div'), divider);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.hasAttribute('tabindex')).toBe(false);
        });
      }));

    it('leaves arrow keys to the browser on static dividers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');
          const el = bind(document.createElement('hr'), divider);

          const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          el.dispatchEvent(arrow);

          expect(arrow.defaultPrevented).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));
  });

  describe('Orientation Contract', () => {
    it('announces aria-orientation only when the divider departs from the horizontal default', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const horizontal = aria('divider', { orientation: 'horizontal' });
          const vertical = aria('divider', { orientation: 'vertical' });

          // 1. SSR Phase: horizontal is the default and stays unannounced
          expect(horizontal.orientation).toBe('horizontal');
          expect(horizontal.attributes['aria-orientation']).toBeUndefined();
          expect(vertical.attributes['aria-orientation']).toBe('vertical');

          // 2. Mount Phase
          const horizontalEl = bind(document.createElement('hr'), horizontal);
          const verticalEl = bind(document.createElement('hr'), vertical);
          expect(horizontalEl.hasAttribute('aria-orientation')).toBe(false);
          expect(verticalEl.getAttribute('aria-orientation')).toBe('vertical');
        });
      }));
  });

  describe('Movable Splitter Contract', () => {
    it('becomes a focusable range widget announcing its partition across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 30, min: 0, max: 100 });
          const splitter = aria('splitter', props);

          // 1. SSR Phase
          expect(splitter.attributes.role).toBe('separator');
          expect(splitter.attributes.tabindex).toBe(0);
          expect(splitter.attributes['aria-valuenow']).toBe(30);
          expect(splitter.attributes['aria-valuemin']).toBe(0);
          expect(splitter.attributes['aria-valuemax']).toBe(100);

          // 2. Mount Phase
          const el = bind(document.createElement('div'), splitter);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-valuenow')).toBe('30');

          // 3. Interaction Phase: arrows move the partition and the announcement follows
          const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true });
          el.dispatchEvent(right);
          expect(right.defaultPrevented).toBe(true);
          expect(splitter.value).toBe(31);
          expect(el.getAttribute('aria-valuenow')).toBe('31');

          // Down advances and Up retreats on any axis
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(32);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(31);
          expect(el.getAttribute('aria-valuenow')).toBe('31');

          // Parent repositions the partition directly
          props.value = 70;
          expect(el.getAttribute('aria-valuenow')).toBe('70');
        });
      }));

    it('holds the partition at the range boundaries when arrows or assignments overshoot', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { value: 100, min: 20, max: 100 });
          const el = bind(document.createElement('div'), splitter);

          // 1. Already at the upper boundary: advancing changes nothing
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(100);
          expect(el.getAttribute('aria-valuenow')).toBe('100');

          // 2. Out-of-range assignment is pulled back into range
          splitter.value = 250;
          expect(splitter.value).toBe(100);

          splitter.value = -250;
          expect(splitter.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');

          // 3. At the lower boundary: retreating changes nothing
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(20);
          expect(el.getAttribute('aria-valuenow')).toBe('20');
        });
      }));

    it('announces a vertical splitter axis alongside its partition', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { orientation: 'vertical', value: 40 });
          const el = bind(document.createElement('div'), splitter);

          expect(el.getAttribute('aria-orientation')).toBe('vertical');
          expect(el.getAttribute('aria-valuenow')).toBe('40');

          // Right and Left still advance and retreat a vertical partition
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(41);

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(40);
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('stops moving a detached splitter after destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter', { value: 30 });
          const el = bind(document.createElement('div'), splitter);

          expect(splitter.current).toBe(el);

          splitter.destroy();
          expect(splitter.current).toBeNull();

          splitter.value = 80;
          expect(el.getAttribute('aria-valuenow')).toBe('30');
        });
      }));
  });
});
