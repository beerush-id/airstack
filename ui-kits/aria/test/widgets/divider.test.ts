import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DividerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Divider - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Static Divider Contract', () => {
    it('compiles separator role with no tab stop or value claim', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');

          expect(divider.current).toBeNull();
          expect(divider.attributes.role).toBe('separator');
          expect(divider.attributes.tabindex).toBeUndefined();
          expect(divider.attributes['aria-valuenow']).toBeUndefined();

          const el = bind(document.createElement('div'), divider);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
        });
      }));

    it('leaves arrow keys to the browser on static dividers', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');
          const el = bind(document.createElement('div'), divider);

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

          expect(horizontal.orientation).toBe('horizontal');
          expect(horizontal.attributes['aria-orientation']).toBeUndefined();
          expect(vertical.attributes['aria-orientation']).toBe('vertical');

          const horizontalEl = bind(document.createElement('div'), horizontal);
          const verticalEl = bind(document.createElement('div'), vertical);
          expect(horizontalEl.hasAttribute('aria-orientation')).toBe(false);
          expect(verticalEl.getAttribute('aria-orientation')).toBe('vertical');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('releases the element binding on destroy', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');
          const el = bind(document.createElement('div'), divider);

          expect(divider.current).toBe(el);

          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));

    it('re-establishes identical presentation when the same controller reattaches', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');
          const el = bind(document.createElement('div'), divider);

          expect(divider.current).toBe(el);
          expect(el.getAttribute('role')).toBe('separator');

          divider.ref(null);
          expect(divider.current).toBeNull();

          const replacement = document.createElement('div');
          divider.ref(replacement);
          expect(divider.current).toBe(replacement);
          expect(replacement.getAttribute('role')).toBe('separator');
          expect(replacement.hasAttribute('tabindex')).toBe(false);

          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));
  });

  describe('Structural Demarcation & Semantic Role Invariant', () => {
    it('holds a divider as a value-less, focus-less boundary across its full lifecycle', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider');

          expect(divider.current).toBeNull();
          expect(divider.attributes.role).toBe('separator');
          expect(Object.keys(divider.attributes).filter((key) => key.startsWith('on'))).toEqual([]);
          expect(Object.keys(divider.attributes).filter((key) => key.startsWith('aria-value'))).toEqual([]);

          const el = bind(document.createElement('div'), divider);
          expect(divider.current).toBe(el);
          expect(el.getAttribute('role')).toBe('separator');
          expect(el.hasAttribute('tabindex')).toBe(false);

          const stimuli: Event[] = [
            new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }),
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          ];

          for (const event of stimuli) {
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          el.click();

          expect(el.hasAttribute('tabindex')).toBe(false);
          expect(el.hasAttribute('aria-valuenow')).toBe(false);
          expect(el.getAttribute('role')).toBe('separator');

          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));
  });

  describe('Spatial Orientation Invariant', () => {
    it('adds the axis on departure from horizontal and removes it on return', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const divider = aria('divider', { orientation: 'horizontal' });

          expect(divider.orientation).toBe('horizontal');
          expect(divider.attributes['aria-orientation']).toBeUndefined();

          const el = bind(document.createElement('div'), divider);
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          divider.assign({ orientation: 'vertical' });
          expect(divider.orientation).toBe('vertical');
          expect(divider.attributes['aria-orientation']).toBe('vertical');
          expect(el.getAttribute('aria-orientation')).toBe('vertical');

          divider.assign({ orientation: 'horizontal' });
          expect(divider.attributes['aria-orientation']).toBeUndefined();
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          divider.assign({ orientation: 'vertical' });
          const arrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true });
          el.dispatchEvent(arrow);
          expect(arrow.defaultPrevented).toBe(false);
          expect(el.hasAttribute('tabindex')).toBe(false);

          divider.destroy();
          expect(divider.current).toBeNull();
        });
      }));

    it('tracks an externally owned orientation source through mount and withdrawal', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<DividerProps>({ orientation: 'horizontal' });
          const divider = aria('divider', props);

          const el = bind(document.createElement('div'), divider);
          expect(divider.current).toBe(el);
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          props.orientation = 'vertical';
          expect(divider.orientation).toBe('vertical');
          expect(el.getAttribute('aria-orientation')).toBe('vertical');
          expect(el.getAttribute('role')).toBe('separator');

          props.orientation = undefined;
          expect(divider.attributes['aria-orientation']).toBeUndefined();
          expect(el.hasAttribute('aria-orientation')).toBe(false);

          divider.destroy();
          props.orientation = 'vertical';
          expect(el.hasAttribute('aria-orientation')).toBe(false);
        });
      }));
  });
});
