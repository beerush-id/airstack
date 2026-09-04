import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers type, disabled, pressed, value, and name public property getters and setters', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button');

        // type getter
        expect(btn.type).toBe('button');

        // disabled getter and setter
        expect(btn.disabled).toBe(false);
        btn.disabled = true;
        expect(btn.disabled).toBe(true);
        btn.disabled = false;
        expect(btn.disabled).toBe(false);

        // pressed getter and setter
        const toggleBtn = aria('button', {}, { toggle: true });
        expect(toggleBtn.pressed).toBe(false);
        toggleBtn.pressed = true;
        expect(toggleBtn.pressed).toBe(true);
        toggleBtn.pressed = false;
        expect(toggleBtn.pressed).toBe(false);

        // value getter and setter
        expect(btn.value).toBeUndefined();
        btn.value = 'val-1';
        expect(btn.value).toBe('val-1');

        // name getter and setter
        expect(btn.name).toBeUndefined();
        btn.name = 'opt-name';
        expect(btn.name).toBe('opt-name');
      });
    }));

  it('toggles pressed state explicitly via toggle() method', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button', { pressed: false }, { toggle: true });
        expect(btn.pressed).toBe(false);

        btn.toggle();
        expect(btn.pressed).toBe(true);

        btn.toggle();
        expect(btn.pressed).toBe(false);
      });
    }));

  it('no-ops when select() is invoked on a disabled button', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button', { disabled: true, pressed: false });
        btn.select();
        expect(btn.pressed).toBe(false);
      });
    }));

  it('safely handles non-native submit and reset clicks when element has no enclosing form', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const submitBtn = aria<HTMLDivElement>('button', { type: 'submit' });
        const submitDiv = bind(document.createElement('div'), submitBtn);
        // Click outside of any <form> -> closest('form') is null, no-ops cleanly
        expect(() => submitDiv.click()).not.toThrow();

        const resetBtn = aria<HTMLDivElement>('button', { type: 'reset' });
        const resetDiv = bind(document.createElement('div'), resetBtn);
        // Click outside of any <form> -> closest('form') is null, no-ops cleanly
        expect(() => resetDiv.click()).not.toThrow();
      });
    }));

  it('no-ops programmatic select() on native submit and reset buttons', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const submitBtn = aria('button', { type: 'submit' }, { native: true });
        bind(document.createElement('button'), submitBtn);
        submitBtn.select();
        expect(submitBtn.pressed).toBe(false);

        const resetBtn = aria('button', { type: 'reset' }, { native: true });
        bind(document.createElement('button'), resetBtn);
        resetBtn.select();
        expect(resetBtn.pressed).toBe(false);
      });
    }));

  it('early returns from onkeydown and onkeyup when button is disabled or native', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const disabledBtn = aria<HTMLDivElement>('button', { disabled: true });
        const disabledDiv = bind(document.createElement('div'), disabledBtn);

        const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceDown);
        expect(spaceDown.defaultPrevented).toBe(false);

        const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceUp);

        // Ignored non-space/non-enter key on enabled custom element
        const customBtn = aria<HTMLDivElement>('button', {}, { native: false });
        const customDiv = bind(document.createElement('div'), customBtn);
        const escapeUp = new KeyboardEvent('keyup', { key: 'Escape', cancelable: true });
        const tabDown = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        customDiv.dispatchEvent(escapeUp);
        customDiv.dispatchEvent(tabDown);

        const nativeBtn = aria('button', {}, { native: true });
        const nativeEl = bind(document.createElement('button'), nativeBtn);
        nativeEl.dispatchEvent(spaceDown);
        nativeEl.dispatchEvent(spaceUp);
      });
    }));

  it('handles group button without name or value props gracefully', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: 'opt-1' });
        selectionGroup.set(group);

        const btn = aria('button');
        expect(btn.type).toBe('button');
        btn.select();
        expect(group.value).toBe(btn.id);
      });
    }));

  it('selects group option with name-only toggle', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: { italic: false } });
        selectionGroup.set(group);

        const btn = aria('button', { name: 'italic' });
        expect(btn.pressed).toBe(false);
        btn.select();
        expect(group.value.italic).toBe(true);
        expect(btn.pressed).toBe(true);
      });
    }));

  it('handles reactive effect when group reference is cleared defensively', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: 'opt-1' });
        selectionGroup.set(group);

        const btn = aria('button', { value: 'opt-1' });
        expect(btn.pressed).toBe(true);

        // Defensively clear group reference and trigger group mutation
        (btn as unknown as { group: unknown }).group = undefined;
        group.value = 'opt-2';
        expect(btn.pressed).toBe(true);
      });
    }));
});
