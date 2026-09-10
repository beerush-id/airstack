import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { LinkAria, aria } from '../../src/index.js';
import { component } from '../utils.js';

describe('Link - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers construction with no props and no options', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const link = new LinkAria();
        expect(link.isNative).toBe(true);
        expect(link.disabled).toBe(false);
        expect(link.href).toBeUndefined();
        expect(link.attributes.role).toBeUndefined();
        expect(link.attributes.tabindex).toBeUndefined();
        expect(link.attributes.href).toBeUndefined();
        expect(link.attributes.target).toBeUndefined();
        expect(link.attributes['aria-disabled']).toBe('false');

        const factoryLink = aria('link');
        expect(factoryLink.isNative).toBe(true);
        expect(factoryLink.href).toBeUndefined();
        expect(factoryLink.attributes['aria-disabled']).toBe('false');
      });
    }));
});
