import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Radio - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers checked, disabled, and name public property getters and setters', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const radio = aria('radio');

        // checked
        expect(radio.checked).toBe(false);
        radio.checked = true;
        expect(radio.checked).toBe(true);
        radio.checked = false;
        expect(radio.checked).toBe(false);

        // disabled
        expect(radio.disabled).toBe(false);
        radio.disabled = true;
        expect(radio.disabled).toBe(true);

        // name
        expect(radio.name).toBeUndefined();
        radio.props.name = 'group-name';
        expect(radio.name).toBe('group-name');
      });
    }));

  it('no-ops when select() is invoked on a disabled radio', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const radio = aria('radio', { disabled: true, checked: false });
        radio.select();
        expect(radio.checked).toBe(false);
      });
    }));

  it('early returns from onkeydown and onkeyup when custom radio is disabled or receives non-space key', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const disabledRadio = aria<HTMLDivElement>('radio', { disabled: true }, { native: false });
        const disabledDiv = bind(document.createElement('div'), disabledRadio);

        const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceDown);
        expect(spaceDown.defaultPrevented).toBe(false);

        const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceUp);
        expect(disabledRadio.checked).toBe(false);

        // Custom enabled radio receiving non-space key
        const customRadio = aria<HTMLDivElement>('radio', {}, { native: false });
        const customDiv = bind(document.createElement('div'), customRadio);
        const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        customDiv.dispatchEvent(enterDown);
        expect(enterDown.defaultPrevented).toBe(false);

        const escapeUp = new KeyboardEvent('keyup', { key: 'Escape', cancelable: true });
        customDiv.dispatchEvent(escapeUp);
        expect(customRadio.checked).toBe(false);
      });
    }));

  it('maintains tabindex 0 on standalone custom radio without a group', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const r = aria<HTMLDivElement>('radio', { checked: false }, { native: false });
        expect(r.attributes.tabindex).toBe(0);
      });
    }));

  it('detaches cleanly on ref(null) and ceases DOM attribute updates', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const radio = aria('radio', { checked: false });
        const input = document.createElement('input');

        radio.ref(input);
        expect(radio.current).toBe(input);

        radio.ref(null);
        expect(radio.current).toBeNull();
      });
    }));
});
