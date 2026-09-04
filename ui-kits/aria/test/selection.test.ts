import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { SelectionAria, type SelectionOptions, type SelectionProps, selectionGroup } from '../src/selection.js';
import { bind, component } from './utils.js';

class TestItem extends SelectionAria {
  public constructor(props?: SelectionProps, options?: SelectionOptions) {
    super(props, options);
    this.update();
  }

  public get isSelected(): boolean {
    return this.selected;
  }

  public set isSelected(value: boolean | undefined) {
    this.selected = value;
  }

  protected override createAttributes() {
    return Object.assign(super.createAttributes(), {
      'aria-selected': this.selected ? 'true' : 'false',
    });
  }
}

describe('Selection - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Standalone Selection State & Lifecycle', () => {
    it('manages default and custom selection state keys', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          // Default key: 'selected'
          const item = new TestItem();
          expect(item.attributes.tabindex).toBe(0);
          expect(item.attributes.disabled).toBe(false);
          expect(item.attributes['aria-disabled']).toBe('false');

          item.select();
          expect(item.props.selected).toBe(true);

          item.deselect();
          expect(item.props.selected).toBe(false);

          item.toggle();
          expect(item.props.selected).toBe(true);

          // Setter
          item.isSelected = false;
          expect(item.isSelected).toBe(false);
          item.isSelected = true;
          expect(item.isSelected).toBe(true);

          // Custom key: 'active'
          const customItem = new TestItem({}, { key: 'active' });
          customItem.select();
          expect(customItem.props.active).toBe(true);
        });
      }));

    it('enforces lockout progression when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const item = new TestItem({ disabled: true });
          expect(item.disabled).toBe(true);
          expect(item.attributes.disabled).toBe(true);
          expect(item.attributes.tabindex).toBe(-1);
          expect(item.attributes['aria-disabled']).toBe('true');

          // Operations no-op when disabled
          item.select();
          expect(item.props.selected).toBeUndefined();

          item.deselect();
          expect(item.props.selected).toBeUndefined();

          item.toggle();
          expect(item.props.selected).toBeUndefined();

          item.isSelected = true;
          expect(item.props.selected).toBeUndefined();

          // Mutable setter
          item.disabled = false;
          expect(item.disabled).toBe(false);
          item.select();
          expect(item.props.selected).toBe(true);
        });
      }));

    it('manages value and name properties', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const item = new TestItem();
          expect(item.value).toBeUndefined();
          expect(item.name).toBeUndefined();

          item.value = 'opt-1';
          expect(item.value).toBe('opt-1');
          expect(item.props.value).toBe('opt-1');

          item.name = 'field-a';
          expect(item.name).toBe('field-a');
          expect(item.props.name).toBe('field-a');
        });
      }));

    it('handles explicit toggle option', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const normalItem = new TestItem();
          expect(normalItem.isToggle).toBe(false);

          const toggleItem = new TestItem({}, { toggle: true });
          expect(toggleItem.isToggle).toBe(true);
        });
      }));
  });

  describe('Group Coordination Contract', () => {
    it('coordinates array collection membership (multi-select)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['item-1'] });
          selectionGroup.set(group);

          const item1 = new TestItem({ value: 'item-1' });
          const item2 = new TestItem({ value: 'item-2' });

          expect(item1.isToggle).toBe(true);
          expect(item1.props.selected).toBe(true);
          expect(item2.props.selected).toBe(false);

          // Selecting already-selected item avoids duplicate entry
          item1.select();
          expect(group.value).toEqual(['item-1']);

          // Selecting unselected item adds to array
          item2.select();
          expect(group.value).toEqual(['item-1', 'item-2']);
          expect(item2.props.selected).toBe(true);

          // Deselecting item removes from array
          item1.deselect();
          expect(group.value).toEqual(['item-2']);
          expect(item1.props.selected).toBe(false);

          // Deselecting non-member is a no-op
          item1.deselect();
          expect(group.value).toEqual(['item-2']);

          // Toggling inverts membership
          item1.toggle();
          expect(group.value).toEqual(['item-2', 'item-1']);
          expect(item1.props.selected).toBe(true);
        });
      }));

    it('coordinates scalar selection (single-select)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable<{ value: string | undefined }>({ value: 'tab-1' });
          selectionGroup.set(group);

          const tab1 = new TestItem({ value: 'tab-1' });
          const tab2 = new TestItem({ value: 'tab-2' });

          expect(tab1.props.selected).toBe(true);
          expect(tab2.props.selected).toBe(false);

          // Switching selection
          tab2.select();
          expect(group.value).toBe('tab-2');
          expect(tab1.props.selected).toBe(false);
          expect(tab2.props.selected).toBe(true);

          // Deselecting unsets group value if matching
          tab2.deselect();
          expect(group.value).toBeUndefined();
          expect(tab2.props.selected).toBe(false);

          // Deselecting non-matching item does not unset
          group.value = 'tab-1';
          tab2.deselect();
          expect(group.value).toBe('tab-1');
        });
      }));

    it('coordinates named boolean record groups', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable<{ value: { [key: string]: boolean } }>({ value: { bold: true, italic: false } });
          selectionGroup.set(group);

          const bold = new TestItem({ name: 'bold' });
          const italic = new TestItem({ name: 'italic' });

          expect(bold.isToggle).toBe(true);
          expect(bold.props.selected).toBe(true);
          expect(italic.props.selected).toBe(false);

          // Deselect sets record key to false
          bold.deselect();
          expect(group.value.bold).toBe(false);
          expect(bold.props.selected).toBe(false);

          // Select sets record key to true
          italic.select();
          expect(group.value.italic).toBe(true);
          expect(italic.props.selected).toBe(true);
        });
      }));

    it('cascades group-level disablement to member items', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ disabled: true, value: 'opt-1' });
          selectionGroup.set(group);

          const item = new TestItem({ value: 'opt-1' });
          expect(item.disabled).toBe(true);
          expect(item.attributes.disabled).toBe(true);
          expect(item.attributes['aria-disabled']).toBe('true');
          expect(item.attributes.tabindex).toBe(-1);
        });
      }));
  });

  describe('DOM & Keyboard Interaction', () => {
    it('handles click events according to toggle state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          // Toggle item
          const toggleItem = new TestItem({}, { toggle: true });
          const div = bind(document.createElement('div'), toggleItem);

          div.click();
          expect(toggleItem.props.selected).toBe(true);
          div.click();
          expect(toggleItem.props.selected).toBe(false);

          // Disabled item ignores click
          toggleItem.disabled = true;
          div.click();
          expect(toggleItem.props.selected).toBe(false);

          // Non-toggle item selects on click
          const nonToggle = new TestItem();
          const nonToggleDiv = bind(document.createElement('div'), nonToggle);
          nonToggleDiv.click();
          expect(nonToggle.props.selected).toBe(true);
        });
      }));

    it('poly-fills Space keydown and keyup on non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const item = new TestItem({}, { toggle: true });
          const div = bind(document.createElement('div'), item);

          // Space keydown prevents scroll
          const spaceDown = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
          div.dispatchEvent(spaceDown);
          expect(spaceDown.defaultPrevented).toBe(true);

          // Space keyup triggers click/activation
          const spaceUp = new KeyboardEvent('keyup', { key: ' ', cancelable: true });
          div.dispatchEvent(spaceUp);
          expect(item.props.selected).toBe(true);

          // Enter keydown triggers activation immediately
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
          div.dispatchEvent(enterDown);
          expect(enterDown.defaultPrevented).toBe(true);
          expect(item.props.selected).toBe(false);

          // Ignores unallowed keys
          const escapeDown = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
          div.dispatchEvent(escapeDown);
          expect(escapeDown.defaultPrevented).toBe(false);

          // Native option delegates to browser
          const nativeItem = new TestItem({}, { native: true });
          const nativeBtn = bind(document.createElement('button'), nativeItem);
          const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
          nativeBtn.dispatchEvent(spaceEvent);
          expect(spaceEvent.defaultPrevented).toBe(false);
        });
      }));

    describe('ID Resolution Contracts', () => {
      it('derives scoped id with group, role, and value permutations', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ id?: string; value?: string }>({ id: 'view-mode', value: 'grid' });
            selectionGroup.set(group);

            // 1. Group with name only
            const grid = new TestItem({ name: 'grid' });
            expect(grid.attributes.id).toBe('view-mode-grid');

            // 2. Group with name and role
            const list = new TestItem({ name: 'list' }, { role: 'option' });
            expect(list.id).toBe('option-1');
            expect(list.attributes.id).toBe('view-mode-option-list');

            // 3. Group with value fallback (no name)
            const table = new TestItem({ value: 'table' });
            expect(table.attributes.id).toBe('view-mode-table');

            // 4. Explicit id overrides group derivation
            const custom = new TestItem({ id: 'compact-view', name: 'compact' });
            expect(custom.props.id).toBe('compact-view');
            expect(custom.attributes.id).toBe('compact-view');

            // 5. Reactive mutation on group.id propagates dynamically to attributes.id
            group.id = 'layout';
            expect(grid.attributes.id).toBe('layout-grid');
            expect(list.attributes.id).toBe('layout-option-list');
          });
        }));

      it('falls back to self-claim or explicit id when group has no id', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable({ value: 'opt-1' });
            selectionGroup.set(group);

            // Self-claims with role and sequence index
            const item = new TestItem({ name: 'opt-1' }, { role: 'option' });
            expect(item.id).toBe('option-1');

            // Explicit id takes precedence in attributes.id
            const custom = new TestItem({ id: 'explicit-id', name: 'opt-2' });
            expect(custom.props.id).toBe('explicit-id');
            expect(custom.attributes.id).toBe('explicit-id');
          });
        }));

      it('resolves standalone item IDs without a group', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            // Explicit ID
            const explicit = new TestItem({ id: 'my-custom-btn' });
            expect(explicit.props.id).toBe('my-custom-btn');
            expect(explicit.attributes.id).toBe('my-custom-btn');

            // Self-claim sequence
            const first = new TestItem({}, { role: 'option' });
            const second = new TestItem({}, { role: 'option' });
            expect(first.id).toBe('option-1');
            expect(second.id).toBe('option-2');

            // Sequential default 'item' index
            const unassigned = new TestItem();
            expect(unassigned.id).toBe('item-2');
            expect(unassigned.attributes.id).toBe('item-2');
          });
        }));

      it('coordinates group.value across name, value, and id item identifiers', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ id: string; value: string | undefined }>({ id: 'theme-picker', value: 'light' });
            selectionGroup.set(group);

            const byName = new TestItem({ name: 'light' });
            const byValue = new TestItem({ value: 'dark' });
            const byId = new TestItem({ id: 'system' });

            // Verify compiled DOM attributes upon initialization
            expect(byName.attributes.id).toBe('theme-picker-light');
            expect(byName.attributes.name).toBeUndefined();
            expect(byName.attributes['aria-selected']).toBe('true');

            expect(byValue.attributes.id).toBe('theme-picker-dark');
            expect(byValue.attributes.value).toBeUndefined();
            expect(byValue.attributes['aria-selected']).toBe('false');

            expect(byId.attributes.id).toBe('system');
            expect(byId.attributes['aria-selected']).toBe('false');

            // Switching via select()
            byValue.select();
            expect(group.value).toBe('dark');
            expect(byName.attributes['aria-selected']).toBe('false');
            expect(byValue.attributes['aria-selected']).toBe('true');
            expect(byId.attributes['aria-selected']).toBe('false');

            byId.select();
            expect(group.value).toBe('system');
            expect(byName.attributes['aria-selected']).toBe('false');
            expect(byValue.attributes['aria-selected']).toBe('false');
            expect(byId.attributes['aria-selected']).toBe('true');

            byName.select();
            expect(group.value).toBe('light');
            expect(byName.attributes['aria-selected']).toBe('true');
          });
        }));

      it('coordinates array multi-select group.value across name, value, and id', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ id: string; value: string[] }>({ id: 'roles', value: ['admin'] });
            selectionGroup.set(group);

            const byName = new TestItem({ name: 'editor' });
            const byValue = new TestItem({ value: 'viewer' });
            const byId = new TestItem({ id: 'admin' });

            expect(byId.attributes.id).toBe('admin');
            expect(byId.attributes['aria-selected']).toBe('true');

            expect(byName.attributes.id).toBe('roles-editor');
            expect(byName.attributes.name).toBeUndefined();
            expect(byName.attributes['aria-selected']).toBe('false');

            expect(byValue.attributes.id).toBe('roles-viewer');
            expect(byValue.attributes.value).toBeUndefined();
            expect(byValue.attributes['aria-selected']).toBe('false');

            byName.select();
            expect(group.value).toEqual(['admin', 'editor']);
            expect(byName.attributes['aria-selected']).toBe('true');

            byValue.select();
            expect(group.value).toEqual(['admin', 'editor', 'viewer']);
            expect(byValue.attributes['aria-selected']).toBe('true');

            byId.deselect();
            expect(group.value).toEqual(['editor', 'viewer']);
            expect(byId.attributes['aria-selected']).toBe('false');
          });
        }));

      it('deselects scoped field scalar property on group', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ value: { align?: string } }>({ value: { align: 'left' } });
            selectionGroup.set(group);

            const item = new TestItem({ name: 'align', value: 'left' });
            expect(item.name).toBe('align');
            expect(item.value).toBe('left');
            expect(item.attributes.name).toBeUndefined();
            expect(item.attributes.value).toBeUndefined();
            expect(item.attributes['aria-selected']).toBe('true');

            item.deselect();
            expect(group.value.align).toBeUndefined();
            expect(item.attributes['aria-selected']).toBe('false');

            // Deselecting when target does not match is a no-op
            item.deselect();
            expect(group.value.align).toBeUndefined();
          });
        }));

      it('handles scoped array duplicate selection and non-matching deselection', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ value: { roles: string[] } }>({ value: { roles: ['admin'] } });
            selectionGroup.set(group);

            const item = new TestItem({ name: 'roles', value: 'admin' });
            expect(item.props.selected).toBe(true);

            // Re-selecting item when already included in scoped array
            item.select();
            expect(group.value.roles).toEqual(['admin']);

            // Value-only item with groupKey
            const valItem = new TestItem({ value: 'editor' });
            expect(valItem.props.selected).toBe(false);
          });
        }));

      it('handles anonymous items inside object group value', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ value: unknown }>({ value: { bold: true } });
            selectionGroup.set(group);

            const anon = new TestItem({ id: 'anon' });
            expect(anon.props.selected).toBe(false);

            anon.select();
            expect(group.value).toBe('anon');

            group.value = { bold: true };
            anon.deselect();
            expect(anon.props.selected).toBe(false);
          });
        }));
    });
  });
});
