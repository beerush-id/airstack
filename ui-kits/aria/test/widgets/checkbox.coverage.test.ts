import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, selectionGroup } from '../../src/index.js';
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

        // indeterminate
        expect(cb.indeterminate).toBe(false);
        cb.indeterminate = true;
        expect(cb.indeterminate).toBe(true);

        // Setting checked to true clears indeterminate
        cb.checked = true;
        expect(cb.indeterminate).toBe(false);

        // disabled
        expect(cb.disabled).toBe(false);
        cb.disabled = true;
        expect(cb.disabled).toBe(true);
        cb.disabled = false;
        expect(cb.disabled).toBe(false);

        // value
        expect(cb.value).toBeUndefined();
        cb.value = 'my-val';
        expect(cb.value).toBe('my-val');

        // name
        expect(cb.name).toBeUndefined();
        cb.name = 'my-field';
        expect(cb.name).toBe('my-field');
      });
    }));

  it('supports explicit target boolean on toggle() method', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const cb = aria('checkbox', { checked: false, indeterminate: true });
        cb.toggle(true);
        expect(cb.checked).toBe(true);
        expect(cb.indeterminate).toBe(false);

        cb.toggle(false);
        expect(cb.checked).toBe(false);

        // Invoking toggle() without arguments on indeterminate checkbox checks it
        cb.indeterminate = true;
        cb.toggle();
        expect(cb.checked).toBe(true);
        expect(cb.indeterminate).toBe(false);
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

  it('supports explicit boolean in array group toggle and handles un-added items', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: ['a'] });
        selectionGroup.set(group);

        const cb = aria('checkbox', { value: 'a' });
        // toggle(false) removes 'a'
        cb.toggle(false);
        expect(group.value).toEqual([]);

        // toggle(true) adds 'a'
        cb.toggle(true);
        expect(group.value).toEqual(['a']);

        // toggle(true) on already existing item keeps 'a'
        cb.toggle(true);
        expect(group.value).toEqual(['a']);
      });
    }));

  it('supports explicit boolean in named record group toggle', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: { active: false } });
        selectionGroup.set(group);

        const cb = aria('checkbox', { name: 'active' });
        cb.toggle(true);
        expect(group.value.active).toBe(true);

        cb.toggle(false);
        expect(group.value.active).toBe(false);

        // Toggle without arguments
        cb.toggle();
        expect(group.value.active).toBe(true);

        cb.toggle();
        expect(group.value.active).toBe(false);
      });
    }));

  it('handles reactive effect when group reference is cleared defensively', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: ['item-1'] });
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

        cb.indeterminate = true;
        expect(input.indeterminate).toBe(true);
      });
    }));

  it('supports scoped property key with name and value on group', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable({ value: { tags: ['news'] } });
        selectionGroup.set(group);

        const cb = aria('checkbox', { name: 'tags', value: 'news' });
        expect(cb.checked).toBe(true);

        cb.toggle();
        expect(group.value.tags).toEqual([]);

        cb.toggle();
        expect(group.value.tags).toEqual(['news']);
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

        // Toggle on with explicit boolean true
        cb.toggle(true);
        expect(group.value).toBe('opt-1');

        // Toggle off with explicit boolean false
        cb.toggle(false);
        expect(group.value).toBeUndefined();

        // Toggle off with explicit boolean false when already unselected
        cb2.toggle(false);
        expect(group.value).toBeUndefined();
      });
    }));

  it('coordinates membership by id when inside group without name or value props', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const group = mutable<{ value: string | undefined }>({ value: undefined });
        selectionGroup.set(group);

        const cb = aria('checkbox');
        expect(cb.checked).toBe(false);

        cb.toggle();
        expect(cb.checked).toBe(true);
        expect(group.value).toBe(cb.id);

        cb.toggle();
        expect(cb.checked).toBe(false);
        expect(group.value).toBeUndefined();
      });
    }));
});
