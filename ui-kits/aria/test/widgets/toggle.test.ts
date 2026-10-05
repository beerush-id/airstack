import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, selectionGroup, ToggleAria, type ToggleProps } from '../../src/index.js';
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

  describe('Pressed State Inversion & Event Dispatch Invariant', () => {
    it('inverts once per Space press and once per Enter keydown on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ToggleProps>({ pressed: false });
          const btn = aria<HTMLDivElement>('toggle', props, { native: false });

          // 1. Creation & SSR
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBe('button');
          expect(btn.attributes.tabindex).toBe(0);
          expect(btn.attributes['aria-pressed']).toBe('false');
          expect(btn.attributes.type).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), btn);
          expect(el.getAttribute('role')).toBe('button');
          expect(el.getAttribute('tabindex')).toBe('0');

          const hostClicks: MouseEvent[] = [];
          el.addEventListener('click', (event) => hostClicks.push(event));

          // 3. Space suppresses the scroll and defers the inversion to keyup
          const spaceDown = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(btn.pressed).toBe(false);

          for (let repeat = 0; repeat < 3; repeat += 1) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          }
          expect(btn.pressed).toBe(false);

          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(btn.pressed).toBe(true);
          expect(props.pressed).toBe(true);
          expect(el.getAttribute('aria-pressed')).toBe('true');
          expect(hostClicks).toHaveLength(1);

          // 4. Enter inverts immediately, and the click it synthesizes reaches consumers
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
          expect(btn.pressed).toBe(false);
          expect(props.pressed).toBe(false);
          expect(el.getAttribute('aria-pressed')).toBe('false');
          expect(hostClicks).toHaveLength(2);

          // 6. Teardown: no further inversion reaches the detached node
          btn.destroy();
          expect(btn.current).toBeNull();

          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
          expect(btn.pressed).toBe(false);
        });
      }));

    it('leaves the browser-generated activation click as the only inversion path on a native host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('toggle', { pressed: false });
          const el = bind(document.createElement('button'), btn);

          const inversions: boolean[] = [];
          el.addEventListener('click', () => inversions.push(btn.pressed));

          // Raw key events belong to the browser on a native button host
          const spaceDown = new KeyboardEvent('keydown', {
            key: ' ',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);
          expect(btn.pressed).toBe(false);

          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(btn.pressed).toBe(false);

          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);
          expect(enter.defaultPrevented).toBe(false);
          expect(btn.pressed).toBe(false);

          // A real activation is one click, and the listener sees the post-inversion state
          el.click();
          expect(inversions).toEqual([true]);
          expect(btn.pressed).toBe(true);
          expect(el.getAttribute('aria-pressed')).toBe('true');

          el.click();
          expect(inversions).toEqual([true, false]);

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));
  });

  describe('Host Parity & Semantic Delegation Invariant', () => {
    it('never submits the enclosing form from a toggle and keeps the selection token out of the field', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const submitSpy = vi.fn();
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitSpy();
          });
          document.body.appendChild(form);

          const group = mutable({ value: ['bold'], multiple: true });
          selectionGroup.set(group);

          const btn = aria('toggle', { value: 'bold' });

          // The group token is a selection key, not a form value
          expect(btn.properties.value).toBe('bold');
          expect(btn.attributes.value).toBeUndefined();
          expect(btn.attributes.name).toBeUndefined();

          const el = bind(document.createElement('button'), btn);
          el.name = 'format';
          form.appendChild(el);

          // The defensive type keeps a toggle out of implicit submission
          expect(el.type).toBe('button');
          el.click();
          expect(submitSpy).not.toHaveBeenCalled();
          expect(group.value).toEqual([]);
          expect(el.getAttribute('aria-pressed')).toBe('false');

          // A toggle contributes nothing to the submitted payload
          expect(new FormData(form).get('format')).toBeNull();

          btn.destroy();
          document.body.removeChild(form);
          expect(btn.current).toBeNull();
        });
      }));

    it('announces the same pressed state on both hosts because ARIA has no native counterpart', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeToggle = aria('toggle', { pressed: true });
          const customToggle = aria<HTMLDivElement>('toggle', { pressed: true }, { native: false });

          const button = bind(document.createElement('button'), nativeToggle);
          const div = bind(document.createElement('div'), customToggle);

          // aria-pressed has no HTML equivalent, so both hosts must carry it
          expect(button.getAttribute('aria-pressed')).toBe('true');
          expect(div.getAttribute('aria-pressed')).toBe('true');

          // Only the role and the tab stop differ by host
          expect(button.hasAttribute('role')).toBe(false);
          expect(div.getAttribute('role')).toBe('button');
          expect(button.hasAttribute('tabindex')).toBe(false);
          expect(div.getAttribute('tabindex')).toBe('0');

          // And only the native host gets a type
          expect(nativeToggle.attributes.type).toBe('button');
          expect(customToggle.attributes.type).toBeUndefined();

          nativeToggle.destroy();
          customToggle.destroy();
          expect(nativeToggle.current).toBeNull();
          expect(customToggle.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('refuses every activation path on a custom host declared disabled and re-arms live', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ToggleProps>({ pressed: false, disabled: true });
          const btn = aria<HTMLDivElement>('toggle', props, { native: false });

          // 1. Creation & SSR
          expect(btn.attributes['aria-disabled']).toBe('true');
          expect(btn.attributes.tabindex).toBe(-1);
          expect(btn.attributes.disabled).toBeUndefined();

          // 2. DOM Binding
          const el = bind(document.createElement('div'), btn);
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.click();
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));

          // 3. Interaction: the state and the announcement both stay put
          expect(btn.pressed).toBe(false);
          expect(el.getAttribute('aria-pressed')).toBe('false');

          // 5. Reconciliation: releasing the guard restores the tab stop and the inversion
          props.disabled = false;
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('0');

          el.click();
          expect(btn.pressed).toBe(true);
          expect(el.getAttribute('aria-pressed')).toBe('true');

          btn.destroy();
          expect(btn.current).toBeNull();
        });
      }));

    it('keeps a disabled group member out of the registry mutation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['bold'], multiple: true, disabled: false });
          selectionGroup.set(group);

          const boldBtn = aria<HTMLDivElement>('toggle', { value: 'bold' }, { native: false });
          const italicBtn = aria<HTMLDivElement>('toggle', { value: 'italic', disabled: true }, { native: false });

          const boldEl = bind(document.createElement('div'), boldBtn);
          const italicEl = bind(document.createElement('div'), italicBtn);

          expect(italicEl.getAttribute('aria-disabled')).toBe('true');
          expect(italicEl.getAttribute('tabindex')).toBe('-1');

          italicEl.click();
          expect(group.value).toEqual(['bold']);
          expect(italicEl.getAttribute('aria-pressed')).toBe('false');

          // The enabled member still moves the registry while the disabled one waits
          boldEl.click();
          expect(group.value).toEqual([]);

          group.disabled = true;
          expect(boldBtn.disabled).toBe(true);
          expect(boldEl.getAttribute('tabindex')).toBe('-1');

          boldEl.click();
          expect(group.value).toEqual([]);

          group.disabled = false;
          italicBtn.assign({ disabled: false });

          italicEl.click();
          expect(group.value).toEqual(['italic']);
          expect(italicEl.getAttribute('aria-pressed')).toBe('true');

          boldBtn.destroy();
          italicBtn.destroy();
        });
      }));
  });
});
