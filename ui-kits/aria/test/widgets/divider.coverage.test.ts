import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Splitter - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers a movable splitter mounted without an explicit partition', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        // With no value, the partition opens at the declared minimum
        const scoped = aria('splitter', { min: 25, max: 80 });
        expect(scoped.value).toBe(25);
        expect(scoped.attributes['aria-valuenow']).toBe(25);

        const scopedEl = bind(document.createElement('div'), scoped);
        expect(scopedEl.getAttribute('aria-valuenow')).toBe('25');

        // With no range either, the partition opens at the default minimum
        const unscoped = aria('splitter');
        expect(unscoped.value).toBe(0);
        expect(unscoped.min).toBe(0);
        expect(unscoped.max).toBe(100);
        expect(unscoped.attributes['aria-valuenow']).toBe(0);
      });
    }));

  it('leaves non-arrow keys unclaimed on a movable splitter', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const splitter = aria('splitter', { value: 50 });
        const el = bind(document.createElement('div'), splitter);

        for (const key of ['Tab', 'Enter', ' ', 'Home', 'End']) {
          const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
          el.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
        }

        expect(splitter.value).toBe(50);
        expect(el.getAttribute('aria-valuenow')).toBe('50');
      });
    }));
});
