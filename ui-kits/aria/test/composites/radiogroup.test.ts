import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { Aria, aria, type BaseElement, radioGroupCtx, type RadioGroupProps, roverCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('RadioGroup - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('renders role="radiogroup" and default vertical orientation attributes', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radio-group');
        expect(group.attributes.role).toBe('radiogroup');
        expect(group.attributes['aria-orientation']).toBe('vertical');

        const horizontalGroup = aria('radio-group', { orientation: 'horizontal' });
        expect(horizontalGroup.attributes['aria-orientation']).toBe('horizontal');

        const requiredGroup = aria('radio-group', { required: true });
        expect(requiredGroup.attributes['aria-required']).toBe('true');
      });
    }));

  it('coordinates child radios and navigates arrow keys with roving tabindex', () =>
    scope.run(() => {
      component().run(() => {
        const props = mutable<RadioGroupProps>({ value: 'opt-1' });
        const group = aria('radio-group', props);
        const groupEl = bind(document.createElement('div'), group);
        document.body.appendChild(groupEl);

        const r1 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-1' }));
        const r2 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-2' }));
        const r3 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-3' }));

        const input1 = bind(document.createElement('input'), r1);
        const input2 = bind(document.createElement('input'), r2);
        const input3 = bind(document.createElement('input'), r3);

        groupEl.appendChild(input1);
        groupEl.appendChild(input2);
        groupEl.appendChild(input3);

        expect(r1.checked).toBe(true);
        expect(r2.checked).toBe(false);
        expect(r3.checked).toBe(false);
        expect(input1.checked).toBe(true);
        expect(input2.checked).toBe(false);
        expect(input3.checked).toBe(false);

        input1.focus();

        // ArrowDown navigates and selects r2
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(downEvent);

        expect(props.value).toBe('opt-2');
        expect(r2.checked).toBe(true);
        expect(r1.checked).toBe(false);
        expect(input2.checked).toBe(true);
        expect(input1.checked).toBe(false);
        expect(document.activeElement).toBe(input2);

        // ArrowUp navigates back to r1
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(upEvent);

        expect(props.value).toBe('opt-1');
        expect(r1.checked).toBe(true);
        expect(input1.checked).toBe(true);
        expect(document.activeElement).toBe(input1);

        groupEl.remove();
      });
    }));

  it('ignores keyboard navigation when radiogroup is disabled', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radio-group', { disabled: true, value: 'opt-1' });
        const groupEl = bind(document.createElement('div'), group);
        document.body.appendChild(groupEl);

        const r1 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-1' }));
        const r2 = component().run(() => radioGroupCtx.get()!.radio({ value: 'opt-2' }));

        const input1 = bind(document.createElement('input'), r1);
        const input2 = bind(document.createElement('input'), r2);

        groupEl.appendChild(input1);
        groupEl.appendChild(input2);

        expect(input1.disabled).toBe(true);
        expect(input2.disabled).toBe(true);

        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        groupEl.dispatchEvent(downEvent);

        expect(group.properties.value).toBe('opt-1');

        groupEl.remove();
      });
    }));

  it('supports manual navigation, orientation fallback, and parent rover keydown guard', () =>
    scope.run(() => {
      component().run(() => {
        const manualGroup = aria('radio-group', { manual: true });
        const manualEl = bind(document.createElement('div'), manualGroup);
        manualEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

        delete (manualGroup.properties as Record<string, unknown>).orientation;
        expect(manualGroup.orientation).toBe('vertical');

        // Parent rover ignores keydown
        roverCtx.set(manualGroup as unknown as Aria<BaseElement>);
        const childGroup = aria('radio-group');
        const childEl = bind(document.createElement('div'), childGroup);
        childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        roverCtx.set(undefined);
      });
    }));

  it('compiles required and invalid states onto radiogroup container', () =>
    scope.run(() => {
      component().run(() => {
        const group = aria('radio-group', { required: true, invalid: true });
        expect(group.attributes['aria-required']).toBe('true');
        expect(group.attributes['aria-invalid']).toBe('true');

        const spellingGroup = aria('radio-group', { invalid: 'grammar' });
        expect(spellingGroup.attributes['aria-invalid']).toBe('grammar');

        const defaultGroup = aria('radio-group');
        expect(defaultGroup.attributes['aria-invalid']).toBeUndefined();

        const validGroup = aria('radio-group', { invalid: false });
        expect(validGroup.attributes['aria-invalid']).toBe('false');
      });
    }));

  describe('Coordinated Selection Exclusivity Invariant', () => {
    it('keeps one checked radio through pointer selection and never unchecks by re-activation', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: undefined });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const basic = component().run(() => radioGroupCtx.get()!.radio({ value: 'basic' }));
          const pro = component().run(() => radioGroupCtx.get()!.radio({ value: 'pro' }));
          const team = component().run(() => radioGroupCtx.get()!.radio({ value: 'team' }));

          const basicEl = bind(document.createElement('input'), basic);
          const proEl = bind(document.createElement('input'), pro);
          const teamEl = bind(document.createElement('input'), team);
          groupEl.append(basicEl, proEl, teamEl);

          // A group is allowed to start with nothing selected
          expect(props.value).toBeUndefined();
          expect(basic.checked).toBe(false);
          expect(basicEl.checked).toBe(false);

          proEl.click();
          expect(props.value).toBe('pro');
          expect(pro.checked).toBe(true);
          expect(proEl.checked).toBe(true);
          expect(basicEl.checked).toBe(false);
          expect(teamEl.checked).toBe(false);

          // Re-activating the holder is inert, whether or not a value is required
          proEl.click();
          expect(props.value).toBe('pro');
          expect(pro.checked).toBe(true);

          group.properties.required = true;
          proEl.click();
          expect(props.value).toBe('pro');

          // A different candidate takes the slot and vacates the previous one
          teamEl.click();
          expect(props.value).toBe('team');
          expect(pro.checked).toBe(false);
          expect(proEl.checked).toBe(false);
          expect(team.checked).toBe(true);
          expect(teamEl.getAttribute('aria-checked')).toBe('true');
          expect(proEl.getAttribute('aria-checked')).toBe('false');

          groupEl.remove();
        });
      }));

    it('writes the group value through the checked projection, not around it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: 'one' });
          const group = aria('radio-group', props);

          const one = component().run(() => radioGroupCtx.get()!.radio({ value: 'one' }));
          const two = component().run(() => radioGroupCtx.get()!.radio({ value: 'two' }));

          const oneEl = bind(document.createElement('input'), one);
          const twoEl = bind(document.createElement('input'), two);
          bind(document.createElement('div'), group).append(oneEl, twoEl);

          expect(one.checked).toBe(true);

          two.checked = true;
          expect(props.value).toBe('two');
          expect(two.checked).toBe(true);
          expect(one.checked).toBe(false);
          expect(twoEl.checked).toBe(true);
          expect(oneEl.checked).toBe(false);

          // Checking the already-selected radio through the projection is a no-op
          two.checked = true;
          expect(props.value).toBe('two');

          // A group write reaches both projections without touching either radio
          props.value = 'one';
          expect(one.checked).toBe(true);
          expect(two.checked).toBe(false);
        });
      }));
  });

  describe('Roving Focus & Linear Traversal Invariant', () => {
    it('selects as it travels on the horizontal axis and wraps in both directions', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: 'a', orientation: 'horizontal' });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const a = component().run(() => radioGroupCtx.get()!.radio({ value: 'a' }));
          const b = component().run(() => radioGroupCtx.get()!.radio({ value: 'b' }));
          const c = component().run(() => radioGroupCtx.get()!.radio({ value: 'c' }));

          const aEl = bind(document.createElement('input'), a);
          const bEl = bind(document.createElement('input'), b);
          const cEl = bind(document.createElement('input'), c);
          groupEl.append(aEl, bEl, cEl);

          aEl.focus();

          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(bEl);
          expect(props.value).toBe('b');

          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(cEl);
          expect(props.value).toBe('c');

          // Wrapping past the last candidate lands on the first and selects it
          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(aEl);
          expect(props.value).toBe('a');

          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(cEl);
          expect(props.value).toBe('c');
          expect(cEl.checked).toBe(true);

          groupEl.remove();
        });
      }));

    it('moves focus only under manual navigation and lets Space make the choice', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: 'a', manual: true });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const a = component().run(() => radioGroupCtx.get()!.radio({ value: 'a' }));
          const b = component().run(() => radioGroupCtx.get()!.radio({ value: 'b' }));

          const aEl = bind(document.createElement('input'), a);
          const bEl = bind(document.createElement('input'), b);
          groupEl.append(aEl, bEl);

          aEl.focus();

          const down = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          groupEl.dispatchEvent(down);

          // Focus travels, the selection waits
          expect(document.activeElement).toBe(bEl);
          expect(props.value).toBe('a');
          expect(b.checked).toBe(false);
          expect(down.defaultPrevented).toBe(true);

          const space = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
          bEl.dispatchEvent(space);
          expect(props.value).toBe('b');
          expect(b.checked).toBe(true);

          groupEl.remove();
        });
      }));

    it('skips a disabled candidate during traversal and refuses its selection', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: 'first' });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);
          document.body.appendChild(groupEl);

          const first = component().run(() => radioGroupCtx.get()!.radio({ value: 'first' }));
          const second = component().run(() => radioGroupCtx.get()!.radio({ value: 'second', disabled: true }));
          const third = component().run(() => radioGroupCtx.get()!.radio({ value: 'third' }));

          const firstEl = bind(document.createElement('input'), first);
          const secondEl = bind(document.createElement('input'), second);
          const thirdEl = bind(document.createElement('input'), third);
          groupEl.append(firstEl, secondEl, thirdEl);

          firstEl.focus();

          groupEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(document.activeElement).toBe(thirdEl);
          expect(props.value).toBe('third');
          expect(secondEl.checked).toBe(false);

          // The disabled candidate cannot be chosen directly either
          secondEl.click();
          expect(props.value).toBe('third');
          expect(second.checked).toBe(false);

          groupEl.remove();
        });
      }));
  });

  describe('Form Host Boundary & Name Registry Invariant', () => {
    it('keeps the field name out of the compiled projection while one value is submitted', () =>
      scope.run(() => {
        component().run(() => {
          const form = document.createElement('form');
          document.body.appendChild(form);

          const props = mutable<RadioGroupProps>({ value: undefined, name: 'plan' });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);
          form.appendChild(groupEl);

          const basic = component().run(() => radioGroupCtx.get()!.radio({ value: 'basic', name: 'plan' }));
          const pro = component().run(() => radioGroupCtx.get()!.radio({ value: 'pro', name: 'plan' }));

          // The projection stays accessibility metadata; identity lives on props
          expect(group.attributes.name).toBeUndefined();
          expect(basic.attributes.name).toBeUndefined();
          expect(basic.attributes.value).toBeUndefined();
          expect(basic.properties.name).toBe('plan');
          expect(basic.properties.value).toBe('basic');

          const basicEl = bind(document.createElement('input'), basic);
          const proEl = bind(document.createElement('input'), pro);
          basicEl.name = String(basic.properties.name);
          basicEl.value = String(basic.properties.value);
          proEl.name = String(pro.properties.name);
          proEl.value = String(pro.properties.value);
          groupEl.append(basicEl, proEl);

          expect(new FormData(form).get('plan')).toBeNull();

          proEl.click();
          expect(new FormData(form).getAll('plan')).toEqual(['pro']);

          basicEl.click();
          expect(new FormData(form).getAll('plan')).toEqual(['basic']);

          form.remove();
        });
      }));

    it('reflects constraint state on the group element as it changes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<RadioGroupProps>({ value: undefined, required: false });
          const group = aria('radio-group', props);
          const groupEl = bind(document.createElement('div'), group);

          expect(groupEl.getAttribute('role')).toBe('radiogroup');
          expect(groupEl.getAttribute('aria-required')).toBe('false');

          props.required = true;
          expect(groupEl.getAttribute('aria-required')).toBe('true');

          props.invalid = 'grammar';
          expect(groupEl.getAttribute('aria-invalid')).toBe('grammar');

          // The container is never itself a choice
          expect(groupEl.hasAttribute('aria-checked')).toBe(false);
          expect(groupEl.hasAttribute('aria-valuenow')).toBe(false);

          props.invalid = false;
          expect(groupEl.getAttribute('aria-invalid')).toBe('false');
        });
      }));
  });
});
