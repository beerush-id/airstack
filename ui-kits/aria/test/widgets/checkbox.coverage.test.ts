import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, CheckboxAria, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Checkbox - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('covers checked, indeterminate, disabled, value, and name public property getters and setters', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox');

        // checked
        expect(cb.checked).toBe(false);
        cb.checked = true;
        expect(cb.checked).toBe(true);
        cb.checked = false;
        expect(cb.checked).toBe(false);

        const defaultCb = new CheckboxAria();
        expect(defaultCb.checked).toBe(false);
        expect(defaultCb.attributes.type).toBe('checkbox');

        // indeterminate
        expect(cb.props.indeterminate).toBeUndefined();
        cb.props.indeterminate = true;
        expect(cb.props.indeterminate).toBe(true);

        // disabled
        expect(cb.disabled).toBe(false);
        cb.props.disabled = true;
        expect(cb.disabled).toBe(true);
        cb.props.disabled = false;
        expect(cb.disabled).toBe(false);

        // value
        expect(cb.value).toBeUndefined();
        cb.props.value = 'my-val';
        expect(cb.value).toBe('my-val');

        // name
        expect(cb.props.name).toBeUndefined();
        cb.props.name = 'my-field';
        expect(cb.props.name).toBe('my-field');
      });
    }));

  it('supports toggle(), select(), and deselect() methods', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { checked: false });
        cb.toggle();
        expect(cb.checked).toBe(true);

        cb.toggle();
        expect(cb.checked).toBe(false);

        cb.select();
        expect(cb.checked).toBe(true);

        cb.deselect();
        expect(cb.checked).toBe(false);
      });
    }));

  it('no-ops when toggle() is invoked on a disabled checkbox', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { disabled: true, checked: false });
        cb.toggle();
        expect(cb.checked).toBe(false);
      });
    }));

  it('preserves indeterminate when select()/deselect() are blocked by disabled state', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { disabled: true, indeterminate: true, checked: false });

        cb.select();
        expect(cb.checked).toBe(false);
        expect(cb.props.indeterminate).toBe(true);

        cb.deselect();
        expect(cb.checked).toBe(false);
        expect(cb.props.indeterminate).toBe(true);
      });
    }));

  it('blocks deselect() when checkbox is idempotent inside a required single group', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: 'a', required: true });
        selectionGroup.set(group);

        const cb = aria('checkbox', { value: 'a', indeterminate: true });
        cb.deselect();
        expect(group.value).toBe('a');
        expect(cb.props.indeterminate).toBe(true);
      });
    }));

  it('clears indeterminate when deselect() resolves a checked mixed state', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { indeterminate: true, checked: true });
        expect(cb.indeterminate).toBe(true);

        cb.deselect();
        expect(cb.checked).toBe(false);
        expect(cb.props.indeterminate).toBe(false);
      });
    }));

  it('early returns from onkeydown and onkeyup when custom checkbox is disabled or receives non-space key', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const disabledCb = aria<HTMLDivElement>('checkbox', { disabled: true }, { native: false });
        const disabledDiv = bind(document.createElement('div'), disabledCb);

        const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceDown);
        expect(spaceDown.defaultPrevented).toBe(false);

        const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
        disabledDiv.dispatchEvent(spaceUp);
        expect(disabledCb.checked).toBe(false);

        // Custom enabled checkbox receiving non-space key
        const customCb = aria<HTMLDivElement>('checkbox', {}, { native: false });
        const customDiv = bind(document.createElement('div'), customCb);
        const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        customDiv.dispatchEvent(enterDown);
        expect(enterDown.defaultPrevented).toBe(false);

        const escapeUp = new KeyboardEvent('keyup', { key: 'Escape', cancelable: true });
        customDiv.dispatchEvent(escapeUp);
        expect(customCb.checked).toBe(false);
      });
    }));

  it('supports selection and deselection in array group and handles un-added items', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: ['a'], multiple: true });
        selectionGroup.set(group);

        const cb = aria('checkbox', { value: 'a' });
        // deselect() removes 'a'
        cb.deselect();
        expect(group.value).toEqual([]);

        // select() adds 'a'
        cb.select();
        expect(group.value).toEqual(['a']);

        // select() on already existing item keeps 'a'
        cb.select();
        expect(group.value).toEqual(['a']);
      });
    }));

  it('handles reactive effect when group reference is cleared defensively', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: ['item-1'], multiple: true });
        selectionGroup.set(group);

        const cb = aria('checkbox', { value: 'item-1' });
        expect(cb.checked).toBe(true);

        // Defensively clear group reference and trigger group mutation
        (cb as unknown as { group: unknown }).group = undefined;
        group.value = ['item-2'];
        expect(cb.checked).toBe(true);
      });
    }));

  it('reactively updates native input.indeterminate property when state changes while mounted', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { indeterminate: false }, { native: true });
        const input = bind(document.createElement('input'), cb);
        expect(input.indeterminate).toBe(false);

        cb.props.indeterminate = true;
        expect(input.indeterminate).toBe(true);
      });
    }));

  it('early returns from onclick handler when element is disabled', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { disabled: true, checked: false });
        const input = bind(document.createElement('input'), cb);

        input.click();
        expect(cb.checked).toBe(false);

        const divCb = aria<HTMLDivElement>('checkbox', { disabled: true, checked: false });
        const div = bind(document.createElement('div'), divCb);

        div.click();
        expect(divCb.checked).toBe(false);
      });
    }));

  it('supports single-value scalar groupKey selection and deselection', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: 'opt-1' });
        selectionGroup.set(group);

        const cb = aria('checkbox', { value: 'opt-1' });
        const cb2 = aria('checkbox', { value: 'opt-2' });
        expect(cb.checked).toBe(true);
        expect(cb2.checked).toBe(false);

        // Toggle on option 2 without arguments when target !== 'opt-2'
        cb2.toggle();
        expect(group.value).toBe('opt-2');
        expect(cb2.checked).toBe(true);
        expect(cb.checked).toBe(false);

        // Toggle off option 2 without arguments when target === 'opt-2'
        cb2.toggle();
        expect(group.value).toBeUndefined();

        // Select with select()
        cb.select();
        expect(group.value).toBe('opt-1');

        // Deselect with deselect()
        cb.deselect();
        expect(group.value).toBeUndefined();

        // Deselect when already unselected
        cb2.deselect();
        expect(group.value).toBeUndefined();
      });
    }));
});
