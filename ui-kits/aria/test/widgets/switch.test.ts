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

  describe('Binary State Inversion & Event Dispatch Invariant', () => {
    it('converges click, Space and Enter onto one inversion each and forwards fresh state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({ checked: false });
          const sw = aria<HTMLDivElement>('switch', props, { native: false });
          const el = bind(document.createElement('div'), sw);

          const observed: boolean[] = [];
          el.addEventListener('click', () => observed.push(sw.checked));

          // Pointer path: the projection is already inverted when a consumer sees the click
          el.click();
          expect(observed).toEqual([true]);
          expect(props.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // Space is repeat-safe: many keydowns, one keyup, one inversion
          for (let repeat = 0; repeat < 3; repeat += 1) {
            el.dispatchEvent(
              new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
            );
          }
          expect(sw.checked).toBe(true);

          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(sw.checked).toBe(false);
          expect(observed).toEqual([true, false]);

          // Enter inverts immediately on keydown
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );
          expect(sw.checked).toBe(true);
          expect(props.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // 6. Teardown: a detached host stops inverting
          sw.destroy();
          expect(sw.current).toBeNull();

          el.click();
          expect(sw.checked).toBe(true);
        });
      }));

    it('leaves raw key events to the browser when backed by a native button host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({ checked: false });
          const sw = aria<HTMLButtonElement>('switch', props, { native: true });

          // The ARIA announcement survives native backing: <button> has no implicit switch role
          expect(sw.attributes.role).toBe('switch');
          expect(sw.attributes['aria-checked']).toBe('false');

          const el = bind(document.createElement('button'), sw);
          expect(el.getAttribute('role')).toBe('switch');

          // A native host adds no tab stop of its own
          expect(el.hasAttribute('tabindex')).toBe(false);

          const spaceDown = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);
          expect(sw.checked).toBe(false);

          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(sw.checked).toBe(false);

          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);
          expect(enter.defaultPrevented).toBe(false);
          expect(sw.checked).toBe(false);

          // Activation arrives as the click the browser generates, and inverts exactly once
          el.click();
          expect(sw.checked).toBe(true);
          expect(props.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));
  });

  describe('Form Control Boundary & Host Parity Invariant', () => {
    it('keeps the field identity out of the projection while passing it through untouched', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const sw = aria<HTMLButtonElement>(
            'switch',
            { name: 'notifications', value: 'on', checked: false },
            { native: true },
          );

          // Identity stays on props for the template author to bind
          expect(sw.props.name).toBe('notifications');
          expect(sw.props.value).toBe('on');
          expect(sw.attributes.name).toBeUndefined();
          expect(sw.attributes.value).toBeUndefined();
          expect(sw.attributes.form).toBeUndefined();

          const el = bind(document.createElement('button'), sw);
          expect(el.hasAttribute('name')).toBe(false);
          expect(el.hasAttribute('value')).toBe(false);

          // A button-backed switch never becomes a form field by accident
          const form = document.createElement('form');
          document.body.appendChild(form);
          form.appendChild(el);
          expect(new FormData(form).has('notifications')).toBe(false);

          el.click();
          expect(sw.checked).toBe(true);
          expect(new FormData(form).has('notifications')).toBe(false);

          document.body.removeChild(form);
          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('announces the same binary state on both hosts and never a native checked property', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const customSwitch = aria<HTMLDivElement>('switch', { checked: true }, { native: false });
          const nativeSwitch = aria<HTMLButtonElement>('switch', { checked: true }, { native: true });

          const div = bind(document.createElement('div'), customSwitch);
          const button = bind(document.createElement('button'), nativeSwitch);

          expect(div.getAttribute('aria-checked')).toBe('true');
          expect(button.getAttribute('aria-checked')).toBe('true');

          // There is no HTML switch element, so checked never has a native counterpart to sync
          expect((div as HTMLDivElement & { checked?: boolean }).checked).toBeUndefined();
          expect(
            (button as HTMLButtonElement & { checked?: boolean }).checked,
          ).toBeUndefined();
          expect(customSwitch.attributes.checked).toBeUndefined();
          expect(nativeSwitch.attributes.checked).toBeUndefined();

          // Both hosts stay explicit about the role regardless of native backing
          expect(div.getAttribute('role')).toBe('switch');
          expect(button.getAttribute('role')).toBe('switch');

          // The custom host needs a synthesized tab stop; the button host already has one
          expect(div.getAttribute('tabindex')).toBe('0');
          expect(nativeSwitch.attributes.tabindex).toBeUndefined();
          expect(button.hasAttribute('tabindex')).toBe(false);

          customSwitch.destroy();
          nativeSwitch.destroy();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('freezes the state and refuses all three activation paths when a mounted switch is disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<SwitchProps>({ checked: true, disabled: false });
          const sw = aria<HTMLDivElement>('switch', props, { native: false });
          const el = bind(document.createElement('div'), sw);

          expect(el.getAttribute('aria-checked')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          // Lockout keeps the declared state: disabling is not a reset
          props.disabled = true;
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(sw.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          el.click();
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }),
          );

          expect(sw.checked).toBe(true);
          expect(props.checked).toBe(true);

          // Releasing the lockout resumes a single inversion per activation
          props.disabled = false;
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('0');

          el.click();
          expect(sw.checked).toBe(false);

          el.click();
          expect(sw.checked).toBe(true);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));

    it('inherits a live group lockout and hands the widget back when it lifts', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ disabled: false });
          selectionGroup.set(group);

          const sw = aria<HTMLDivElement>('switch', { checked: false }, { native: false });
          const el = bind(document.createElement('div'), sw);

          el.click();
          expect(sw.checked).toBe(true);

          // Registry-level lockout reaches the member without the member declaring anything
          group.disabled = true;
          expect(sw.disabled).toBe(true);
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.click();
          el.dispatchEvent(
            new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }),
          );
          expect(sw.checked).toBe(true);

          group.disabled = false;
          expect(sw.disabled).toBe(false);

          el.click();
          expect(sw.checked).toBe(false);

          sw.destroy();
          expect(sw.current).toBeNull();
        });
      }));
  });
});
