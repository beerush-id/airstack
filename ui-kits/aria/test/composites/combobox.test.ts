import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ComboboxProps, selectionGroup } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Combobox - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Text Input & Dynamic Listbox Coordination Invariant', () => {
    it('compiles the combobox semantics onto the input and points it at a live popup', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ id: 'city-input', popupId: 'city-popup', open: false });
          const combo = aria('combobox', props);
          const inputEl = bind(document.createElement('input'), combo);

          const popup = aria('listbox', { label: 'Cities' });
          const popupEl = bind(document.createElement('div'), popup);
          popupEl.id = 'city-popup';
          document.body.append(inputEl, popupEl);

          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-haspopup')).toBe('listbox');
          expect(inputEl.getAttribute('aria-controls')).toBe('city-popup');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('list');
          expect(inputEl.hasAttribute('aria-activedescendant')).toBe(false);

          expect(popupEl.getAttribute('role')).toBe('listbox');
          expect(document.getElementById(inputEl.getAttribute('aria-controls') as string)).toBe(popupEl);

          // Typing lands in the input and never moves the caret away from it
          inputEl.focus();
          inputEl.value = 'Ank';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe('Ank');
          expect(document.activeElement).toBe(inputEl);

          // Re-pointing the popup moves the address with it
          popupEl.id = 'city-popup-2';
          props.popupId = 'city-popup-2';
          expect(inputEl.getAttribute('aria-controls')).toBe('city-popup-2');

          combo.destroy();
          popup.destroy();
          inputEl.remove();
          popupEl.remove();
        });
      }));

    it('projects each autocomplete mode and keeps the input reachable when disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ value: '' });
          const combo = aria('combobox', props);
          const inputEl = bind(document.createElement('input'), combo);

          expect(inputEl.getAttribute('aria-autocomplete')).toBe('list');

          props.autocomplete = 'none';
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('none');

          props.autocomplete = 'inline';
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('inline');

          props.autocomplete = 'both';
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('both');

          props.disabled = true;
          expect(inputEl.disabled).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          combo.destroy();
          inputEl.remove();
        });
      }));
  });

  describe('Filter Query & Active Selection Invariant', () => {
    it('keeps the typed query and the chosen option in separate stores', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ value: '', selected: undefined });
          const combo = aria('combobox', props);
          const inputEl = bind(document.createElement('input'), combo);

          const group = mutable({ value: undefined });
          selectionGroup.set(group);

          const popup = aria('listbox');
          const popupEl = bind(document.createElement('div'), popup);
          const oslo = aria('option', { value: 'oslo' });
          const austin = aria('option', { value: 'austin' });
          const osloEl = bind(document.createElement('div'), oslo);
          const austinEl = bind(document.createElement('div'), austin);
          popupEl.append(osloEl, austinEl);
          document.body.append(inputEl, popupEl);

          inputEl.focus();
          inputEl.value = 'au';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));

          // The query is text only: it selects nothing on its own
          expect(props.value).toBe('au');
          expect(props.selected).toBeUndefined();
          expect(group.value).toBeUndefined();
          expect(austinEl.getAttribute('aria-selected')).toBe('false');

          // Selection is owned by the option controller, not by the input
          austinEl.click();
          expect(group.value).toBe('austin');
          expect(austinEl.getAttribute('aria-selected')).toBe('true');
          expect(osloEl.getAttribute('aria-selected')).toBe('false');

          // Choosing an option leaves the query text exactly as the author typed it
          expect(props.value).toBe('au');

          // The combobox's own selection store is independent of both
          props.selected = 'oslo';
          expect(combo.selected).toBe('oslo');
          expect(props.value).toBe('au');

          combo.destroy();
          popup.destroy();
          oslo.destroy();
          austin.destroy();
          inputEl.remove();
          popupEl.remove();
        });
      }));

    it('announces a highlighted option without pulling focus out of the input', () =>
      scope.run(() => {
        component().run(() => {
          const group = mutable({ value: 'berlin' });
          selectionGroup.set(group);

          const combo = aria('combobox', { open: true });
          const inputEl = bind(document.createElement('input'), combo);

          const popup = aria('listbox');
          const popupEl = bind(document.createElement('div'), popup);
          const berlin = aria('option', { value: 'berlin' });
          const berlinEl = bind(document.createElement('div'), berlin);
          popupEl.appendChild(berlinEl);
          document.body.append(inputEl, popupEl);

          inputEl.focus();

          expect(inputEl.getAttribute('aria-expanded')).toBe('true');
          expect(berlinEl.getAttribute('aria-selected')).toBe('true');
          expect(document.activeElement).toBe(inputEl);

          // Virtual focus never travels through the DOM selection path
          expect(inputEl.contains(berlinEl)).toBe(false);
          expect(popupEl.contains(inputEl)).toBe(false);

          combo.destroy();
          popup.destroy();
          berlin.destroy();
          inputEl.remove();
          popupEl.remove();
        });
      }));
  });

  describe('Popup Visibility & Dismissal Invariant', () => {
    it('tracks the open prop in both directions without claiming a key of its own', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ popupId: 'popup', open: false });
          const combo = aria('combobox', props);
          const inputEl = bind(document.createElement('input'), combo);
          const popupEl = document.createElement('div');
          popupEl.id = 'popup';
          document.body.append(inputEl, popupEl);

          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          props.open = true;
          expect(combo.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          // The projection follows a write through the state setter too
          combo.open = false;
          expect(props.open).toBe(false);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          combo.destroy();
          inputEl.remove();
          popupEl.remove();
        });
      }));

    it('drops the popup address when the controller is torn down', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ popupId: 'popup', open: true });
          const combo = aria('combobox', props);
          const inputEl = bind(document.createElement('input'), combo);
          document.body.appendChild(inputEl);

          expect(inputEl.getAttribute('aria-controls')).toBe('popup');

          combo.destroy();
          expect(combo.current).toBeNull();

          props.open = false;
          props.popupId = 'other';

          // A destroyed coordinator stops rewriting the live element
          expect(inputEl.getAttribute('aria-controls')).toBe('popup');
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          inputEl.remove();
        });
      }));
  });
});
