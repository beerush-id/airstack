import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, SwitchAria, type SwitchProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Switch - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Toggle State & Lifecycle Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for switch controls', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({});
          const sw = aria('switch', props);

          // 1. SSR Phase: unprovided checked defaults gracefully to false
          expect(sw.current).toBeNull();
          expect(sw.checked).toBe(false);
          expect(sw.attributes.role).toBe('switch');
          expect(sw.attributes.tabindex).toBe(0);
          expect(sw.attributes.disabled).toBeUndefined();
          expect(sw.attributes['aria-disabled']).toBe('false');
          expect(sw.attributes['aria-checked']).toBe('false');

          const defaultSwitch = new SwitchAria();
          expect(defaultSwitch.checked).toBe(false);
          expect(defaultSwitch.attributes.role).toBe('switch');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), sw);
          expect(sw.current).toBe(el);
          expect(el.getAttribute('role')).toBe('switch');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 3. Interaction Phase: click writes to props and toggles ON
          el.click();
          expect(props.checked).toBe(true);
          expect(sw.checked).toBe(true);
          expect(sw.attributes['aria-checked']).toBe('true');
          expect(el.getAttribute('aria-checked')).toBe('true');

          // Click toggles OFF
          el.click();
          expect(props.checked).toBe(false);
          expect(sw.checked).toBe(false);
          expect(sw.attributes['aria-checked']).toBe('false');
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 4. Disposal Phase
          sw.destroy();
          expect(sw.current).toBeNull();

          // External mutations cease affecting DOM
          props.checked = true;
          expect(el.getAttribute('aria-checked')).toBe('false');
        });
      }));

    it('enforces lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({ disabled: true });
          const sw = aria('switch', props);

          // 1. SSR Phase
          expect(sw.disabled).toBe(true);
          expect(sw.checked).toBe(false);
          expect(sw.attributes.disabled).toBeUndefined();
          expect(sw.attributes.tabindex).toBe(-1);
          expect(sw.attributes['aria-disabled']).toBe('true');
          expect(sw.attributes['aria-checked']).toBe('false');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), sw);
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('aria-disabled')).toBe('true');

          // 3. Interaction Phase: clicks ignored
          el.click();
          expect(props.checked).toBeUndefined();
          expect(sw.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');
        });
      }));

    it('synchronizes external forwarded props dynamically across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({ disabled: false, checked: false });
          const sw = aria('switch', props);

          // 1. SSR Phase
          expect(sw.attributes['aria-checked']).toBe('false');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), sw);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 3. External state change
          props.checked = true;
          expect(sw.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // Lockout transition
          props.disabled = true;
          expect(sw.disabled).toBe(true);
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          // User interaction locked out
          el.click();
          expect(props.checked).toBe(true);
        });
      }));
  });

  describe('Keyboard Interaction Contract', () => {
    it('supports Space keydown and keyup activation on custom elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({});
          const sw = aria<HTMLDivElement>('switch', props);
          const div = bind(document.createElement('div'), sw);

          // Space keydown prevents default scrolling
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);

          // Space keyup triggers click
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
          div.dispatchEvent(spaceUp);
          expect(props.checked).toBe(true);
          expect(sw.checked).toBe(true);
          expect(div.getAttribute('aria-checked')).toBe('true');

          // Subsequent Space toggles OFF
          div.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
          div.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true }));
          expect(props.checked).toBe(false);
          expect(sw.checked).toBe(false);
          expect(div.getAttribute('aria-checked')).toBe('false');

          // Enter keydown triggers activation immediately
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
          div.dispatchEvent(enterDown);
          expect(enterDown.defaultPrevented).toBe(true);
          expect(props.checked).toBe(true);
          expect(sw.checked).toBe(true);
          expect(div.getAttribute('aria-checked')).toBe('true');

          // Non-activation keys ignored
          const escapeDown = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
          div.dispatchEvent(escapeDown);
          expect(escapeDown.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Group Coordination Contract', () => {
    it('cascades group disablement to member switches', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ disabled: true });
          selectionGroup.set(group);

          const sw = aria('switch');
          expect(sw.disabled).toBe(true);
          expect(sw.attributes.disabled).toBeUndefined();
          expect(sw.attributes.tabindex).toBe(-1);
          expect(sw.attributes['aria-disabled']).toBe('true');
        });
      }));
  });
});
