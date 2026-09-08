import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, OptionAria, type OptionProps } from '../../src/index.js';
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

          const disabledUnselected = aria('option', { selected: false, disabled: true });
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
});
