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

  public override get idempotent(): boolean {
    return super.idempotent;
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
          expect(item.attributes.disabled).toBeUndefined();
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
          expect(item.attributes.disabled).toBeUndefined();
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

          // Mutable setter via props
          item.props.disabled = false;
          expect(item.disabled).toBe(false);
          item.select();
          expect(item.props.selected).toBe(true);
        });
      }));

    it('reads value from props using declared valueKey', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const item = new TestItem();
          expect(item.value).toBeUndefined();

          item.props.value = 'opt-1';
          expect(item.value).toBe('opt-1');
          expect(item.props.value).toBe('opt-1');

          item.props.name = 'field-a';
          expect(item.props.name).toBe('field-a');
        });
      }));

    it('handles explicit idempotent option', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const normalItem = new TestItem();
          expect(normalItem.idempotent).toBe(false);

          const idempotentItem = new TestItem({}, { idempotent: true });
          expect(idempotentItem.idempotent).toBe(true);
        });
      }));
  });

  describe('Group Coordination Contract', () => {
    it('coordinates array collection membership (multi-select)', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ multiple: true, value: ['item-1'] });
          selectionGroup.set(group);

          const item1 = new TestItem({ value: 'item-1' });
          const item2 = new TestItem({ value: 'item-2' });

          expect(item1.idempotent).toBe(false);
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

    it('cascades group-level disablement to member items', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ disabled: true, value: 'opt-1' });
          selectionGroup.set(group);

          const item = new TestItem({ value: 'opt-1' });
          expect(item.disabled).toBe(true);
          expect(item.attributes.disabled).toBeUndefined();
          expect(item.attributes['aria-disabled']).toBe('true');
          expect(item.attributes.tabindex).toBe(-1);
        });
      }));

  });

  describe('DOM & Keyboard Interaction', () => {
    it('handles click events according to idempotent state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          // Default item (idempotent: false) toggles on and off
          const toggleItem = new TestItem();
          const div = bind(document.createElement('div'), toggleItem);

          div.click();
          expect(toggleItem.props.selected).toBe(true);
          div.click();
          expect(toggleItem.props.selected).toBe(false);

          // Disabled item ignores click
          toggleItem.props.disabled = true;
          div.click();
          expect(toggleItem.props.selected).toBe(false);

          // Idempotent item selects on click and stays selected
          const idempotentItem = new TestItem({}, { idempotent: true });
          const idempotentDiv = bind(document.createElement('div'), idempotentItem);
          idempotentDiv.click();
          expect(idempotentItem.props.selected).toBe(true);
          idempotentDiv.click();
          expect(idempotentItem.props.selected).toBe(true);
        });
      }));

    it('poly-fills Space keydown and keyup on non-native elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const item = new TestItem();
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

          // Enter keyup does not re-click (handled on keydown)
          const enterUp = new KeyboardEvent('keyup', { key: 'Enter', cancelable: true });
          div.dispatchEvent(enterUp);
          expect(item.props.selected).toBe(false);

          // Allowed keys that are neither Space nor Enter do not preventDefault
          const customAllowedItem = new TestItem({}, { allowKeys: ['Tab'] });
          const customAllowedEl = bind(document.createElement('div'), customAllowedItem);
          const tabDown = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
          customAllowedEl.dispatchEvent(tabDown);
          expect(tabDown.defaultPrevented).toBe(false);

          const tabUp = new KeyboardEvent('keyup', { key: 'Tab', cancelable: true });
          customAllowedEl.dispatchEvent(tabUp);

          const escapeDown = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
          div.dispatchEvent(escapeDown);
          expect(escapeDown.defaultPrevented).toBe(false);

          // Disabled non-native ignores key events
          customAllowedItem.props.disabled = true;
          customAllowedEl.dispatchEvent(tabDown);
          customAllowedEl.dispatchEvent(tabUp);

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

            // 1. Group with value token
            const grid = new TestItem({ value: 'grid' });
            expect(grid.attributes.id).toBe('view-mode-grid');

            // 2. Group with value and role
            const list = new TestItem({ value: 'list' }, { role: 'option' });
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

      it('coordinates group.value across items with value payloads', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ id: string; value: string | undefined }>({ id: 'theme-picker', value: 'light' });
            selectionGroup.set(group);

            const itemLight = new TestItem({ value: 'light' });
            const itemDark = new TestItem({ value: 'dark' });
            const itemSystem = new TestItem({ value: 'system' });

            // Verify compiled DOM attributes upon initialization
            expect(itemLight.attributes.id).toBe('theme-picker-light');
            expect(itemLight.attributes.value).toBeUndefined();
            expect(itemLight.attributes['aria-selected']).toBe('true');

            expect(itemDark.attributes.id).toBe('theme-picker-dark');
            expect(itemDark.attributes.value).toBeUndefined();
            expect(itemDark.attributes['aria-selected']).toBe('false');

            expect(itemSystem.attributes.id).toBe('theme-picker-system');
            expect(itemSystem.attributes.value).toBeUndefined();
            expect(itemSystem.attributes['aria-selected']).toBe('false');

            // Switching via select()
            itemDark.select();
            expect(group.value).toBe('dark');
            expect(itemLight.attributes['aria-selected']).toBe('false');
            expect(itemDark.attributes['aria-selected']).toBe('true');
            expect(itemSystem.attributes['aria-selected']).toBe('false');

            itemSystem.select();
            expect(group.value).toBe('system');
            expect(itemLight.attributes['aria-selected']).toBe('false');
            expect(itemDark.attributes['aria-selected']).toBe('false');
            expect(itemSystem.attributes['aria-selected']).toBe('true');

            itemLight.select();
            expect(group.value).toBe('light');
            expect(itemLight.attributes['aria-selected']).toBe('true');
          });
        }));

      it('coordinates array multi-select group.value across items with value payloads', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ id: string; multiple: boolean; value: string[] }>({
              id: 'roles',
              multiple: true,
              value: ['admin'],
            });
            selectionGroup.set(group);

            const itemAdmin = new TestItem({ value: 'admin' });
            const itemEditor = new TestItem({ value: 'editor' });
            const itemViewer = new TestItem({ value: 'viewer' });

            expect(itemAdmin.attributes.id).toBe('roles-admin');
            expect(itemAdmin.attributes['aria-selected']).toBe('true');

            expect(itemEditor.attributes.id).toBe('roles-editor');
            expect(itemEditor.attributes.value).toBeUndefined();
            expect(itemEditor.attributes['aria-selected']).toBe('false');

            expect(itemViewer.attributes.id).toBe('roles-viewer');
            expect(itemViewer.attributes.value).toBeUndefined();
            expect(itemViewer.attributes['aria-selected']).toBe('false');

            itemEditor.select();
            expect(group.value).toEqual(['admin', 'editor']);
            expect(itemEditor.attributes['aria-selected']).toBe('true');

            itemViewer.select();
            expect(group.value).toEqual(['admin', 'editor', 'viewer']);
            expect(itemViewer.attributes['aria-selected']).toBe('true');

            itemAdmin.deselect();
            expect(group.value).toEqual(['editor', 'viewer']);
            expect(itemAdmin.attributes['aria-selected']).toBe('false');
          });
        }));

      it('defensively initializes non-array multi-select group and claims initial selected items', () =>
        scope.run(() => {
          const tree = component();
          tree.run(() => {
            const group = mutable<{ multiple: boolean; value: unknown }>({
              multiple: true,
              value: undefined,
            });
            selectionGroup.set(group as never);

            const item = new TestItem({ value: 'init-item', selected: true });
            expect(Array.isArray(group.value)).toBe(true);
            expect(group.value).toEqual(['init-item']);
            expect(item.props.selected).toBe(true);
          });
        }));
    });
  });
});
