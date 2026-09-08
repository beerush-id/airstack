import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, ToggleAria, type ToggleProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Toggle - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Toggle State & Lifecycle Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for toggle buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('toggle', { pressed: false });

          // 1. SSR Phase: pre-mount deterministic compilation
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase: framework element binding
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase: user clicks toggle ON
          el.click();
          expect(btn.pressed).toBe(true);
          expect(btn.attributes['aria-pressed']).toBe('true');
          expect(el.getAttribute('aria-pressed')).toBe('true');

          // User clicks toggle OFF
          el.click();
          expect(btn.pressed).toBe(false);
          expect(btn.attributes['aria-pressed']).toBe('false');
          expect(el.getAttribute('aria-pressed')).toBe('false');

          // 4. Disposal Phase: tears down without causing side effects
          btn.destroy();
          expect(btn.current).toBeNull();

          // State mutations no longer affect the unmounted DOM element
          btn.pressed = true;
          expect(el.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('compiles aria-pressed reflecting boolean toggle states', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const unpressed = aria('toggle', { pressed: false });
          const pressed = aria('toggle', { pressed: true });

          // SSR checks
          expect(unpressed.attributes['aria-pressed']).toBe('false');
          expect(pressed.attributes['aria-pressed']).toBe('true');

          // Mount checks
          const unpressedEl = bind(document.createElement('button'), unpressed);
          const pressedEl = bind(document.createElement('button'), pressed);

          expect(unpressedEl.getAttribute('aria-pressed')).toBe('false');
          expect(pressedEl.getAttribute('aria-pressed')).toBe('true');
        });
      }));
  });

  describe('Disabled State Contract', () => {
    it('follows SSR -> Mount -> Interaction lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('toggle', { disabled: true, pressed: false });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.disabled).toBe(true);
          expect(el.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase: click is rejected
          el.click();
          expect(btn.pressed).toBe(false);
          expect(el.getAttribute('aria-pressed')).toBe('false');
        });
      }));
  });

  describe('Forwarded Reactive Props Contract', () => {
    it('tracks forwarded props across SSR -> Mount -> Interaction and syncs user clicks back to props', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ToggleProps>({ disabled: false, pressed: false });
          const btn = aria('toggle', props);

          // 1. SSR Phase: reflects initial forwarded props
          expect(btn.current).toBeNull();
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase: mounts element
          const button = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(button);
          expect(button.disabled).toBe(false);
          expect(button.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase: parent mutates forwarded props -> element updates
          props.disabled = true;
          expect(btn.disabled).toBe(true);
          expect(button.disabled).toBe(true);

          // Parent re-enables and updates pressed
          props.disabled = false;
          props.pressed = true;
          expect(btn.disabled).toBe(false);
          expect(button.disabled).toBe(false);
          expect(button.getAttribute('aria-pressed')).toBe('true');

          // User interaction mutates the forwarded props directly
          button.click();
          expect(props.pressed).toBe(false);
          expect(btn.pressed).toBe(false);
          expect(button.getAttribute('aria-pressed')).toBe('false');
        });
      }));
  });

  describe('Group Selection Contract', () => {
    it('coordinates single-selection among siblings across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'tab-1' });
          selectionGroup.set(group);

          const btn1 = aria('toggle', { value: 'tab-1' });
          const btn2 = aria('toggle', { value: 'tab-2' });

          // 1. SSR Phase: attributes pre-compiled from group state
          expect(btn1.current).toBeNull();
          expect(btn2.current).toBeNull();
          expect(btn1.attributes['aria-pressed']).toBe('true');
          expect(btn2.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase
          const el1 = bind(document.createElement('button'), btn1);
          const el2 = bind(document.createElement('button'), btn2);
          expect(btn1.current).toBe(el1);
          expect(btn2.current).toBe(el2);
          expect(el1.getAttribute('aria-pressed')).toBe('true');
          expect(el2.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase: user clicks button 2
          el2.click();
          expect(group.value).toBe('tab-2');
          expect(el1.getAttribute('aria-pressed')).toBe('false');
          expect(el2.getAttribute('aria-pressed')).toBe('true');
        });
      }));

    it('toggles membership in an array collection across SSR -> Mount -> Interaction for multi-select groups', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['bold'], multiple: true });
          selectionGroup.set(group);

          const boldBtn = aria('toggle', { value: 'bold' });
          const italicBtn = aria('toggle', { value: 'italic' });

          // 1. SSR Phase
          expect(boldBtn.current).toBeNull();
          expect(italicBtn.current).toBeNull();
          expect(boldBtn.attributes['aria-pressed']).toBe('true');
          expect(italicBtn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase
          const boldEl = bind(document.createElement('button'), boldBtn);
          const italicEl = bind(document.createElement('button'), italicBtn);
          expect(boldEl.getAttribute('aria-pressed')).toBe('true');
          expect(italicEl.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase
          // User selects italic -> adds to collection
          italicEl.click();
          expect(group.value).toEqual(['bold', 'italic']);
          expect(italicEl.getAttribute('aria-pressed')).toBe('true');

          // User clicks bold again -> removes from collection
          boldEl.click();
          expect(group.value).toEqual(['italic']);
          expect(boldEl.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('renders role="button" on non-native custom toggle elements', () =>
      scope.run(() => {
        component().run(() => {
          const toggle = aria('toggle', { pressed: true }, { native: false });
          expect(toggle.attributes.role).toBe('button');
          expect(toggle.attributes['aria-pressed']).toBe('true');
          expect(toggle.attributes.type).toBeUndefined();

          const unpressedToggle = aria('toggle', { pressed: false }, { native: false });
          expect(unpressedToggle.attributes.role).toBe('button');
          expect(unpressedToggle.attributes['aria-pressed']).toBe('false');

          const defaultToggle = new ToggleAria();
          expect(defaultToggle.attributes.type).toBe('button');
          expect(defaultToggle.attributes['aria-pressed']).toBe('false');
        });
      }));
  });
});
