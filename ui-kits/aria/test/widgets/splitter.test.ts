import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SplitterProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe('Splitter - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Dual-Pane Dimension Partitioning Invariant', () => {
    it('always owns a tab stop and a position claim, even with nothing declared', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const splitter = aria('splitter');

          // 1. Creation & SSR: defaults are a 0-100 partition with no author input
          expect(splitter.current).toBeNull();
          expect(splitter.attributes.role).toBe('separator');
          expect(splitter.attributes.tabindex).toBe(0);
          expect(splitter.attributes['aria-valuemin']).toBe(0);
          expect(splitter.attributes['aria-valuemax']).toBe(100);

          // 2. DOM Binding
          const el = bind(document.createElement('div'), splitter);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-valuenow')).not.toBeNull();

          // Unlike a static divider, a splitter is never value-less
          expect(el.hasAttribute('aria-valuenow')).toBe(true);

          splitter.destroy();
          expect(splitter.current).toBeNull();
        });
      }));

    it('moves the partition from a parent write and from the keyboard through the same announcement', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 30, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);

          expect(el.getAttribute('aria-valuenow')).toBe('30');

          // The author resizes the pane programmatically
          props.value = 45;
          expect(splitter.value).toBe(45);
          expect(el.getAttribute('aria-valuenow')).toBe('45');

          // The keyboard reaches the same state
          el.focus();
          press(el, 'ArrowRight');
          expect(splitter.value).toBe(46);
          expect(props.value).toBe(46);
          expect(el.getAttribute('aria-valuenow')).toBe('46');

          // The setter is clamped the same way the keys are
          splitter.value = 500;
          expect(splitter.value).toBe(100);
          expect(el.getAttribute('aria-valuenow')).toBe('100');

          splitter.value = -500;
          expect(splitter.value).toBe(0);
          expect(el.getAttribute('aria-valuenow')).toBe('0');

          // 6. Teardown: a detached partition stops responding and stops writing
          splitter.destroy();
          expect(splitter.current).toBeNull();

          press(el, 'ArrowRight');
          expect(splitter.value).toBe(0);
          expect(el.getAttribute('aria-valuenow')).toBe('0');
        });
      }));
  });

  describe('Spatial Orientation Invariant', () => {
    it('advances on Right and Down and retreats on Left and Up on a horizontal axis', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          expect(el.getAttribute('aria-orientation')).toBeNull();

          press(el, 'ArrowRight');
          expect(props.value).toBe(51);

          press(el, 'ArrowDown');
          expect(props.value).toBe(52);

          press(el, 'ArrowLeft');
          expect(props.value).toBe(51);

          press(el, 'ArrowUp');
          expect(props.value).toBe(50);

          splitter.destroy();
        });
      }));

    it('keeps the same travel directions on a vertical axis', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 40, min: 0, max: 100, orientation: 'vertical' });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          expect(el.getAttribute('aria-orientation')).toBe('vertical');

          press(el, 'ArrowRight');
          expect(props.value).toBe(41);

          press(el, 'ArrowDown');
          expect(props.value).toBe(42);

          press(el, 'ArrowLeft');
          expect(props.value).toBe(41);

          press(el, 'ArrowUp');
          expect(props.value).toBe(40);

          splitter.destroy();
        });
      }));
  });

  describe('Value Boundary & Step Clamping Invariant', () => {
    it('holds at each bound without overshooting and consumes the travel keys', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 99, min: 95, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          expect(press(el, 'ArrowRight').defaultPrevented).toBe(true);
          expect(props.value).toBe(100);

          // Repeated advance at the ceiling is inert, not negative-overflowing
          for (let repeat = 0; repeat < 4; repeat += 1) {
            press(el, 'ArrowRight');
          }
          expect(splitter.value).toBe(100);
          expect(el.getAttribute('aria-valuenow')).toBe('100');

          press(el, 'ArrowLeft');
          expect(splitter.value).toBe(99);

          // Retreat to the floor and hold
          for (let repeat = 0; repeat < 10; repeat += 1) {
            press(el, 'ArrowLeft');
          }
          expect(splitter.value).toBe(95);
          expect(el.getAttribute('aria-valuenow')).toBe('95');

          splitter.destroy();
        });
      }));

    it('claims only the four travel keys it acts on', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SplitterProps>({ value: 50, min: 0, max: 100 });
          const splitter = aria('splitter', props);
          const el = bind(document.createElement('div'), splitter);
          el.focus();

          // The key table names Right/Down/Left/Up only
          for (const key of ['Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Tab', 'Escape']) {
            const type = key === ' ' ? 'keyup' : 'keydown';
            const event = new KeyboardEvent(type, { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(props.value).toBe(50);
          expect(el.getAttribute('aria-valuenow')).toBe('50');

          // Pointer travel is not a partition move either
          el.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
          expect(splitter.value).toBe(50);

          splitter.destroy();
        });
      }));
  });
});
