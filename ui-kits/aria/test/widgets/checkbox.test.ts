import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type CheckboxAria, type CheckboxProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Checkbox - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Two-State Boolean Contract', () => {
    it('follows SSR -> Mount -> Interaction -> Disposal lifecycle for native checkboxes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria('checkbox', { checked: false }, { native: true });

          // 1. SSR Phase: pre-mount deterministic compilation
          expect(cb.current).toBeNull();
          expect(cb.checked).toBe(false);
          expect(cb.isNative).toBe(true);
          expect(cb.attributes.tabindex).toBeUndefined();
          expect(cb.attributes.type).toBe('checkbox');
          expect(cb.attributes.disabled).toBe(false);
          expect(cb.attributes['aria-disabled']).toBeUndefined();
          expect(cb.attributes.checked).toBe(false);

          // 2. Mount Phase: framework element binding
          const input = bind(document.createElement('input'), cb);
          expect(cb.current).toBe(input);
          expect(cb.isNative).toBe(true);
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.checked).toBe(false);

          // 3. Interaction Phase: user clicks to check
          input.click();
          expect(cb.checked).toBe(true);
          expect(cb.attributes.checked).toBe(true);
          expect(input.checked).toBe(true);

          // User clicks to uncheck
          input.click();
          expect(cb.checked).toBe(false);
          expect(cb.attributes.checked).toBe(false);
          expect(input.checked).toBe(false);

          // 4. Disposal Phase: tears down without causing side effects
          cb.destroy();
          expect(cb.current).toBeNull();

          // Subsequent state mutations cause zero side effects on the unmounted node
          cb.checked = true;
          expect(input.checked).toBe(false);
        });
      }));

    it('follows SSR -> Mount -> Interaction -> Disposal lifecycle for custom element checkboxes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { checked: false }, { native: false });

          // 1. SSR Phase: pure ARIA
          expect(cb.current).toBeNull();
          expect(cb.isNative).toBe(false);
          expect(cb.attributes.role).toBe('checkbox');
          expect(cb.attributes.type).toBeUndefined();
          expect(cb.attributes.checked).toBeUndefined();
          expect(cb.attributes['aria-checked']).toBe('false');

          // 2. Mount Phase
          const div = bind(document.createElement('div'), cb);
          expect(cb.current).toBe(div);
          expect(cb.isNative).toBe(false);
          expect(div.getAttribute('role')).toBe('checkbox');
          expect(div.getAttribute('aria-checked')).toBe('false');

          // 3. Interaction Phase
          div.click();
          expect(cb.checked).toBe(true);
          expect(div.getAttribute('aria-checked')).toBe('true');

          div.click();
          expect(cb.checked).toBe(false);
          expect(div.getAttribute('aria-checked')).toBe('false');

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();

          cb.checked = true;
          expect(div.getAttribute('aria-checked')).toBe('false');
        });
      }));
  });

  describe('Tri-State / Indeterminate Contract', () => {
    it('synchronizes native input.indeterminate property across lifecycle for native checkboxes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria('checkbox', { indeterminate: true, checked: false }, { native: true });

          // 1. SSR Phase: native uses indeterminate attribute/property
          expect(cb.current).toBeNull();
          expect(cb.properties.indeterminate).toBe(true);
          expect(cb.attributes.indeterminate).toBe(true);
          expect(cb.attributes['aria-checked']).toBeUndefined();

          // 2. Mount Phase: reflects native input.indeterminate property
          const input = bind(document.createElement('input'), cb);
          expect(cb.current).toBe(input);
          expect(input.indeterminate).toBe(true);

          // 3. Interaction Phase: clicking an indeterminate checkbox checks it and clears native mixed state
          input.click();
          expect(cb.checked).toBe(true);
          expect(cb.properties.indeterminate).toBe(false);
          expect(input.checked).toBe(true);
          expect(input.indeterminate).toBe(false);

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('synchronizes aria-checked="mixed" for custom element checkboxes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable({ indeterminate: true, checked: false });
          const cb = aria<HTMLDivElement>('checkbox', props, { native: false });

          // 1. SSR Phase: custom element uses pure aria-checked="mixed"
          expect(cb.current).toBeNull();
          expect(cb.properties.indeterminate).toBe(true);
          expect(cb.indeterminate).toBe(true);
          expect(cb.attributes['aria-checked']).toBe('mixed');
          expect(cb.attributes.indeterminate).toBeUndefined();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), cb);
          expect(cb.current).toBe(div);
          expect(div.getAttribute('aria-checked')).toBe('mixed');

          // 3. Interaction Phase: clicking an indeterminate checkbox checks it and clears mixed state
          div.click();
          expect(cb.checked).toBe(true);
          expect(cb.properties.indeterminate).toBe(false);
          expect(cb.indeterminate).toBe(false);
          expect(div.getAttribute('aria-checked')).toBe('true');

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Disabled State Contract', () => {
    it('follows SSR -> Mount -> Interaction lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria('checkbox', { disabled: true, checked: false });

          // 1. SSR Phase
          expect(cb.current).toBeNull();
          expect(cb.disabled).toBe(true);
          expect(cb.attributes.disabled).toBe(true);
          expect(cb.attributes.tabindex).toBeUndefined();
          expect(cb.attributes['aria-disabled']).toBeUndefined();

          // 2. Mount Phase
          const input = bind(document.createElement('input'), cb);
          expect(cb.current).toBe(input);
          expect(input.disabled).toBe(true);
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.getAttribute('aria-disabled')).toBeNull();

          // 3. Interaction Phase: click is rejected
          input.click();
          expect(cb.checked).toBe(false);
          expect(input.checked).toBe(false);

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Forwarded Reactive Props Contract', () => {
    it('tracks forwarded props across SSR -> Mount -> Interaction and syncs user clicks back to props', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<CheckboxProps>({ disabled: false, checked: false });
          const cb = aria('checkbox', props);

          // 1. SSR Phase
          expect(cb.current).toBeNull();
          expect(cb.attributes.disabled).toBe(false);
          expect(cb.attributes.checked).toBe(false);

          // 2. Mount Phase
          const input = bind(document.createElement('input'), cb);
          expect(cb.current).toBe(input);
          expect(input.disabled).toBe(false);
          expect(input.checked).toBe(false);

          // 3. Interaction Phase: parent mutates forwarded props -> element updates
          props.disabled = true;
          expect(cb.disabled).toBe(true);
          expect(input.disabled).toBe(true);
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.getAttribute('aria-disabled')).toBeNull();

          // Parent re-enables and updates checked
          props.disabled = false;
          props.checked = true;
          expect(cb.disabled).toBe(false);
          expect(input.disabled).toBe(false);
          expect(input.getAttribute('tabindex')).toBeNull();
          expect(input.checked).toBe(true);

          // User interaction mutates the forwarded props directly
          input.click();
          expect(props.checked).toBe(false);
          expect(cb.checked).toBe(false);
          expect(input.checked).toBe(false);

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();

          props.checked = true;
          expect(input.checked).toBe(false);
        });
      }));
  });

  describe('Keyboard Activation Contract', () => {
    it('prevents default scroll on Space keydown and toggles on Space keyup for non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });

          // 1. SSR Phase: attributes omit event handlers
          expect(cb.current).toBeNull();
          expect(cb.attributes.onkeydown).toBeUndefined();
          expect(cb.attributes.onkeyup).toBeUndefined();

          // 2. Mount Phase
          const div = bind(document.createElement('div'), cb);
          expect(cb.current).toBe(div);

          // 3. Interaction Phase
          // Space keydown: suppresses scroll without toggling
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);
          expect(cb.checked).toBe(false);

          // Space keyup: activates via click
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true });
          div.dispatchEvent(spaceUp);
          expect(cb.checked).toBe(true);
          expect(div.getAttribute('aria-checked')).toBe('true');

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('delegates keyboard navigation directly to the browser for native <input type="checkbox">', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria('checkbox');

          // 1. SSR Phase
          expect(cb.current).toBeNull();

          // 2. Mount Phase
          const input = bind(document.createElement('input'), cb);
          expect(cb.isNative).toBe(true);

          // 3. Interaction Phase: native inputs leave defaultPrevented to false
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
          input.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(false);

          // 4. Disposal Phase
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });

  describe('Group Coordination Contract', () => {
    it('toggles array membership across SSR -> Mount -> Interaction for multi-select groups', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['newsletter'], multiple: true });
          selectionGroup.set(group);

          const newsCb = aria('checkbox', { value: 'newsletter' });
          const promosCb = aria('checkbox', { value: 'promos' });

          // 1. SSR Phase: pre-compiled from group array
          expect(newsCb.current).toBeNull();
          expect(promosCb.current).toBeNull();
          expect(newsCb.attributes.checked).toBe(true);
          expect(promosCb.attributes.checked).toBe(false);

          // 2. Mount Phase
          const newsEl = bind(document.createElement('input'), newsCb);
          const promosEl = bind(document.createElement('input'), promosCb);
          expect(newsEl.checked).toBe(true);
          expect(promosEl.checked).toBe(false);

          // 3. Interaction Phase: user checks promos
          promosEl.click();
          expect(group.value).toEqual(['newsletter', 'promos']);
          expect(promosEl.checked).toBe(true);

          // User unchecks newsletter
          newsEl.click();
          expect(group.value).toEqual(['promos']);
          expect(newsEl.checked).toBe(false);

          // 4. Disposal Phase
          newsCb.destroy();
          promosCb.destroy();
          expect(newsCb.current).toBeNull();
          expect(promosCb.current).toBeNull();
        });
      }));

    it('cascades group disablement to member checkboxes across SSR -> Mount -> Interaction', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['item-1'], multiple: true, disabled: true });
          selectionGroup.set(group);

          const cb = aria('checkbox', { value: 'item-1' });

          // 1. SSR Phase
          expect(cb.disabled).toBe(true);
          expect(cb.attributes.disabled).toBe(true);
          expect(cb.attributes.tabindex).toBeUndefined();
          expect(cb.attributes['aria-disabled']).toBeUndefined();

          // 2. Mount Phase
          const input = bind(document.createElement('input'), cb);
          expect(input.disabled).toBe(true);
          expect(input.getAttribute('tabindex')).toBeNull();

          // 3. Interaction Phase: click rejected
          input.click();
          expect(group.value).toEqual(['item-1']);

          // 4. Disposal Phase
          cb.destroy();
        });
      }));
  });

  describe('Disposal & Lifecycle Teardown Contract', () => {
    it('ceases DOM mutations when checkbox is destroyed and group subsequently mutates', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['item-1'], multiple: true, disabled: false });
          selectionGroup.set(group);

          const cb = aria('checkbox', { value: 'item-1' });
          const input = bind(document.createElement('input'), cb);

          expect(cb.current).toBe(input);
          expect(input.checked).toBe(true);
          expect(input.disabled).toBe(false);

          // Checkbox destroyed
          cb.destroy();
          expect(cb.current).toBeNull();

          // Group mutates afterwards -> detached DOM element causes zero side effects
          group.value = ['item-2'];
          group.disabled = true;
          expect(input.checked).toBe(true);
          expect(input.disabled).toBe(false);
          expect(input.getAttribute('tabindex')).toBeNull();
        });
      }));

    it('disposes ambient group synchronization effects when component tree unmounts', () =>
      scope.run(() => {
        const group = mutable({ value: ['item-1'], multiple: true });

        let cb!: CheckboxAria;
        let input!: HTMLInputElement;

        const tree = component();
        tree.run(() => {
          // Published inside the tree so no ambient group leaks into later tests
          selectionGroup.set(group);
          cb = aria('checkbox', { value: 'item-1' }) as CheckboxAria;
          input = bind(document.createElement('input'), cb);
        });

        expect(cb.current).toBe(input);
        expect(input.checked).toBe(true);

        // Unmount entire component tree
        tree.destroy();
        cb.destroy();

        // Group mutates after tree disposal -> no mutations reach detached element
        group.value = ['item-2'];
        expect(input.checked).toBe(true);
      }));
  });

  describe('Validation & Invalid State Contract', () => {
    it('compiles required and invalid states for native and custom checkboxes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          // Native checkbox
          const nativeCb = aria('checkbox', { required: true, invalid: true }, { native: true });
          expect(nativeCb.attributes.required).toBe(true);
          expect(nativeCb.attributes['aria-invalid']).toBe('true');

          // Custom element checkbox
          const customCb = aria('checkbox', { required: true, invalid: 'spelling' }, { native: false });
          expect(customCb.attributes['aria-required']).toBe('true');
          expect(customCb.attributes['aria-invalid']).toBe('spelling');

          // Default state omits aria-invalid
          const defaultCb = aria('checkbox');
          expect(defaultCb.attributes['aria-invalid']).toBeUndefined();

          // Explicit false compiles to string 'false'
          const validCb = aria('checkbox', { invalid: false });
          expect(validCb.attributes['aria-invalid']).toBe('false');
        });
      }));
  });

  describe('Tri-State & Value Inversion Invariant', () => {
    it('inverts exactly once per Space press and never inverts on Enter on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });

          // 1. Creation & SSR
          expect(cb.current).toBeNull();
          expect(cb.checked).toBe(false);
          expect(cb.attributes.role).toBe('checkbox');
          expect(cb.attributes['aria-checked']).toBe('false');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), cb);
          expect(cb.current).toBe(el);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 3/4. Enter is not a checkbox affordance: the polyfill declares Space only
          const enterDown = new KeyboardEvent('keydown', {
            key: 'Enter',
            cancelable: true,
            bubbles: true,
          });
          el.dispatchEvent(enterDown);
          expect(cb.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // Key repeat delivers many keydowns and one keyup: a single inversion
          for (let repeat = 0; repeat < 3; repeat += 1) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          }
          expect(cb.checked).toBe(false);

          // 5. Reconciliation: state, projection and props move together
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(cb.checked).toBe(true);
          expect(cb.properties.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('resolves mixed to checked through both the pointer and keyboard paths on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { indeterminate: true }, { native: false });

          // 1. Creation & SSR: mixed outranks the unchecked value
          expect(cb.indeterminate).toBe(true);
          expect(cb.checked).toBe(false);
          expect(cb.attributes['aria-checked']).toBe('mixed');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), cb);
          expect(el.getAttribute('aria-checked')).toBe('mixed');

          // 3/4. Pointer path: activation toward checked clears mixed
          el.click();
          expect(cb.checked).toBe(true);
          expect(cb.indeterminate).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // 5. Re-entering mixed live, then resolving through the keyboard path
          cb.assign({ indeterminate: true });
          expect(cb.attributes['aria-checked']).toBe('mixed');
          expect(el.getAttribute('aria-checked')).toBe('mixed');

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(cb.checked).toBe(true);
          expect(cb.indeterminate).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('keeps native mixed state on the IDL property and never projects aria-checked', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria('checkbox', { checked: false }, { native: true });

          // 1. Creation & SSR
          expect(cb.attributes['aria-checked']).toBeUndefined();
          expect(cb.attributes.checked).toBe(false);

          // 2. DOM Binding
          const input = bind(document.createElement('input'), cb);
          expect(input.indeterminate).toBe(false);
          expect(input.hasAttribute('aria-checked')).toBe(false);

          // 3/5. Mixed assigned after mount reaches the property, not the attribute
          cb.assign({ indeterminate: true });
          expect(cb.indeterminate).toBe(true);
          expect(input.indeterminate).toBe(true);
          expect(input.checked).toBe(false);
          expect(input.hasAttribute('aria-checked')).toBe(false);

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('inverts group array membership through keyboard activation on a custom member', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['newsletter'], multiple: true });
          selectionGroup.set(group);

          const cb = aria<HTMLDivElement>('checkbox', { value: 'promos' }, { native: false });

          // 1. Creation & SSR: membership derives the state, not props.checked
          expect(cb.checked).toBe(false);
          expect(cb.attributes['aria-checked']).toBe('false');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), cb);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 3/4. Keyboard activation appends the candidate value
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(group.value).toEqual(['newsletter', 'promos']);
          expect(cb.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // 5. Reconciliation: the sibling member projection follows the same group
          const newsCb = aria<HTMLDivElement>('checkbox', { value: 'newsletter' }, { native: false });
          const newsEl = bind(document.createElement('div'), newsCb);
          expect(newsEl.getAttribute('aria-checked')).toBe('true');

          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(group.value).toEqual(['newsletter']);
          expect(el.getAttribute('aria-checked')).toBe('false');
          expect(newsEl.getAttribute('aria-checked')).toBe('true');

          // 6. Teardown
          cb.destroy();
          newsCb.destroy();
          expect(cb.current).toBeNull();
          expect(newsCb.current).toBeNull();
        });
      }));
  });

  describe('Form Control Boundary & Host Parity Invariant', () => {
    it('contributes no form attributes to the dictionary while the author binding submits', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const form = document.createElement('form');
          document.body.appendChild(form);

          const cb = aria('checkbox', { name: 'topics', value: 'promos' });

          // 1. Creation & SSR: identity keys stay on props, never compiled
          expect(cb.properties.name).toBe('topics');
          expect(cb.properties.value).toBe('promos');
          expect(cb.attributes.name).toBeUndefined();
          expect(cb.attributes.value).toBeUndefined();
          expect(cb.attributes.form).toBeUndefined();

          // 2. DOM Binding: the template author binds the field, per the Form Boundary Invariant
          const input = bind(document.createElement('input'), cb);
          input.name = cb.properties.name!;
          input.value = String(cb.properties.value);
          form.appendChild(input);
          expect(input.type).toBe('checkbox');

          const submission = new FormData(form);
          expect(submission.get('topics')).toBeNull();

          // 3/4/5. Activation makes the author-bound field a submission candidate
          input.click();
          expect(cb.checked).toBe(true);
          expect(new FormData(form).get('topics')).toBe('promos');

          input.click();
          expect(cb.checked).toBe(false);
          expect(new FormData(form).get('topics')).toBeNull();

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();
          document.body.removeChild(form);
        });
      }));

    it('syncs required through the native property and through aria-required from one props change', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeCb = aria('checkbox');
          const customCb = aria<HTMLDivElement>('checkbox', {}, { native: false });

          const input = bind(document.createElement('input'), nativeCb);
          const el = bind(document.createElement('div'), customCb);

          // Baseline: neither host is required
          expect(input.required).toBe(false);
          expect(el.getAttribute('aria-required')).toBe('false');

          // 3/5. Same mutation, host-appropriate projection, reflected live
          nativeCb.assign({ required: true });
          customCb.assign({ required: true });

          expect(nativeCb.attributes.required).toBe(true);
          expect(input.required).toBe(true);

          expect(customCb.attributes['aria-required']).toBe('true');
          expect(el.getAttribute('aria-required')).toBe('true');

          // Unchecking a required control is a validity concern, not a state mutation
          input.click();
          expect(input.checked).toBe(true);
          expect(nativeCb.checked).toBe(true);

          // 6. Teardown
          nativeCb.destroy();
          customCb.destroy();
          expect(nativeCb.current).toBeNull();
          expect(customCb.current).toBeNull();
        });
      }));

    it('carries identical state through IDL properties on a native host and aria attributes on a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeCb = aria('checkbox', { checked: true });
          const customCb = aria<HTMLDivElement>('checkbox', { checked: true }, { native: false });

          const input = bind(document.createElement('input'), nativeCb);
          const el = bind(document.createElement('div'), customCb);

          // Same comparator state on both hosts
          expect(nativeCb.checked).toBe(customCb.checked);
          expect(nativeCb.checked).toBe(true);

          // Native host: state lives on the property; ARIA state attrs are never synthesized
          expect(input.checked).toBe(true);
          expect(input.hasAttribute('aria-checked')).toBe(false);
          expect(input.type).toBe('checkbox');

          // Custom host: state lives in the attribute; invalid HTML attrs are omitted entirely
          expect(el.getAttribute('aria-checked')).toBe('true');
          expect(el.hasAttribute('checked')).toBe(false);
          expect((el as AnyType).type).toBeUndefined();
          expect(el.getAttribute('role')).toBe('checkbox');

          nativeCb.destroy();
          customCb.destroy();
          expect(nativeCb.current).toBeNull();
          expect(customCb.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('refuses every activation path on a custom host declared disabled at creation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { disabled: true, checked: false }, { native: false });

          // 1. Creation & SSR
          expect(cb.disabled).toBe(true);
          expect(cb.attributes.role).toBe('checkbox');
          expect(cb.attributes['aria-disabled']).toBe('true');
          expect(cb.attributes.tabindex).toBe(-1);
          expect(cb.attributes['aria-checked']).toBe('false');

          // 2. DOM Binding
          const el = bind(document.createElement('div'), cb);
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          // 3/4. Pointer activation is guarded by the controller, since a div has no native refusal
          el.click();
          expect(cb.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // Keyboard activation is guarded as well
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(cb.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));

    it('goes inert live on a mounted custom host and re-arms without rebinding', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', {}, { native: false });
          const el = bind(document.createElement('div'), cb);

          // Baseline activation
          el.click();
          expect(cb.checked).toBe(true);

          // 5. Reconciliation: guard collapses reachability on the same node
          cb.assign({ disabled: true });
          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.click();
          el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));
          expect(cb.checked).toBe(true);
          expect(el.getAttribute('aria-checked')).toBe('true');

          // Re-arming restores both reachability and activation
          cb.assign({ disabled: false });
          expect(el.getAttribute('aria-disabled')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('0');

          el.click();
          expect(cb.checked).toBe(false);
          expect(el.getAttribute('aria-checked')).toBe('false');

          // 6. Teardown
          cb.destroy();
          expect(cb.current).toBeNull();

          el.click();
          expect(cb.checked).toBe(false);
        });
      }));

    it('composes group disablement with member disablement on a custom member', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: [], multiple: true, disabled: true });
          selectionGroup.set(group);

          const cb = aria<HTMLDivElement>('checkbox', { value: 'promos' }, { native: false });
          const el = bind(document.createElement('div'), cb);

          // 1/2. Group disablement cascades before any member-level declaration
          expect(cb.disabled).toBe(true);
          expect(el.getAttribute('aria-disabled')).toBe('true');

          el.click();
          expect(group.value).toEqual([]);

          // Group re-enabled while the member declares its own disablement: still inert
          group.disabled = false;
          cb.assign({ disabled: true });
          expect(cb.disabled).toBe(true);
          el.click();
          expect(group.value).toEqual([]);

          // Neither level disabled: membership inverts again
          cb.assign({ disabled: false });
          expect(cb.disabled).toBe(false);
          el.click();
          expect(group.value).toEqual(['promos']);
          expect(el.getAttribute('aria-checked')).toBe('true');

          cb.destroy();
        });
      }));

    it('shields compiled state attributes from consumer refiners and purges them on unregister', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const cb = aria<HTMLDivElement>('checkbox', { checked: true }, { native: false });
          const el = bind(document.createElement('div'), cb);

          expect(cb.attributes['aria-checked']).toBe('true');

          const unrefine = cb.refine(() => ({
            'data-testid': 'promos-toggle',
            'aria-checked': 'false',
          }));

          // Refiner additions land; shielded state keys are ignored
          expect(cb.attributes['data-testid']).toBe('promos-toggle');
          expect(cb.attributes['aria-checked']).toBe('true');
          expect(el.getAttribute('aria-checked')).toBe('true');

          // State stays authoritative across a transition, and the refiner reaches the live node
          el.click();
          expect(cb.attributes['aria-checked']).toBe('false');
          expect(cb.attributes['data-testid']).toBe('promos-toggle');
          expect(el.getAttribute('data-testid')).toBe('promos-toggle');

          // Teardown of the refiner leaves no zombie attribute behind
          unrefine();
          expect(cb.attributes['data-testid']).toBeUndefined();
          expect(el.getAttribute('data-testid')).toBeNull();
          expect(cb.attributes['aria-checked']).toBe('false');

          cb.destroy();
          expect(cb.current).toBeNull();
        });
      }));
  });
});
