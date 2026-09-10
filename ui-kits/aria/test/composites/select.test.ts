import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { Aria, aria, type BaseElement, type SelectProps, selectCtx, roverCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Select - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('ARIA Contract & Attributes', () => {
    it('renders role="listbox" and default vertical orientation attributes', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria('select');
          expect(select.attributes.role).toBe('listbox');
          expect(select.attributes['aria-orientation']).toBe('vertical');
          expect(select.attributes['aria-multiselectable']).toBe('false');
          expect(select.attributes['aria-disabled']).toBe('false');

          const horizontalSelect = aria('select', { orientation: 'horizontal' });
          expect(horizontalSelect.attributes['aria-orientation']).toBe('horizontal');

          const multiSelect = aria('select', { multiple: true });
          expect(multiSelect.attributes['aria-multiselectable']).toBe('true');

          const disabledSelect = aria('select', { disabled: true });
          expect(disabledSelect.attributes['aria-disabled']).toBe('true');

          const requiredSelect = aria('select', { required: true });
          expect(requiredSelect.attributes['aria-required']).toBe('true');
        });
      }));

    it('synchronizes reactive props mutations to select attributes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ orientation: 'vertical', multiple: false, disabled: false });
          const select = aria('select', props);

          expect(select.attributes['aria-orientation']).toBe('vertical');
          expect(select.attributes['aria-multiselectable']).toBe('false');
          expect(select.attributes['aria-disabled']).toBe('false');

          props.orientation = 'horizontal';
          expect(select.attributes['aria-orientation']).toBe('horizontal');

          props.multiple = true;
          expect(select.attributes['aria-multiselectable']).toBe('true');

          props.disabled = true;
          expect(select.attributes['aria-disabled']).toBe('true');
        });
      }));
  });

  describe('Option Coordination & Single-Selection', () => {
    it('coordinates child options via context and synchronizes selection state', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: 'opt-1' });
          const select = aria('select', props);
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => selectCtx.get()!.option({ value: 'opt-1' }));
          const o2 = component().run(() => selectCtx.get()!.option({ value: 'opt-2' }));
          const o3 = component().run(() => selectCtx.get()!.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);
          selectEl.appendChild(el3);

          expect(o1.selected).toBe(true);
          expect(o2.selected).toBe(false);
          expect(o3.selected).toBe(false);

          expect(el1.getAttribute('aria-selected')).toBe('true');
          expect(el1.getAttribute('tabindex')).toBe('0');
          expect(el2.getAttribute('aria-selected')).toBe('false');
          expect(el2.getAttribute('tabindex')).toBe('-1');

          // Clicking option 2 selects it and deselects option 1
          el2.click();

          expect(props.value).toBe('opt-2');
          expect(o1.selected).toBe(false);
          expect(o2.selected).toBe(true);
          expect(el1.getAttribute('aria-selected')).toBe('false');
          expect(el1.getAttribute('tabindex')).toBe('-1');
          expect(el2.getAttribute('aria-selected')).toBe('true');
          expect(el2.getAttribute('tabindex')).toBe('0');

          selectEl.remove();
        });
      }));
  });

  describe('Multi-Selection', () => {
    it('coordinates multi-selection when multiple is enabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ multiple: true, value: ['opt-1'] });
          const select = aria('select', props);
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => select.option({ value: 'opt-1' }));
          const o2 = component().run(() => select.option({ value: 'opt-2' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);

          expect(o1.selected).toBe(true);
          expect(o2.selected).toBe(false);

          // Clicking option 2 adds it to selection
          el2.click();
          expect(props.value).toEqual(['opt-1', 'opt-2']);
          expect(o1.selected).toBe(true);
          expect(o2.selected).toBe(true);

          // Clicking option 1 deselects it
          el1.click();
          expect(props.value).toEqual(['opt-2']);
          expect(o1.selected).toBe(false);
          expect(o2.selected).toBe(true);

          selectEl.remove();
        });
      }));
  });

  describe('Keyboard Navigation', () => {
    it('navigates options with ArrowDown and ArrowUp roving focus', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: 'opt-1' });
          const select = aria('select', props);
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => selectCtx.get()!.option({ value: 'opt-1' }));
          const o2 = component().run(() => selectCtx.get()!.option({ value: 'opt-2' }));
          const o3 = component().run(() => selectCtx.get()!.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);
          selectEl.appendChild(el3);

          el1.focus();

          // ArrowDown roves to el2
          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el2);

          // ArrowDown again roves to el3
          selectEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el3);

          // ArrowUp roves back to el2
          const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(upEvent);
          expect(document.activeElement).toBe(el2);

          selectEl.remove();
        });
      }));

    it('navigates with Home and End keys', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria('select');
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => select.option({ value: 'opt-1' }));
          const o2 = component().run(() => select.option({ value: 'opt-2' }));
          const o3 = component().run(() => select.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);
          selectEl.appendChild(el3);

          el1.focus();

          const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(endEvent);
          expect(document.activeElement).toBe(el3);

          const homeEvent = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(homeEvent);
          expect(document.activeElement).toBe(el1);

          selectEl.remove();
        });
      }));

    it('skips disabled options during roving navigation', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria('select');
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => select.option({ value: 'opt-1' }));
          const o2 = component().run(() => select.option({ value: 'opt-2', disabled: true }));
          const o3 = component().run(() => select.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);
          selectEl.appendChild(el3);

          el1.focus();

          // ArrowDown should skip disabled el2 and focus el3 directly
          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el3);

          selectEl.remove();
        });
      }));

    it('ignores keyboard navigation when select is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria('select', { disabled: true });
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const o1 = component().run(() => select.option({ value: 'opt-1' }));
          const o2 = component().run(() => select.option({ value: 'opt-2' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);

          selectEl.appendChild(el1);
          selectEl.appendChild(el2);

          el1.focus();

          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          selectEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el1);

          selectEl.remove();
        });
      }));

    it('supports manual navigation, orientation fallback, and parent rover keydown guard', () =>
      scope.run(() => {
        component().run(() => {
          const manualSelect = aria('select', { manual: false });
          const manualEl = bind(document.createElement('div'), manualSelect);
          manualEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

          delete (manualSelect.props as Record<string, unknown>).orientation;
          expect(manualSelect.orientation).toBe('vertical');

          // Parent rover ignores keydown
          roverCtx.set(manualSelect as unknown as Aria<BaseElement>);
          const childSelect = aria('select');
          const childEl = bind(document.createElement('div'), childSelect);
          childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          roverCtx.set(undefined);
        });
      }));

    it('compiles required and invalid states onto select container', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria('select', { required: true, invalid: true });
          expect(select.attributes['aria-required']).toBe('true');
          expect(select.attributes['aria-invalid']).toBe('true');

          const multiSelect = aria('select', { multiple: true, invalid: 'grammar' });
          expect(multiSelect.attributes['aria-invalid']).toBe('grammar');

          const defaultSelect = aria('select');
          expect(defaultSelect.attributes['aria-invalid']).toBeUndefined();

          const validSelect = aria('select', { invalid: false });
          expect(validSelect.attributes['aria-invalid']).toBe('false');
        });
      }));
  });
});
