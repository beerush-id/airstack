import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { Aria, aria, type BaseElement, type ListboxProps, listboxCtx, roverCtx } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Listbox - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('ARIA Contract & Attributes', () => {
    it('renders role="listbox" and default vertical orientation attributes', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria('listbox');
          expect(listbox.attributes.role).toBe('listbox');
          expect(listbox.attributes['aria-orientation']).toBe('vertical');
          expect(listbox.attributes['aria-multiselectable']).toBe('false');
          expect(listbox.attributes['aria-disabled']).toBe('false');

          const horizontalListbox = aria('listbox', { orientation: 'horizontal' });
          expect(horizontalListbox.attributes['aria-orientation']).toBe('horizontal');

          const multiListbox = aria('listbox', { multiple: true });
          expect(multiListbox.attributes['aria-multiselectable']).toBe('true');

          const disabledListbox = aria('listbox', { disabled: true });
          expect(disabledListbox.attributes['aria-disabled']).toBe('true');

          const requiredListbox = aria('listbox', { required: true });
          expect(requiredListbox.attributes['aria-required']).toBe('true');
        });
      }));

    it('synchronizes reactive props mutations to listbox attributes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ orientation: 'vertical', multiple: false, disabled: false });
          const listbox = aria('listbox', props);

          expect(listbox.attributes['aria-orientation']).toBe('vertical');
          expect(listbox.attributes['aria-multiselectable']).toBe('false');
          expect(listbox.attributes['aria-disabled']).toBe('false');

          props.orientation = 'horizontal';
          expect(listbox.attributes['aria-orientation']).toBe('horizontal');

          props.multiple = true;
          expect(listbox.attributes['aria-multiselectable']).toBe('true');

          props.disabled = true;
          expect(listbox.attributes['aria-disabled']).toBe('true');
        });
      }));
  });

  describe('Option Coordination & Single-Selection', () => {
    it('coordinates child options via context and synchronizes selection state', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'opt-1' });
          const listbox = aria('listbox', props);
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listboxCtx.get()!.option({ value: 'opt-1' }));
          const o2 = component().run(() => listboxCtx.get()!.option({ value: 'opt-2' }));
          const o3 = component().run(() => listboxCtx.get()!.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);
          listboxEl.appendChild(el3);

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

          listboxEl.remove();
        });
      }));
  });

  describe('Multi-Selection', () => {
    it('coordinates multi-selection when multiple is enabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ multiple: true, value: ['opt-1'] });
          const listbox = aria('listbox', props);
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listbox.option({ value: 'opt-1' }));
          const o2 = component().run(() => listbox.option({ value: 'opt-2' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);

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

          listboxEl.remove();
        });
      }));
  });

  describe('Keyboard Navigation', () => {
    it('navigates options with ArrowDown and ArrowUp roving focus', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'opt-1' });
          const listbox = aria('listbox', props);
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listboxCtx.get()!.option({ value: 'opt-1' }));
          const o2 = component().run(() => listboxCtx.get()!.option({ value: 'opt-2' }));
          const o3 = component().run(() => listboxCtx.get()!.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);
          listboxEl.appendChild(el3);

          el1.focus();

          // ArrowDown roves to el2
          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el2);

          // ArrowDown again roves to el3
          listboxEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el3);

          // ArrowUp roves back to el2
          const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(upEvent);
          expect(document.activeElement).toBe(el2);

          listboxEl.remove();
        });
      }));

    it('navigates with Home and End keys', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria('listbox');
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listbox.option({ value: 'opt-1' }));
          const o2 = component().run(() => listbox.option({ value: 'opt-2' }));
          const o3 = component().run(() => listbox.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);
          listboxEl.appendChild(el3);

          el1.focus();

          const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(endEvent);
          expect(document.activeElement).toBe(el3);

          const homeEvent = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(homeEvent);
          expect(document.activeElement).toBe(el1);

          listboxEl.remove();
        });
      }));

    it('skips disabled options during roving navigation', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria('listbox');
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listbox.option({ value: 'opt-1' }));
          const o2 = component().run(() => listbox.option({ value: 'opt-2', disabled: true }));
          const o3 = component().run(() => listbox.option({ value: 'opt-3' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);
          const el3 = bind(document.createElement('div'), o3);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);
          listboxEl.appendChild(el3);

          el1.focus();

          // ArrowDown should skip disabled el2 and focus el3 directly
          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el3);

          listboxEl.remove();
        });
      }));

    it('ignores keyboard navigation when listbox is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria('listbox', { disabled: true });
          const listboxEl = bind(document.createElement('div'), listbox);
          document.body.appendChild(listboxEl);

          const o1 = component().run(() => listbox.option({ value: 'opt-1' }));
          const o2 = component().run(() => listbox.option({ value: 'opt-2' }));

          const el1 = bind(document.createElement('div'), o1);
          const el2 = bind(document.createElement('div'), o2);

          listboxEl.appendChild(el1);
          listboxEl.appendChild(el2);

          el1.focus();

          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          listboxEl.dispatchEvent(downEvent);
          expect(document.activeElement).toBe(el1);

          listboxEl.remove();
        });
      }));

    it('supports manual navigation, orientation fallback, and parent rover keydown guard', () =>
      scope.run(() => {
        component().run(() => {
          const manualListbox = aria('listbox', { manual: false });
          const manualEl = bind(document.createElement('div'), manualListbox);
          manualEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

          delete (manualListbox.props as Record<string, unknown>).orientation;
          expect(manualListbox.orientation).toBe('vertical');

          // Parent rover ignores keydown
          roverCtx.set(manualListbox as unknown as Aria<BaseElement>);
          const childListbox = aria('listbox');
          const childEl = bind(document.createElement('div'), childListbox);
          childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          roverCtx.set(undefined);
        });
      }));

    it('compiles required and invalid states onto listbox container', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria('listbox', { required: true, invalid: true });
          expect(listbox.attributes['aria-required']).toBe('true');
          expect(listbox.attributes['aria-invalid']).toBe('true');

          const multiListbox = aria('listbox', { multiple: true, invalid: 'grammar' });
          expect(multiListbox.attributes['aria-invalid']).toBe('grammar');

          const defaultListbox = aria('listbox');
          expect(defaultListbox.attributes['aria-invalid']).toBeUndefined();

          const validListbox = aria('listbox', { invalid: false });
          expect(validListbox.attributes['aria-invalid']).toBe('false');
        });
      }));
  });
});
