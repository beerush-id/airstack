import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Switch - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers checked and disabled property getters and setters', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const sw = aria('switch');
        expect(sw.checked).toBe(false);

        sw.checked = true;
        expect(sw.checked).toBe(true);

        sw.checked = false;
        expect(sw.checked).toBe(false);

        expect(sw.disabled).toBe(false);
        sw.props.disabled = true;
        expect(sw.disabled).toBe(true);
        sw.props.disabled = false;
        expect(sw.disabled).toBe(false);
      });
    }));

  it('toggles checked state via toggle() method directly', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const sw = aria('switch', { checked: false });
        expect(sw.checked).toBe(false);

        sw.toggle();
        expect(sw.checked).toBe(true);

        sw.toggle();
        expect(sw.checked).toBe(false);
      });
    }));

  it('early returns from onkeydown and onkeyup when disabled or native', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const sw = aria('switch', { disabled: true, checked: false });
        const div = bind(document.createElement('div'), sw);

        const down = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
        div.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);

        const up = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
        div.dispatchEvent(up);
        expect(sw.checked).toBe(false);
      });
    }));

  it('detaches cleanly on ref(null) and ceases DOM attribute updates', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const sw = aria('switch', { checked: false });
        const el = bind(document.createElement('button'), sw);

        expect(sw.current).toBe(el);
        sw.ref(null);
        expect(sw.current).toBeNull();

        sw.checked = true;
        expect(el.getAttribute('aria-checked')).toBe('false');
      });
    }));
});
