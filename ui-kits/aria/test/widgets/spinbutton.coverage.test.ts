import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { SpinbuttonAria, aria, type SpinbuttonProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Spinbutton - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers construction with no props and no options', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const spin = new SpinbuttonAria();
        expect(spin.isNative).toBe(false);
        expect(spin.value).toBe(0);
        expect(spin.min).toBeUndefined();
        expect(spin.max).toBeUndefined();
        expect(spin.step).toBe(1);
        expect(spin.readonly).toBe(false);
        expect(spin.disabled).toBe(false);
        expect(spin.required).toBe(false);
        expect(spin.attributes.role).toBe('spinbutton');
        expect(spin.attributes.tabindex).toBe(0);
        expect(spin.attributes['aria-valuenow']).toBe(0);
        expect(spin.attributes['aria-valuemin']).toBeUndefined();
        expect(spin.attributes['aria-valuemax']).toBeUndefined();
        expect(spin.attributes['aria-disabled']).toBe('false');

        // The defaultValue handover belongs to native inputs only
        expect('defaultValue' in spin.attributes).toBe(false);

        const factorySpin = aria('spinbutton');
        expect(factorySpin.value).toBe(0);
        expect(factorySpin.attributes.role).toBe('spinbutton');
      });
    }));

  it('covers a field opened with no entered value falling back to its minimum', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const spin = aria<HTMLDivElement>('spinbutton', { min: 20, max: 40 });
        expect(spin.value).toBe(20);
        expect(spin.attributes['aria-valuenow']).toBe(20);

        const el = bind(document.createElement('div'), spin);
        expect(el.getAttribute('aria-valuenow')).toBe('20');

        // Stepping starts from the fallback rather than from zero
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true, bubbles: true }));
        expect(spin.value).toBe(21);
      });
    }));

  it('covers the default step multiplied by the page increment', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const spin = aria<HTMLDivElement>('spinbutton', { value: 0 });
        const el = bind(document.createElement('div'), spin);

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', cancelable: true, bubbles: true }));
        expect(spin.value).toBe(10);

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true, bubbles: true }));
        expect(spin.value).toBe(0);
      });
    }));

  it('leaves non-stepping keys unclaimed on a custom field', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const spin = aria<HTMLDivElement>('spinbutton', { value: 5 });
        const el = bind(document.createElement('div'), spin);

        for (const key of ['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'Escape']) {
          const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
          el.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
        }

        expect(spin.value).toBe(5);
      });
    }));

  it('ignores typed input on a disabled native field', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<SpinbuttonProps>({ value: 4, disabled: true });
        const spin = aria<HTMLInputElement>('spinbutton', props, { native: true });
        const el = bind(document.createElement('input'), spin);

        expect(el.disabled).toBe(true);

        el.value = '9';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        expect(props.value).toBe(4);
        expect(spin.value).toBe(4);
      });
    }));

  it('refuses non-numeric input from a host that does not sanitize it', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const props = mutable<SpinbuttonProps>({ value: 4 });
        const spin = aria<HTMLInputElement>('spinbutton', props, { native: true });
        const el = bind(document.createElement('input'), spin);

        // A number input sanitizes bad input to an empty string; a text host hands it back raw.
        el.type = 'text';
        el.value = '12 nights';
        el.dispatchEvent(new Event('input', { bubbles: true }));

        expect(props.value).toBe(4);
        expect(spin.value).toBe(4);
        expect(spin.attributes.defaultValue).toBe(4);
      });
    }));
});
