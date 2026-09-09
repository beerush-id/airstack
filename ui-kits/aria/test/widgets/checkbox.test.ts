import { createLifecycle, mutable } from '@airlib/core';
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
          expect(cb.props.indeterminate).toBe(true);
          expect(cb.attributes.indeterminate).toBe(true);
          expect(cb.attributes['aria-checked']).toBeUndefined();

          // 2. Mount Phase: reflects native input.indeterminate property
          const input = bind(document.createElement('input'), cb);
          expect(cb.current).toBe(input);
          expect(input.indeterminate).toBe(true);

          // 3. Interaction Phase: clicking an indeterminate checkbox checks it and clears native mixed state
          input.click();
          expect(cb.checked).toBe(true);
          expect(cb.props.indeterminate).toBe(false);
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
          expect(cb.props.indeterminate).toBe(true);
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
          expect(cb.props.indeterminate).toBe(false);
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
        selectionGroup.set(group);

        let cb!: CheckboxAria;
        let input!: HTMLInputElement;

        const tree = component();
        tree.run(() => {
          cb = aria('checkbox', { value: 'item-1' });
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
});
