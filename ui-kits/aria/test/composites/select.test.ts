import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Aria, aria, type BaseElement, roverCtx, selectCtx, type SelectProps } from '../../src/index.js';
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

          delete (manualSelect.properties as Record<string, unknown>).orientation;
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

  describe('Combobox Anchor & Popup Expansion Invariant', () => {
    it('anchors the popup through the trigger and hides it while closed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: 'one', open: false });
          const root = aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const option = aria('select-option', { value: 'one', label: 'One' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          const optionEl = bind(document.createElement('div'), option);
          popupEl.appendChild(optionEl);
          document.body.append(triggerEl, popupEl);

          // The trigger is the combobox; the popup is the listbox
          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-haspopup']).toBe('listbox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(popup.attributes.id);
          expect(popup.attributes.role).toBe('listbox');

          // A closed popup holds no options in the page
          expect(popupEl.hidden).toBe(true);
          expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);

          // Pointer, Enter and Space all toggle the same state
          triggerEl.click();
          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');
          expect(popupEl.hidden).toBe(false);

          triggerEl.click();
          expect(props.open).toBe(false);
          expect(popupEl.hidden).toBe(true);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          expect(props.open).toBe(true);

          triggerEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
          expect(props.open).toBe(false);

          // Escape closes without committing anything
          optionEl.click();
          expect(props.value).toBe('one');

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          expect(props.open).toBe(false);
          expect(props.value).toBe('one');
          expect(document.activeElement).toBe(triggerEl);

          root.destroy();
          trigger.destroy();
          popup.destroy();
          option.destroy();
          popupEl.remove();
          triggerEl.remove();
        });
      }));

    it('opens on the arrow keys and highlights the first or last enabled option', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: undefined, open: false });
          aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const first = aria('select-option', { value: 'a', label: 'Alpha' });
          aria('select-option', { value: 'b', label: 'Bravo', disabled: true });
          const last = aria('select-option', { value: 'c', label: 'Charlie' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          document.body.append(triggerEl, popupEl);
          triggerEl.focus();

          // Down opens and highlights the first enabled option without selecting it
          const down = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          });
          triggerEl.dispatchEvent(down);

          expect(props.open).toBe(true);
          expect(down.defaultPrevented).toBe(true);
          expect(props.value).toBeUndefined();
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(first.attributes.id);

          // Up from a closed popup lands on the last enabled option
          props.open = false;
          const up = new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            bubbles: true,
            cancelable: true,
          });
          triggerEl.dispatchEvent(up);

          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(last.attributes.id);

          trigger.destroy();
          popup.destroy();
          popupEl.remove();
          triggerEl.remove();
        });
      }));
  });

  describe('Active Descendant & Virtual Selection Invariant', () => {
    it('moves the highlight without moving DOM focus and commits on Enter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: undefined, open: true });
          const root = aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const first = aria('select-option', { value: 'x', label: 'Xray' });
          const blocked = aria('select-option', { value: 'y', label: 'Yankee', disabled: true });
          const second = aria('select-option', { value: 'z', label: 'Zulu' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          popupEl.append(
            bind(document.createElement('div'), first),
            bind(document.createElement('div'), blocked),
            bind(document.createElement('div'), second)
          );
          document.body.append(triggerEl, popupEl);
          triggerEl.focus();

          // The highlight walks, the focus stays on the combobox
          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(first.attributes.id);
          expect(document.activeElement).toBe(triggerEl);

          // A disabled option is passed over
          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(second.attributes.id);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(first.attributes.id);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(second.attributes.id);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(first.attributes.id);

          // Enter commits the highlighted option and closes a single-select popup
          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          expect(props.value).toBe('x');
          expect(props.open).toBe(false);
          expect(first.attributes['aria-selected']).toBe('true');
          expect(root.value).toBe('x');

          trigger.destroy();
          popup.destroy();
          first.destroy();
          blocked.destroy();
          second.destroy();
          popupEl.remove();
          triggerEl.remove();
        });
      }));

    it('keeps the popup open for further choices in multi-select', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ multiple: true, value: [], open: true });
          aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const one = aria('select-option', { value: 'one', label: 'One' });
          const two = aria('select-option', { value: 'two', label: 'Two' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          popupEl.append(bind(document.createElement('div'), one), bind(document.createElement('div'), two));
          document.body.append(triggerEl, popupEl);
          triggerEl.focus();

          expect(popup.attributes['aria-multiselectable']).toBe('true');

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

          expect(props.value).toEqual(['one']);
          expect(props.open).toBe(true);

          triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          triggerEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));

          expect(props.value).toEqual(['one', 'two']);
          expect(props.open).toBe(true);
          expect(one.attributes['aria-selected']).toBe('true');
          expect(two.attributes['aria-selected']).toBe('true');

          trigger.destroy();
          popup.destroy();
          one.destroy();
          two.destroy();
          popupEl.remove();
          triggerEl.remove();
        });
      }));
  });

  describe('Typeahead Query Match Invariant', () => {
    it('jumps to the option whose label matches the typed characters', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: undefined, open: true });
          aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const alpha = aria('select-option', { value: 'a', label: 'Alpha' });
          const bravo = aria('select-option', { value: 'b', label: 'Bravo' });
          const charlie = aria('select-option', { value: 'c', label: 'Charlie' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          popupEl.append(
            bind(document.createElement('div'), alpha),
            bind(document.createElement('div'), bravo),
            bind(document.createElement('div'), charlie)
          );
          document.body.append(triggerEl, popupEl);
          triggerEl.focus();

          const type = (key: string) =>
            triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

          type('b');
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(bravo.attributes.id);
          expect(props.value).toBeUndefined();

          type('c');
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(charlie.attributes.id);

          trigger.destroy();
          popup.destroy();
          alpha.destroy();
          bravo.destroy();
          charlie.destroy();
          popupEl.remove();
          triggerEl.remove();
        });
      }));

    it('accumulates a typeahead query until the debounce window closes', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<SelectProps>({ value: undefined, open: true });
          aria('select', props);
          const trigger = aria('select-trigger');
          const popup = aria('select-popup');
          const north = aria('select-option', { value: 'n', label: 'North' });
          const east = aria('select-option', { value: 'e', label: 'East' });

          const triggerEl = bind(document.createElement('button'), trigger);
          const popupEl = bind(document.createElement('div'), popup);
          popupEl.append(bind(document.createElement('div'), north), bind(document.createElement('div'), east));
          document.body.append(triggerEl, popupEl);
          triggerEl.focus();

          const type = (key: string) =>
            triggerEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

          // A second character inside the window extends the same query
          type('n');
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(north.attributes.id);

          type('o');
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(north.attributes.id);

          vi.advanceTimersByTime(500);

          // After the window the next character starts a fresh query
          type('e');
          expect(triggerEl.getAttribute('aria-activedescendant')).toBe(east.attributes.id);

          trigger.destroy();
          popup.destroy();
          north.destroy();
          east.destroy();
          popupEl.remove();
          triggerEl.remove();

          vi.useRealTimers();
        });
      }));
  });
});
