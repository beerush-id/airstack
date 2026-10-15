import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type RadioAria, type RadioProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Radio - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Native Radio Input Contract', () => {
    it('follows SSR -> Mount -> Interaction -> Disposal lifecycle for native radio inputs', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria('radio', { checked: false, value: 'opt-1' });

          // 1. SSR Phase: deterministic attributes for native input
          expect(radio.current).toBeNull();
          expect(radio.checked).toBe(false);
          expect(radio.isNative).toBe(true);
          expect(radio.attributes.role).toBeUndefined();
          expect(radio.attributes.type).toBe('radio');
          expect(radio.attributes.tabindex).toBeUndefined();
          expect(radio.attributes.disabled).toBe(false);
          expect(radio.attributes['aria-disabled']).toBeUndefined();
          expect(radio.attributes.checked).toBe(false);
          expect(radio.attributes['aria-checked']).toBeUndefined();

          // 2. Mount Phase: framework element binding
          const input = bind(document.createElement('input'), radio);
          expect(radio.current).toBe(input);
          expect(radio.isNative).toBe(true);
          expect(input.getAttribute('role')).toBeNull();
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.checked).toBe(false);

          // 3. Interaction Phase: user clicks to select
          input.click();
          expect(radio.checked).toBe(true);
          expect(radio.attributes.checked).toBe(true);
          expect(input.checked).toBe(true);

          // Subsequent click does NOT uncheck (non-toggleable single-select)
          input.click();
          expect(radio.checked).toBe(true);
          expect(radio.attributes.checked).toBe(true);
          expect(input.checked).toBe(true);

          // 4. Disposal Phase
          radio.destroy();
          expect(radio.current).toBeNull();

          // Mutating state after destruction causes zero DOM side effects
          radio.checked = false;
          expect(input.checked).toBe(true);
        });
      }));

    it('delegates keyboard navigation directly to browser for native radio inputs', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria('radio');
          const input = bind(document.createElement('input'), radio);

          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
          input.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);
        });
      }));
  });

  describe('Custom Element Pure ARIA Contract', () => {
    it('supports custom elements (e.g. <div>) via pure ARIA polyfill without throwing', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria<HTMLDivElement>('radio', { checked: false, value: 'custom-1' }, { native: false });

          // 1. SSR Phase: pure ARIA
          expect(radio.current).toBeNull();
          expect(radio.isNative).toBe(false);
          expect(radio.attributes.role).toBe('radio');
          expect(radio.attributes.type).toBeUndefined();
          expect(radio.attributes.checked).toBeUndefined();
          expect(radio.attributes['aria-checked']).toBe('false');

          // 2. Mount Phase
          const div = bind(document.createElement('div'), radio);
          expect(radio.current).toBe(div);
          expect(radio.isNative).toBe(false);
          expect(div.getAttribute('role')).toBe('radio');
          expect(div.getAttribute('aria-checked')).toBe('false');

          // 3. Interaction Phase: click selects radio
          div.click();
          expect(radio.checked).toBe(true);
          expect(radio.attributes['aria-checked']).toBe('true');
          expect(div.getAttribute('aria-checked')).toBe('true');

          // Subsequent click keeps radio selected
          div.click();
          expect(radio.checked).toBe(true);
          expect(radio.attributes['aria-checked']).toBe('true');
          expect(div.getAttribute('aria-checked')).toBe('true');

          // 4. Disposal Phase
          radio.destroy();
          expect(radio.current).toBeNull();

          radio.checked = false;
          expect(div.getAttribute('aria-checked')).toBe('true');
        });
      }));

    it('prevents default scroll on Space keydown and activates on Space keyup for custom elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria<HTMLDivElement>('radio', { checked: false }, { native: false });
          const div = bind(document.createElement('div'), radio);

          // Space keydown suppresses scroll
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(radio.checked).toBe(false);

          // Space keyup selects
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceUp);
          expect(radio.checked).toBe(true);
          expect(div.getAttribute('aria-checked')).toBe('true');
        });
      }));
  });

  describe('Disabled State Contract', () => {
    it('follows SSR -> Mount -> Interaction lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria('radio', { disabled: true, checked: false });

          // 1. SSR Phase
          expect(radio.disabled).toBe(true);
          expect(radio.attributes.disabled).toBe(true);
          expect(radio.attributes.tabindex).toBeUndefined();
          expect(radio.attributes['aria-disabled']).toBeUndefined();

          // 2. Mount Phase
          const input = bind(document.createElement('input'), radio);
          expect(input.disabled).toBe(true);
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.getAttribute('aria-disabled')).toBeNull();

          // 3. Interaction Phase: click rejected
          input.click();
          expect(radio.checked).toBe(false);
          expect(input.checked).toBe(false);

          radio.destroy();
        });
      }));
  });

  describe('Forwarded Reactive Props Contract', () => {
    it('tracks forwarded props across SSR -> Mount -> Interaction and syncs user clicks back to props', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<RadioProps>({ disabled: false, checked: false });
          const radio = aria('radio', props);

          // 1. SSR Phase
          expect(radio.current).toBeNull();
          expect(radio.attributes.disabled).toBe(false);
          expect(radio.attributes.checked).toBe(false);

          // 2. Mount Phase
          const input = bind(document.createElement('input'), radio);
          expect(radio.current).toBe(input);
          expect(input.disabled).toBe(false);
          expect(input.checked).toBe(false);

          // 3. Interaction Phase: parent mutates forwarded props -> element updates
          props.disabled = true;
          expect(radio.disabled).toBe(true);
          expect(input.disabled).toBe(true);

          props.disabled = false;
          props.checked = true;
          expect(radio.disabled).toBe(false);
          expect(input.disabled).toBe(false);
          expect(input.checked).toBe(true);

          // User clicks updates forwarded props directly
          input.click();
          expect(props.checked).toBe(true);
          expect(radio.checked).toBe(true);
          expect(input.checked).toBe(true);

          radio.destroy();
        });
      }));
  });

  describe('Group Coordination Contract', () => {
    it('coordinates single-selection among sibling radios inside selectionGroup', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable<{ value: string }>({ value: 'starter' });
          selectionGroup.set(group);

          const starter = aria('radio', { value: 'starter' });
          const pro = aria('radio', { value: 'pro' });
          const enterprise = aria('radio', { value: 'enterprise' });

          // 1. SSR Phase: starter is selected from group.value
          expect(starter.checked).toBe(true);
          expect(pro.checked).toBe(false);
          expect(enterprise.checked).toBe(false);
          expect(starter.attributes.checked).toBe(true);
          expect(pro.attributes.checked).toBe(false);

          // 2. Mount Phase
          const starterEl = bind(document.createElement('input'), starter);
          const proEl = bind(document.createElement('input'), pro);
          const enterpriseEl = bind(document.createElement('input'), enterprise);

          expect(starterEl.checked).toBe(true);
          expect(proEl.checked).toBe(false);
          expect(enterpriseEl.checked).toBe(false);

          // 3. Interaction Phase: user selects 'pro'
          proEl.click();
          expect(group.value).toBe('pro');
          expect(starter.checked).toBe(false);
          expect(pro.checked).toBe(true);
          expect(enterprise.checked).toBe(false);
          expect(starterEl.checked).toBe(false);
          expect(proEl.checked).toBe(true);

          // Clicking 'pro' again maintains selection (never deselects)
          proEl.click();
          expect(group.value).toBe('pro');
          expect(pro.checked).toBe(true);
          expect(proEl.checked).toBe(true);

          // User selects 'enterprise'
          enterpriseEl.click();
          expect(group.value).toBe('enterprise');
          expect(starter.checked).toBe(false);
          expect(pro.checked).toBe(false);
          expect(enterprise.checked).toBe(true);
          expect(enterpriseEl.checked).toBe(true);
        });
      }));

    it('manages roving tabindex for custom elements within a group', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable<{ value: string }>({ value: 'opt-1' });
          selectionGroup.set(group);

          const r1 = aria<HTMLDivElement>('radio', { value: 'opt-1' }, { native: false });
          const r2 = aria<HTMLDivElement>('radio', { value: 'opt-2' }, { native: false });

          // Selected radio has tabindex 0, unselected has -1
          expect(r1.attributes.tabindex).toBe(0);
          expect(r2.attributes.tabindex).toBe(-1);

          r2.select();
          expect(r1.attributes.tabindex).toBe(-1);
          expect(r2.attributes.tabindex).toBe(0);
        });
      }));

    it('cascades group disablement to member radios', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ disabled: true, value: 'a' });
          selectionGroup.set(group);

          const r = aria('radio', { value: 'a' });
          expect(r.disabled).toBe(true);
          expect(r.attributes.disabled).toBe(true);
          expect(r.attributes.tabindex).toBeUndefined();
          expect(r.attributes['aria-disabled']).toBeUndefined();
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('ceases DOM mutations when radio is destroyed and group subsequently mutates', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'item-1' });
          selectionGroup.set(group);

          const radio = aria('radio', { value: 'item-1' });
          const input = bind(document.createElement('input'), radio);

          expect(input.checked).toBe(true);

          radio.destroy();
          expect(radio.current).toBeNull();

          group.value = 'item-2';
          expect(input.checked).toBe(true);
        });
      }));

    it('disposes ambient group synchronization effects when component tree unmounts', () =>
      scope.run(() => {
        const group = mutable({ value: 'item-1' });

        let radio!: RadioAria;
        let input!: HTMLInputElement;

        const tree = component();
        tree.run(() => {
          selectionGroup.set(group);
          radio = aria('radio', { value: 'item-1' });
          input = bind(document.createElement('input'), radio);
        });

        expect(input.checked).toBe(true);

        tree.destroy();
        radio.destroy();

        group.value = 'item-2';
        expect(input.checked).toBe(true);
      }));
  });

  describe('Selection Exclusivity & State Inversion Invariant', () => {
    it('re-derives every member from one external registry write and refuses to toggle the holder', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const rA = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const rB = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const rC = aria<HTMLDivElement>('radio', { value: 'c' }, { native: false });

          const elA = bind(document.createElement('div'), rA);
          const elB = bind(document.createElement('div'), rB);
          const elC = bind(document.createElement('div'), rC);

          expect(elA.getAttribute('aria-checked')).toBe('true');
          expect(elC.getAttribute('aria-checked')).toBe('false');
          expect(elA.getAttribute('tabindex')).toBe('0');

          // The registry, not any member, owns the slot: one write moves all three
          group.value = 'c';

          expect(rA.checked).toBe(false);
          expect(rC.checked).toBe(true);
          expect(elA.getAttribute('aria-checked')).toBe('false');
          expect(elC.getAttribute('aria-checked')).toBe('true');
          expect(elA.getAttribute('tabindex')).toBe('-1');
          expect(elC.getAttribute('tabindex')).toBe('0');
          expect(elB.getAttribute('aria-checked')).toBe('false');

          // A radio is never a toggle: re-activating the holder keeps it, required or not
          elC.click();
          expect(group.value).toBe('c');
          expect(elC.getAttribute('aria-checked')).toBe('true');

          group.required = true;
          elC.click();
          expect(group.value).toBe('c');
          expect(rC.checked).toBe(true);

          rA.destroy();
          rB.destroy();
          rC.destroy();
          expect(rC.current).toBeNull();
        });
      }));

    it('owns Space only: arrows belong to the group and Enter is not a radio affordance', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: undefined });
          selectionGroup.set(group);

          const radio = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });
          const el = bind(document.createElement('div'), radio);

          for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            el.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
          }

          expect(group.value).toBeUndefined();
          expect(radio.checked).toBe(false);

          // Enter activates a button, not a radio: the spec names Space alone
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enter);
          expect(group.value).toBeUndefined();
          expect(radio.checked).toBe(false);

          // One press, one selection
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(group.value).toBe('b');
          expect(el.getAttribute('aria-checked')).toBe('true');

          radio.destroy();
          expect(radio.current).toBeNull();
        });
      }));
  });

  describe('Form Control Boundary & Host Parity Invariant', () => {
    it('submits one value through the author-bound field name while the dictionary stays ARIA-only', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          document.body.appendChild(form);

          const group = mutable({ value: 'starter' });
          selectionGroup.set(group);

          const rA = aria('radio', { name: 'plan', value: 'starter' });
          const rB = aria('radio', { name: 'plan', value: 'pro' });

          // The identity keys stay on props for template binding, never in the projection
          expect(rA.properties.name).toBe('plan');
          expect(rA.properties.value).toBe('starter');
          expect(rA.attributes.name).toBeUndefined();
          expect(rA.attributes.value).toBeUndefined();
          expect(rA.attributes.form).toBeUndefined();

          const elA = bind(document.createElement('input'), rA);
          const elB = bind(document.createElement('input'), rB);
          elA.name = rA.properties.name;
          elA.value = String(rA.properties.value);
          elB.name = rB.properties.name;
          elB.value = String(rB.properties.value);
          form.appendChild(elA);
          form.appendChild(elB);

          // The derived selection is already a submission candidate through the author binding
          expect(new FormData(form).getAll('plan')).toEqual(['starter']);

          // Selecting through the group moves the single value the field submits
          elB.click();
          expect(group.value).toBe('pro');
          expect(new FormData(form).getAll('plan')).toEqual(['pro']);

          elA.click();
          expect(new FormData(form).getAll('plan')).toEqual(['starter']);

          rA.destroy();
          rB.destroy();
          document.body.removeChild(form);
        });
      }));

    it('reports one registry state through the property on a native host and ARIA on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'x' });
          selectionGroup.set(group);

          const nativeRadio = aria('radio', { value: 'x' }, { native: true });
          const customRadio = aria<HTMLDivElement>('radio', { value: 'x' }, { native: false });

          const input = bind(document.createElement('input'), nativeRadio);
          const div = bind(document.createElement('div'), customRadio);

          expect(input.checked).toBe(true);
          expect(input.hasAttribute('aria-checked')).toBe(false);
          expect(input.hasAttribute('role')).toBe(false);
          expect(div.getAttribute('aria-checked')).toBe('true');
          expect(div.getAttribute('role')).toBe('radio');

          group.value = 'y';

          expect(input.checked).toBe(false);
          expect(div.getAttribute('aria-checked')).toBe('false');
          expect(div.getAttribute('tabindex')).toBe('-1');
          expect(nativeRadio.attributes.checked).toBe(false);
          expect(customRadio.attributes['aria-checked']).toBe('false');

          nativeRadio.destroy();
          customRadio.destroy();
          expect(nativeRadio.current).toBeNull();
          expect(customRadio.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('refuses activation on a custom host declared disabled and re-arms without rebinding', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const radio = aria<HTMLDivElement>('radio', { value: 'b', disabled: true }, { native: false });

          // 1. Creation & SSR
          expect(radio.disabled).toBe(true);
          expect(radio.attributes.role).toBe('radio');
          expect(radio.attributes['aria-disabled']).toBe('true');
          expect(radio.attributes.tabindex).toBe(-1);

          // 2. DOM Binding
          const el = bind(document.createElement('div'), radio);
          expect(el.getAttribute('tabindex')).toBe('-1');

          // 3/4. Neither a full Space press nor a click reaches the registry
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          el.click();

          expect(group.value).toBe('a');
          expect(radio.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 5. Clearing the comparator restores reachability and activation on the same node
          radio.assign({ disabled: false });
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.click();
          expect(group.value).toBe('b');
          expect(el.getAttribute('aria-checked')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          radio.destroy();
          expect(radio.current).toBeNull();
        });
      }));

    it('cascades group disablement over custom members while the registry stays exclusive', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a', disabled: true });
          selectionGroup.set(group);

          const rA = aria<HTMLDivElement>('radio', { value: 'a' }, { native: false });
          const rB = aria<HTMLDivElement>('radio', { value: 'b' }, { native: false });

          const elA = bind(document.createElement('div'), rA);
          const elB = bind(document.createElement('div'), rB);

          // Every member inherits the comparator and leaves the tab order
          expect(rA.disabled).toBe(true);
          expect(rB.disabled).toBe(true);
          expect(elA.getAttribute('aria-disabled')).toBe('true');
          expect(elB.getAttribute('tabindex')).toBe('-1');

          elB.click();
          expect(group.value).toBe('a');
          expect(elB.getAttribute('aria-checked')).toBe('false');

          // Lifting the cascade leaves the holder intact and re-arms the challenger
          group.disabled = false;
          expect(elB.getAttribute('aria-disabled')).toBe('false');

          elB.click();
          expect(group.value).toBe('b');
          expect(elB.getAttribute('aria-checked')).toBe('true');
          expect(elA.getAttribute('aria-checked')).toBe('false');
          expect(elA.getAttribute('tabindex')).toBe('-1');
          expect(elB.getAttribute('tabindex')).toBe('0');

          // A member disabled while holding the selection keeps the value but cannot be re-activated
          rB.assign({ disabled: true });
          elB.click();
          expect(group.value).toBe('b');
          expect(elB.getAttribute('aria-checked')).toBe('true');

          // The enabled sibling can still take it away, because exclusivity outranks the hold
          elA.click();
          expect(group.value).toBe('a');
          expect(elB.getAttribute('aria-checked')).toBe('false');

          rA.destroy();
          rB.destroy();
        });
      }));

    it('cancels and contains every activation event on a custom host declared disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const radio = aria<HTMLDivElement>(
            'radio',
            { value: 'a', checked: true, disabled: true },
            { native: false }
          );

          const reached: string[] = [];
          const wrapper = document.createElement('div');
          wrapper.addEventListener('click', () => reached.push('click'));
          wrapper.addEventListener('keydown', () => reached.push('keydown'));
          wrapper.addEventListener('keyup', () => reached.push('keyup'));
          const el = bind(document.createElement('div'), radio);
          wrapper.append(el);

          const click = new MouseEvent('click', { cancelable: true, bubbles: true });
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });

          el.dispatchEvent(click);
          el.dispatchEvent(spaceDown);
          el.dispatchEvent(spaceUp);
          el.dispatchEvent(enterDown);

          expect(click.defaultPrevented).toBe(true);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(spaceUp.defaultPrevented).toBe(true);
          expect(enterDown.defaultPrevented).toBe(true);
          expect(reached).toEqual([]);
          expect(radio.checked).toBe(true);

          radio.destroy();
        });
      }));
  });
});
