import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { ProgressbarAria, aria } from '../../src/index.js';
import { component } from '../utils.js';

describe('Progressbar - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers construction with no props and no options', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const bar = new ProgressbarAria();
        expect(bar.isNative).toBe(false);
        expect(bar.indeterminate).toBe(true);
        expect(bar.value).toBeNull();
        expect(bar.min).toBe(0);
        expect(bar.max).toBe(100);
        expect(bar.attributes.role).toBe('progressbar');
        expect(bar.attributes.tabindex).toBeUndefined();
        expect(bar.attributes['aria-valuenow']).toBeUndefined();
        expect(bar.attributes['aria-valuemin']).toBe(0);
        expect(bar.attributes['aria-valuemax']).toBe(100);
        expect(bar.attributes['aria-valuetext']).toBeUndefined();

        const factoryBar = aria('progressbar');
        expect(factoryBar.indeterminate).toBe(true);
        expect(factoryBar.attributes.role).toBe('progressbar');
      });
    }));

  it('covers value assignment driving the indeterminate -> determinate transition', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const bar = aria('progressbar');

        bar.value = 45;
        expect(bar.indeterminate).toBe(false);
        expect(bar.value).toBe(45);
        expect(bar.attributes['aria-valuenow']).toBe(45);

        bar.value = null;
        expect(bar.indeterminate).toBe(true);
        expect(bar.attributes['aria-valuenow']).toBeUndefined();
      });
    }));
});
