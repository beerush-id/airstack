import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
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
          expect(radio.attributes.tabindex).toBe(0);
          expect(radio.attributes.disabled).toBe(false);
          expect(radio.attributes['aria-disabled']).toBe('false');
          expect(radio.attributes.checked).toBe(false);
          expect(radio.attributes['aria-checked']).toBeUndefined();

          // 2. Mount Phase: framework element binding
          const input = bind(document.createElement('input'), radio);
          expect(radio.current).toBe(input);
          expect(radio.isNative).toBe(true);
          expect(input.getAttribute('role')).toBeNull();
          expect(input.getAttribute('tabindex')).toBe('0');
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
          expect(radio.attributes.tabindex).toBe(-1);
          expect(radio.attributes['aria-disabled']).toBe('true');

          // 2. Mount Phase
          const input = bind(document.createElement('input'), radio);
          expect(input.disabled).toBe(true);
          expect(input.getAttribute('tabindex')).toBe('-1');
          expect(input.getAttribute('aria-disabled')).toBe('true');

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

    it('coordinates named property keys on group record', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const settings = mutable<{ value: { plan: string } }>({ value: { plan: 'free' } });
          selectionGroup.set(settings);

          const free = aria('radio', { name: 'plan', value: 'free' });
          const paid = aria('radio', { name: 'plan', value: 'paid' });

          expect(free.checked).toBe(true);
          expect(paid.checked).toBe(false);

          const paidEl = bind(document.createElement('input'), paid);
          paidEl.click();

          expect(settings.value.plan).toBe('paid');
          expect(free.checked).toBe(false);
          expect(paid.checked).toBe(true);
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
          expect(r.attributes.tabindex).toBe(-1);
          expect(r.attributes['aria-disabled']).toBe('true');
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
        selectionGroup.set(group);

        let radio!: RadioAria;
        let input!: HTMLInputElement;

        const tree = component();
        tree.run(() => {
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
});
