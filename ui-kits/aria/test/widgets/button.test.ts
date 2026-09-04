import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ButtonAria, type ButtonProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Button - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Action & Toggle Contract', () => {
    it('follows SSR -> Mount -> Interaction lifecycle for toggle buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { pressed: false }, { toggle: true });

          // 1. SSR Phase: pre-mount deterministic compilation
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.tabindex).toBe(0);
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-disabled']).toBe('false');
          expect(btn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase: framework element binding
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('role')).toBeNull();
          expect(el.getAttribute('tabindex')).toBe('0');
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

    it('follows SSR -> Mount -> Interaction lifecycle for standard action buttons', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase: standard buttons omit aria-pressed
          expect(btn.current).toBeNull();
          expect(btn.attributes.role).toBeUndefined();
          expect(btn.attributes.type).toBe('button');
          expect(btn.attributes.tabindex).toBe(0);
          expect(btn.attributes.disabled).toBe(false);
          expect(btn.attributes['aria-disabled']).toBe('false');
          expect(btn.attributes['aria-pressed']).toBeUndefined();

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('aria-pressed')).toBeNull();

          // 3. Interaction Phase: clicking preserves absence of aria-pressed
          el.click();
          expect(btn.attributes['aria-pressed']).toBeUndefined();
          expect(el.getAttribute('aria-pressed')).toBeNull();
        });
      }));

    it('compiles aria-pressed reflecting boolean toggle states', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const unpressed = aria('button', { pressed: false }, { toggle: true });
          const pressed = aria('button', { pressed: true }, { toggle: true });

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
          const btn = aria('button', { disabled: true, pressed: false }, { toggle: true });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);
          expect(btn.attributes.tabindex).toBe(-1);
          expect(btn.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.disabled).toBe(true);
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('aria-disabled')).toBe('true');

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
          const props = mutable<ButtonProps>({ disabled: false, pressed: false });
          const btn = aria('button', props, { toggle: true });

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
          expect(button.getAttribute('tabindex')).toBe('-1');
          expect(button.getAttribute('aria-disabled')).toBe('true');

          // Parent re-enables and updates pressed
          props.disabled = false;
          props.pressed = true;
          expect(btn.disabled).toBe(false);
          expect(button.disabled).toBe(false);
          expect(button.getAttribute('tabindex')).toBe('0');
          expect(button.getAttribute('aria-pressed')).toBe('true');

          // User interaction mutates the forwarded props directly
          button.click();
          expect(props.pressed).toBe(false);
          expect(btn.pressed).toBe(false);
          expect(button.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('enforces lockout and restores interactivity across dynamic enable/disable transitions', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ButtonProps>({ disabled: false, pressed: false });
          const btn = aria<HTMLDivElement>('button', props, { toggle: true });

          // 1. SSR Phase
          expect(btn.attributes.disabled).toBe(false);

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase
          div.click();
          expect(props.pressed).toBe(true);
          expect(div.getAttribute('aria-pressed')).toBe('true');

          // Disable via forwarded props
          props.disabled = true;
          expect(div.getAttribute('tabindex')).toBe('-1');
          expect(div.getAttribute('aria-disabled')).toBe('true');

          // Click rejected while disabled
          div.click();
          expect(props.pressed).toBe(true);
          expect(div.getAttribute('aria-pressed')).toBe('true');

          // Re-enable via forwarded props
          props.disabled = false;
          expect(div.getAttribute('tabindex')).toBe('0');
          expect(div.getAttribute('aria-disabled')).toBe('false');

          // Click succeeds again
          div.click();
          expect(props.pressed).toBe(false);
          expect(div.getAttribute('aria-pressed')).toBe('false');
        });
      }));
  });

  describe('Native Form Equivalence Contract', () => {
    it('submits enclosing form via requestSubmit when non-native submit button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const submitSpy = vi.fn();
          form.requestSubmit = submitSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'submit' }, { native: false });

          // 1. SSR Phase: preserves submit type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('submit');
          expect(btn.attributes.type).toBe('submit');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.requestSubmit()
          div.click();
          expect(submitSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));

    it('resets enclosing form when non-native reset button is clicked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const resetSpy = vi.fn();
          form.reset = resetSpy;
          document.body.appendChild(form);

          const btn = aria<HTMLDivElement>('button', { type: 'reset' }, { native: false });

          // 1. SSR Phase: preserves reset type
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('reset');
          expect(btn.attributes.type).toBe('reset');

          // 2. Mount Phase: mounts inside form
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click calls form.reset()
          div.click();
          expect(resetSpy).toHaveBeenCalledTimes(1);

          document.body.removeChild(form);
        });
      }));

    it('strictly enforces type="button" inside button group across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          const submitSpy = vi.fn();
          form.requestSubmit = submitSpy;
          document.body.appendChild(form);

          const group = mutable({ value: 'opt-1' });
          selectionGroup.set(group);

          const btn = aria<HTMLDivElement>('button', { type: 'submit', value: 'opt-1' });

          // 1. SSR Phase: group forces type="button"
          expect(btn.current).toBeNull();
          expect(btn.type).toBe('button');
          expect(btn.attributes.type).toBe('button');

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          form.appendChild(div);
          expect(btn.current).toBe(div);

          // 3. Interaction Phase: click never submits form
          div.click();
          expect(submitSpy).not.toHaveBeenCalled();

          document.body.removeChild(form);
        });
      }));
  });

  describe('Keyboard Activation Contract', () => {
    it('activates non-native element on Enter keydown and prevents default navigation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase: attributes omit event handlers
          expect(btn.current).toBeNull();
          expect(btn.attributes.onkeydown).toBeUndefined();
          expect(btn.attributes.onkeyup).toBeUndefined();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          div.dispatchEvent(enterDown);

          expect(enterDown.defaultPrevented).toBe(true);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('prevents default scroll on Space keydown and activates on Space keyup for non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria<HTMLDivElement>('button', {}, { native: false });

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), btn);
          expect(btn.current).toBe(div);
          const clickSpy = vi.fn();
          div.addEventListener('click', clickSpy);

          // 3. Interaction Phase
          // Space keydown: suppresses scroll without clicking
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(clickSpy).not.toHaveBeenCalled();

          // Space keyup: activates via click
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceUp);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        });
      }));

    it('delegates keyboard navigation directly to the browser for native <button> elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button');

          // 1. SSR Phase
          expect(btn.current).toBeNull();

          // 2. Mount Phase
          const button = bind(document.createElement('button'), btn);
          expect(btn.isNative).toBe(true);
          expect(btn.current).toBe(button);

          // 3. Interaction Phase: native buttons leave defaultPrevented to false
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          button.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);

          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
          button.dispatchEvent(enterDown);
          expect(enterDown.defaultPrevented).toBe(false);
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

          const btn1 = aria('button', { value: 'tab-1' });
          const btn2 = aria('button', { value: 'tab-2' });

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

    it('deselects active button to undefined when toggle option is enabled on button', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'opt-1' });
          selectionGroup.set(group);

          const btn = aria('button', { value: 'opt-1' }, { toggle: true });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.attributes['aria-pressed']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('aria-pressed')).toBe('true');

          // 3. Interaction Phase: user clicks active toggle option -> deselects
          el.click();
          expect(group.value).toBeUndefined();
          expect(el.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('deselects active button to undefined when toggle option is enabled on group', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'opt-1', toggle: true });
          selectionGroup.set(group);

          const btn = aria('button', { value: 'opt-1' });

          // 1. SSR Phase
          expect(btn.current).toBeNull();
          expect(btn.attributes['aria-pressed']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.getAttribute('aria-pressed')).toBe('true');

          // 3. Interaction Phase: user clicks active option in toggle group -> deselects
          el.click();
          expect(group.value).toBeUndefined();
          expect(el.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('toggles membership in an array collection across SSR -> Mount -> Interaction for multi-select groups', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['bold'] });
          selectionGroup.set(group);

          const boldBtn = aria('button', { value: 'bold' });
          const italicBtn = aria('button', { value: 'italic' });

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

    it('toggles named boolean properties on group record across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: { bold: true, underline: false } });
          selectionGroup.set(group);

          const boldBtn = aria('button', { name: 'bold' });
          const underlineBtn = aria('button', { name: 'underline' });

          // 1. SSR Phase
          expect(boldBtn.current).toBeNull();
          expect(underlineBtn.current).toBeNull();
          expect(boldBtn.attributes['aria-pressed']).toBe('true');
          expect(underlineBtn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase
          const boldEl = bind(document.createElement('button'), boldBtn);
          const underlineEl = bind(document.createElement('button'), underlineBtn);
          expect(boldEl.getAttribute('aria-pressed')).toBe('true');
          expect(underlineEl.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase
          // User clicks underline toggle
          underlineEl.click();
          expect(group.value.underline).toBe(true);
          expect(underlineBtn.pressed).toBe(true);
          expect(underlineEl.getAttribute('aria-pressed')).toBe('true');

          // User clicks bold toggle
          boldEl.click();
          expect(group.value.bold).toBe(false);
          expect(boldBtn.pressed).toBe(false);
          expect(boldEl.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('supports scoped property fields with name and value across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: { align: 'left' } });
          selectionGroup.set(group);

          const leftBtn = aria('button', { name: 'align', value: 'left' });
          const centerBtn = aria('button', { name: 'align', value: 'center' });

          // 1. SSR Phase
          expect(leftBtn.current).toBeNull();
          expect(centerBtn.current).toBeNull();
          expect(leftBtn.attributes['aria-pressed']).toBe('true');
          expect(centerBtn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase
          const leftEl = bind(document.createElement('button'), leftBtn);
          const centerEl = bind(document.createElement('button'), centerBtn);
          expect(leftEl.getAttribute('aria-pressed')).toBe('true');
          expect(centerEl.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase
          centerEl.click();
          expect(group.value.align).toBe('center');
          expect(leftBtn.pressed).toBe(false);
          expect(centerBtn.pressed).toBe(true);
          expect(leftEl.getAttribute('aria-pressed')).toBe('false');
          expect(centerEl.getAttribute('aria-pressed')).toBe('true');
        });
      }));

    it('supports scoped array membership with name and value across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: { tags: ['news'] } });
          selectionGroup.set(group);

          const newsBtn = aria('button', { name: 'tags', value: 'news' });
          const techBtn = aria('button', { name: 'tags', value: 'tech' });

          // 1. SSR Phase
          expect(newsBtn.current).toBeNull();
          expect(techBtn.current).toBeNull();
          expect(newsBtn.attributes['aria-pressed']).toBe('true');
          expect(techBtn.attributes['aria-pressed']).toBe('false');

          // 2. Mount Phase
          const newsEl = bind(document.createElement('button'), newsBtn);
          const techEl = bind(document.createElement('button'), techBtn);
          expect(newsEl.getAttribute('aria-pressed')).toBe('true');
          expect(techEl.getAttribute('aria-pressed')).toBe('false');

          // 3. Interaction Phase
          techEl.click();
          expect(group.value.tags).toEqual(['news', 'tech']);
          expect(techBtn.pressed).toBe(true);
          expect(techEl.getAttribute('aria-pressed')).toBe('true');

          newsEl.click();
          expect(group.value.tags).toEqual(['tech']);
          expect(newsBtn.pressed).toBe(false);
          expect(newsEl.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('cascades group disablement to member buttons across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'opt-1', disabled: true });
          selectionGroup.set(group);

          const btn = aria('button', { value: 'opt-1' });

          // 1. SSR Phase: cascades disabled attributes before mount
          expect(btn.current).toBeNull();
          expect(btn.disabled).toBe(true);
          expect(btn.attributes.disabled).toBe(true);
          expect(btn.attributes.tabindex).toBe(-1);
          expect(btn.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const el = bind(document.createElement('button'), btn);
          expect(btn.current).toBe(el);
          expect(el.disabled).toBe(true);
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('aria-disabled')).toBe('true');

          // 3. Interaction Phase: click rejected
          el.click();
          expect(group.value).toBe('opt-1');
        });
      }));
  });

  describe('Accessibility Semantics Contract', () => {
    it('applies standard ARIA role, tabindex, and disabled states across native and custom elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeBtn = aria('button');
          const buttonEl = bind(document.createElement('button'), nativeBtn);

          expect(buttonEl.getAttribute('role')).toBeNull();
          expect(buttonEl.getAttribute('tabindex')).toBe('0');
          expect(buttonEl.disabled).toBe(false);

          const customBtn = aria<HTMLDivElement>('button', {}, { native: false });
          const divEl = bind(document.createElement('div'), customBtn);

          expect(divEl.getAttribute('role')).toBe('button');
          expect(divEl.getAttribute('tabindex')).toBe('0');
          expect(divEl.getAttribute('aria-disabled')).toBe('false');
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('cleans up element bindings and ensures subsequent state mutations cause zero DOM side effects', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ButtonProps>({ disabled: false, pressed: false });
          const btn = aria('button', props, { toggle: true });
          const button = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(button);
          expect(button.getAttribute('aria-pressed')).toBe('false');

          // Destruction releases element reference
          btn.destroy();
          expect(btn.current).toBeNull();

          // External reactive changes cause zero side effects on the released DOM element
          props.disabled = true;
          props.pressed = true;
          expect(button.disabled).toBe(false);
          expect(button.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('detaches cleanly on ref(null) and ceases DOM attribute updates', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const btn = aria('button', { pressed: false }, { toggle: true });
          const el = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(el);
          btn.ref(null);
          expect(btn.current).toBeNull();

          // State mutations no longer affect detached element
          btn.pressed = true;
          expect(el.getAttribute('aria-pressed')).toBe('false');
        });
      }));

    it('ceases DOM mutations when button is destroyed and group subsequently mutates', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'tab-1', disabled: false });
          selectionGroup.set(group);

          const btn = aria('button', { value: 'tab-1' });
          const button = bind(document.createElement('button'), btn);

          expect(btn.current).toBe(button);
          expect(button.getAttribute('aria-pressed')).toBe('true');
          expect(button.disabled).toBe(false);

          // Button destroyed
          btn.destroy();
          expect(btn.current).toBeNull();

          // Group mutates afterwards -> detached DOM element causes zero side effects
          group.value = 'tab-2';
          group.disabled = true;
          expect(button.getAttribute('aria-pressed')).toBe('true');
          expect(button.disabled).toBe(false);
          expect(button.getAttribute('tabindex')).toBe('0');
        });
      }));

    it('disposes ambient group synchronization effects when component tree unmounts', () =>
      scope.run(() => {
        const group = mutable({ value: 'tab-1' });
        selectionGroup.set(group);

        let btn!: ButtonAria;
        let button!: HTMLButtonElement;

        const tree = component();
        tree.run(() => {
          btn = aria('button', { value: 'tab-1' });
          button = bind(document.createElement('button'), btn);
        });

        expect(btn.current).toBe(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');

        // Unmount entire component tree
        tree.destroy();
        btn.destroy();

        // Group mutates after tree disposal -> no mutations reach detached element
        group.value = 'tab-2';
        expect(button.getAttribute('aria-pressed')).toBe('true');
      }));
  });
});
