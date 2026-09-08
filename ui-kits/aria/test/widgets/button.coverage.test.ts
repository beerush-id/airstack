import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, ButtonAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers type and disabled public property getters', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const btn = aria('button', { type: 'submit', disabled: true });
        expect(btn.type).toBe('submit');
        expect(btn.disabled).toBe(true);

        const defaultBtn = aria('button');
        expect(defaultBtn.type).toBe('button');
        expect(defaultBtn.disabled).toBe(false);

        const ctorBtn = new ButtonAria();
        expect(ctorBtn.type).toBe('button');
        expect(ctorBtn.disabled).toBe(false);
      });
    }));

  it('safely handles non-native submit and reset clicks when element has no enclosing form', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const submitBtn = aria<HTMLDivElement>('button', { type: 'submit' });
        const submitDiv = bind(document.createElement('div'), submitBtn);
        expect(() => submitDiv.click()).not.toThrow();

        const resetBtn = aria<HTMLDivElement>('button', { type: 'reset' });
        const resetDiv = bind(document.createElement('div'), resetBtn);
        expect(() => resetDiv.click()).not.toThrow();
      });
    }));

  it('triggers form submit and reset when non-native button is clicked inside a form', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const form = document.createElement('form');
        const submitSpy = vi.fn((e: Event) => e.preventDefault());
        const resetSpy = vi.fn((e: Event) => e.preventDefault());
        form.addEventListener('submit', submitSpy);
        form.addEventListener('reset', resetSpy);
        document.body.appendChild(form);

        const submitBtn = aria<HTMLDivElement>('button', { type: 'submit' }, { native: false });
        const submitDiv = bind(document.createElement('div'), submitBtn);
        form.appendChild(submitDiv);
        submitDiv.click();
        expect(submitSpy).toHaveBeenCalledTimes(1);

        const resetBtn = aria<HTMLDivElement>('button', { type: 'reset' }, { native: false });
        const resetDiv = bind(document.createElement('div'), resetBtn);
        form.appendChild(resetDiv);
        resetDiv.click();
        expect(resetSpy).toHaveBeenCalledTimes(1);

        form.remove();
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

        // Disabled custom non-native element handlers
        const customDisabledBtn = aria<HTMLDivElement>('button', { disabled: true }, { native: false });
        const customDisabledDiv = bind(document.createElement('div'), customDisabledBtn);
        expect(customDisabledBtn.attributes.tabindex).toBe(-1);
        expect(customDisabledBtn.attributes['aria-disabled']).toBe('true');
        customDisabledDiv.click();
        customDisabledDiv.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        customDisabledDiv.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true }));
      });
    }));
});
