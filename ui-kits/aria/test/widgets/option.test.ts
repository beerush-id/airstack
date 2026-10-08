import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, OptionAria, type OptionProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Option - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('ARIA Option Contract', () => {
    it('follows SSR -> Mount -> Interaction -> Disposal lifecycle for option elements', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const defaultOpt = aria('option');
          expect(defaultOpt.attributes.role).toBe('option');
          expect(defaultOpt.selected).toBe(false);

          const ctorOpt = new OptionAria();
          expect(ctorOpt.attributes.role).toBe('option');
          expect(ctorOpt.selected).toBe(false);

          const option = aria('option', { selected: false, value: 'opt-1' });

          // 1. SSR Phase: deterministic attributes for custom option
          expect(option.current).toBeNull();
          expect(option.selected).toBe(false);
          expect(option.attributes.role).toBe('option');
          expect(option.attributes.tabindex).toBe(-1);
          expect(option.attributes['aria-selected']).toBe('false');
          expect(option.attributes.disabled).toBeUndefined();

          // 2. Mount Phase: framework element binding
          const el = bind(document.createElement('div'), option);
          expect(option.current).toBe(el);
          expect(el.getAttribute('role')).toBe('option');
          expect(el.getAttribute('tabindex')).toBe('-1');
          expect(el.getAttribute('aria-selected')).toBe('false');

          // 3. Interaction Phase: click to select
          el.click();
          expect(option.selected).toBe(true);
          expect(option.attributes.tabindex).toBe(0);
          expect(option.attributes['aria-selected']).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-selected')).toBe('true');

          // 4. Disposal Phase
          option.destroy();
          expect(option.current).toBeNull();
        });
      }));

    it('manages roving tabindex according to selection state', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const optUnselected = aria('option', { selected: false, value: 'unselected' });
          const optSelected = aria('option', { selected: true, value: 'selected' });

          expect(optUnselected.attributes.tabindex).toBe(-1);
          expect(optSelected.attributes.tabindex).toBe(0);

          const elUnselected = bind(document.createElement('div'), optUnselected);
          const elSelected = bind(document.createElement('div'), optSelected);

          expect(elUnselected.getAttribute('tabindex')).toBe('-1');
          expect(elSelected.getAttribute('tabindex')).toBe('0');
        });
      }));

    it('sets tabindex=-1 and blocks interaction when disabled', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const option = aria('option', { selected: true, disabled: true, value: 'disabled-opt' });

          expect(option.attributes.tabindex).toBe(-1);
          expect(option.attributes['aria-disabled']).toBe('true');
          expect(option.attributes.disabled).toBeUndefined();

          const el = bind(document.createElement('div'), option);
          expect(el.getAttribute('tabindex')).toBe('-1');

          el.click();
          expect(option.selected).toBe(true);
        });
      }));

    it('synchronizes reactive props mutations to attributes and DOM', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<OptionProps>({ selected: false, value: 'reactive-opt' });
          const option = aria('option', props);
          const el = bind(document.createElement('div'), option);

          expect(option.attributes['aria-selected']).toBe('false');
          expect(el.getAttribute('aria-selected')).toBe('false');
          expect(el.getAttribute('tabindex')).toBe('-1');

          props.selected = true;
          expect(option.selected).toBe(true);
          expect(option.attributes['aria-selected']).toBe('true');
          expect(el.getAttribute('aria-selected')).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('0');

          props.disabled = true;
          expect(option.disabled).toBe(true);
          expect(option.attributes['aria-disabled']).toBe('true');
          expect(el.getAttribute('tabindex')).toBe('-1');
        });
      }));

    it('manages programmatic selected setter and disabled unselected attributes', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const option = aria('option', { value: 'prog' });
          expect(option.selected).toBe(false);

          option.selected = true;
          expect(option.selected).toBe(true);
          expect(option.attributes['aria-selected']).toBe('true');

          option.selected = false;
          expect(option.selected).toBe(false);
          expect(option.attributes['aria-selected']).toBe('false');

          const disabledUnselected = aria('option', { selected: false, disabled: true } as OptionProps);
          expect(disabledUnselected.attributes.tabindex).toBe(-1);
          expect(disabledUnselected.attributes['aria-disabled']).toBe('true');
        });
      }));

    it('respects toggle option for standalone option widgets', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const option = aria('option', { selected: true, value: 'toggleable' }, { toggle: true });
          const el = bind(document.createElement('div'), option);

          expect(option.selected).toBe(true);
          expect(el.getAttribute('aria-selected')).toBe('true');

          el.click();
          expect(option.selected).toBe(false);
          expect(el.getAttribute('aria-selected')).toBe('false');
        });
      }));
  });

  describe('Selection Registry & State Mutation Invariant', () => {
    it('keeps a single-select registry exclusive across every mounted member', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'b' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });

          // 1. Creation & SSR: membership is derived, never declared
          expect(optA.selected).toBe(false);
          expect(optB.selected).toBe(true);

          // 2. DOM Binding
          const elA = bind(document.createElement('div'), optA);
          const elB = bind(document.createElement('div'), optB);

          expect(elA.getAttribute('aria-selected')).toBe('false');
          expect(elB.getAttribute('aria-selected')).toBe('true');

          // 3/4/5. Selecting a candidate moves the single slot and the sibling follows
          elA.click();

          expect(group.value).toBe('a');
          expect(optA.selected).toBe(true);
          expect(optB.selected).toBe(false);
          expect(elA.getAttribute('aria-selected')).toBe('true');
          expect(elB.getAttribute('aria-selected')).toBe('false');

          // Selecting a third member leaves exactly one announcement behind
          const optC = aria('option', { value: 'c' });
          const elC = bind(document.createElement('div'), optC);
          elC.click();

          expect(group.value).toBe('c');
          expect(elA.getAttribute('aria-selected')).toBe('false');
          expect(elB.getAttribute('aria-selected')).toBe('false');
          expect(elC.getAttribute('aria-selected')).toBe('true');

          optA.destroy();
          optB.destroy();
          optC.destroy();
          expect(optC.current).toBeNull();
        });
      }));

    it('refuses deselection while the registry is required and releases it once optional', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a', required: true });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const elA = bind(document.createElement('div'), optA);

          expect(optA.selected).toBe(true);

          // Re-activating the sole selection of a required registry is a no-op
          elA.click();
          expect(group.value).toBe('a');
          expect(elA.getAttribute('aria-selected')).toBe('true');

          // 5. Dropping the constraint makes the same activation a deselection
          group.required = false;
          elA.click();

          expect(group.value).toBeUndefined();
          expect(optA.selected).toBe(false);
          expect(elA.getAttribute('aria-selected')).toBe('false');

          // And selecting again restores it through the same path
          elA.click();
          expect(group.value).toBe('a');
          expect(elA.getAttribute('aria-selected')).toBe('true');

          optA.destroy();
          expect(optA.current).toBeNull();
        });
      }));

    it('toggles array membership for a multi-select registry', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: ['a'], multiple: true });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });
          const optC = aria('option', { value: 'c' });

          const elA = bind(document.createElement('div'), optA);
          const elB = bind(document.createElement('div'), optB);
          const elC = bind(document.createElement('div'), optC);

          expect(elA.getAttribute('aria-selected')).toBe('true');
          expect(elB.getAttribute('aria-selected')).toBe('false');

          elB.click();
          expect(group.value).toEqual(['a', 'b']);
          expect(elB.getAttribute('aria-selected')).toBe('true');

          // A second member activation never disturbs the first
          elC.click();
          expect(group.value).toEqual(['a', 'b', 'c']);

          // Deactivating a member removes only its own token
          elA.click();
          expect(group.value).toEqual(['b', 'c']);
          expect(elA.getAttribute('aria-selected')).toBe('false');
          expect(elB.getAttribute('aria-selected')).toBe('true');

          // The last token leaving leaves every member announced as unselected
          elB.click();
          elC.click();
          expect(optA.selected).toBe(false);
          expect(optB.selected).toBe(false);
          expect(optC.selected).toBe(false);
          expect(elC.getAttribute('aria-selected')).toBe('false');

          optA.destroy();
          optB.destroy();
          optC.destroy();
        });
      }));

    it('lets a declared hint claim an empty registry, then the first mounted member under a constraint', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const hinted = mutable({ value: undefined });
          selectionGroup.set(hinted);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b', selected: true });

          // A member carrying its own selection hint claims the unclaimed registry
          expect(optB.selected).toBe(true);
          expect(hinted.value).toBe('b');
          expect(optA.selected).toBe(false);

          optA.destroy();
          optB.destroy();
        });

        const secondTree = component();
        secondTree.run(() => {
          const required = mutable({ value: undefined, required: true });
          selectionGroup.set(required);

          // A required registry with no hint is filled by the first member that mounts
          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });

          const elA = bind(document.createElement('div'), optA);
          bind(document.createElement('div'), optB);

          expect(required.value).toBe('a');
          expect(optA.selected).toBe(true);
          expect(elA.getAttribute('aria-selected')).toBe('true');
          expect(optB.selected).toBe(false);

          optA.destroy();
          optB.destroy();
        });
      }));

    it('synchronizes a native option through its selected property, not ARIA', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'b' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' }, { native: true });
          const optB = aria('option', { value: 'b' }, { native: true });

          // 1. Creation & SSR: <option> carries selection and role natively
          expect(optA.attributes.role).toBeUndefined();
          expect(optA.attributes.tabindex).toBeUndefined();
          expect(optA.attributes['aria-selected']).toBeUndefined();

          // 2. DOM Binding
          const elA = bind(document.createElement('option'), optA);
          const elB = bind(document.createElement('option'), optB);

          expect(elA.selected).toBe(false);
          expect(elB.selected).toBe(true);

          // 3/5. A registry revision rewrites the property and adds no ARIA mirror
          group.value = 'a';

          expect(optA.selected).toBe(true);
          expect(elA.selected).toBe(true);
          expect(elB.selected).toBe(false);
          expect(elA.hasAttribute('aria-selected')).toBe(false);
          expect(elA.hasAttribute('role')).toBe(false);
          expect(elA.hasAttribute('tabindex')).toBe(false);

          optA.destroy();
          optB.destroy();
          expect(optA.current).toBeNull();
        });
      }));
  });

  describe('Virtual Focus & Active Descendant Invariant', () => {
    it('moves the single tab stop to whichever member the registry points at', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'b' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });
          const optC = aria('option', { value: 'c' });

          const elA = bind(document.createElement('div'), optA);
          const elB = bind(document.createElement('div'), optB);
          const elC = bind(document.createElement('div'), optC);

          // Only the active member is reachable; the popup itself owns the moving focus
          expect(elA.getAttribute('tabindex')).toBe('-1');
          expect(elB.getAttribute('tabindex')).toBe('0');
          expect(elC.getAttribute('tabindex')).toBe('-1');

          elA.click();
          expect(group.value).toBe('a');
          expect(elA.getAttribute('tabindex')).toBe('0');
          expect(elB.getAttribute('tabindex')).toBe('-1');
          expect(elC.getAttribute('tabindex')).toBe('-1');

          // A registry revision made outside any member moves the same single stop
          group.value = 'c';
          expect(elA.getAttribute('tabindex')).toBe('-1');
          expect(elC.getAttribute('tabindex')).toBe('0');

          optA.destroy();
          optB.destroy();
          optC.destroy();
        });
      }));

    it('holds a member address stable for container linkage across state and refiners', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b' });

          // The container points at members by id, so the address must exist and be unique
          const addressA = optA.attributes.id;
          expect(typeof addressA).toBe('string');
          expect((addressA as string).length).toBeGreaterThan(0);
          expect(addressA).not.toBe(optB.attributes.id);

          const elA = bind(document.createElement('div'), optA);
          const elB = bind(document.createElement('div'), optB);
          expect(elA.getAttribute('id')).toBe(addressA);

          elB.click();
          expect(optB.selected).toBe(true);
          expect(optA.selected).toBe(false);
          expect(optA.attributes.id).toBe(addressA);
          expect(elA.getAttribute('id')).toBe(addressA);

          // A consumer refiner cannot hijack the linkage address
          const unrefine = optA.refine(() => ({ id: 'consumer-chosen' }));
          expect(optA.attributes.id).toBe(addressA);
          expect(elA.getAttribute('id')).toBe(addressA);
          unrefine();

          optA.destroy();
          optB.destroy();
          expect(optA.current).toBeNull();
        });
      }));
  });

  describe('Inertness & Guarding Invariant', () => {
    it('announces its own value as input when it takes focus', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);
          document.body.appendChild(elB);

          const seen: Array<{ detail: unknown; bubbled: boolean }> = [];
          elB.addEventListener('input', (event) =>
            seen.push({ detail: (event as CustomEvent).detail, bubbled: event.bubbles })
          );

          elB.focus();

          expect(seen).toEqual([{ detail: 'b', bubbled: true }]);

          optB.destroy();
          elB.remove();
        });
      }));

    it('claims no keystroke on its own because traversal belongs to the enclosing popup', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optB = aria('option', { value: 'b' });
          const elB = bind(document.createElement('div'), optB);

          for (const key of ['Enter', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'a']) {
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            elB.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
          }

          // A full Space press is no exception: the member owns no activation at all
          elB.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }));
          elB.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true, bubbles: true }));

          expect(group.value).toBe('a');
          expect(optB.selected).toBe(false);
          expect(elB.getAttribute('aria-selected')).toBe('false');

          optB.destroy();
          expect(optB.current).toBeNull();
        });
      }));

    it('inherits disablement from the registry and refuses deselection of a disabled selection', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'b', disabled: false });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const optB = aria('option', { value: 'b', disabled: true });

          const elA = bind(document.createElement('div'), optA);
          const elB = bind(document.createElement('div'), optB);

          // Member-level disablement outranks the active slot for reachability
          expect(optB.disabled).toBe(true);
          expect(elB.getAttribute('aria-disabled')).toBe('true');
          expect(elB.getAttribute('tabindex')).toBe('-1');

          // The selected-but-disabled member cannot be toggled off either
          elB.click();
          expect(group.value).toBe('b');
          expect(optB.selected).toBe(true);
          expect(elB.getAttribute('aria-selected')).toBe('true');

          // A sibling stays selectable while the disabled member holds its announcement
          elA.click();
          expect(group.value).toBe('a');
          expect(optA.selected).toBe(true);
          expect(optB.selected).toBe(false);

          // Registry-level disablement cascades over every member regardless of its own props
          group.disabled = true;
          expect(optA.disabled).toBe(true);
          expect(elA.getAttribute('aria-disabled')).toBe('true');
          expect(elA.getAttribute('tabindex')).toBe('-1');

          elA.click();
          expect(group.value).toBe('a');

          // Lifting the cascade re-arms both members on the same nodes
          group.disabled = false;
          expect(optA.disabled).toBe(false);
          expect(elA.getAttribute('aria-disabled')).toBe('false');
          expect(elA.getAttribute('tabindex')).toBe('0');

          optB.assign({ disabled: false });
          expect(optB.disabled).toBe(false);

          elB.click();
          expect(group.value).toBe('b');

          optA.destroy();
          optB.destroy();
        });
      }));

    it('shields its selection announcement from consumer refiners', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const group = mutable({ value: 'a' });
          selectionGroup.set(group);

          const optA = aria('option', { value: 'a' });
          const elA = bind(document.createElement('div'), optA);

          const unrefine = optA.refine(() => ({
            'data-role': 'choice',
            'aria-selected': 'false',
            'aria-disabled': 'true',
          }));

          expect(optA.attributes['data-role']).toBe('choice');
          expect(optA.attributes['aria-selected']).toBe('true');
          expect(optA.attributes['aria-disabled']).toBe('false');
          expect(elA.getAttribute('aria-selected')).toBe('true');

          // The announcement keeps tracking the registry while the refiner stays registered
          elA.click();
          expect(optA.attributes['aria-selected']).toBe('false');
          expect(optA.attributes['data-role']).toBe('choice');

          unrefine();
          expect(optA.attributes['data-role']).toBeUndefined();
          expect(elA.getAttribute('data-role')).toBeNull();

          optA.destroy();
          expect(optA.current).toBeNull();
        });
      }));
  });
});
