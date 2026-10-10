import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ComboboxChangeEvent, type ComboboxInputEvent, type ComboboxProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCombobox(props: ComboboxProps, options: Array<{ value: string; text: string; disabled?: boolean }>) {
  const combobox = aria<HTMLElement>('combobox', props);
  const comboboxEl = bind(document.createElement('div'), combobox);
  document.body.appendChild(comboboxEl);

  const input = aria<HTMLInputElement>('combobox-input', {});
  const inputEl = bind(document.createElement('input'), input);
  comboboxEl.appendChild(inputEl);

  const panel = aria<HTMLElement>('combobox-panel', {});
  const panelEl = bind(document.createElement('div'), panel);
  comboboxEl.appendChild(panelEl);

  const members = options.map(({ value, text, disabled }) => {
    const option = aria<HTMLElement>('option', { value, disabled });
    const el = bind(document.createElement('div'), option);
    el.textContent = text;
    panelEl.appendChild(el);
    return { value, text, option, el };
  });

  const cleanup = () => {
    for (const { option } of members) option.destroy();
    panel.destroy();
    input.destroy();
    combobox.destroy();
    comboboxEl.remove();
  };

  return { combobox, comboboxEl, input, inputEl, panel, panelEl, members, cleanup };
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

function type(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
}

describe('Combobox - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Input Semantics Invariant', () => {
    it('compiles the combobox onto the input and points it at the live popup', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ open: false });
          const { combobox, input, panel, inputEl, panelEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(combobox.attributes.role).toBeUndefined();
          expect(input.attributes.role).toBe('combobox');
          expect(input.attributes['aria-autocomplete']).toBe('list');
          expect(input.attributes['aria-haspopup']).toBe('listbox');
          expect(input.attributes['aria-expanded']).toBe('false');

          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('list');
          expect(inputEl.getAttribute('aria-haspopup')).toBe('listbox');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(inputEl.type).toBe('text');
          expect(panel.attributes.role).toBe('listbox');
          expect(panelEl.getAttribute('role')).toBe('listbox');

          const controls = inputEl.getAttribute('aria-controls');
          expect(controls).toBeTruthy();
          expect(document.getElementById(controls as string)).toBe(panelEl);

          cleanup();
        });
      }));

    it('follows the open state in both directions through the input projection', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          props.open = true;
          expect(combobox.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          combobox.open = false;
          expect(props.open).toBe(false);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));
  });

  describe('Query & Value Invariant', () => {
    it('stores typed text as the query and opens the popup without selecting anything', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'Am');

          expect(combobox.query).toBe('Am');
          expect(props.value).toBeNull();
          expect(props.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');
          expect(members[0].el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));

    it('keeps the caret in the field while typing opens the popup', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, panelEl, inputEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'Am');

          expect(combobox.query).toBe('Am');
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');
          expect(document.activeElement).toBe(inputEl);
          expect(panelEl.getAttribute('tabindex')).toBe('0');

          type(inputEl, 'Amb');
          expect(combobox.query).toBe('Amb');
          expect(document.activeElement).toBe(inputEl);

          cleanup();
        });
      }));

    it('leaves the popup reachable from the field through the tab order', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: 'a', open: false });
          const { inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'A');

          expect(document.activeElement).toBe(inputEl);
          expect(members[0].el.getAttribute('tabindex')).toBe('0');
          expect(members[1].el.getAttribute('tabindex')).toBe('-1');

          cleanup();
        });
      }));

    it('treats the query as plain state across dismissal', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          inputEl.focus();
          type(inputEl, 'Am');
          expect(props.open).toBe(true);

          press(inputEl, 'Escape');

          expect(props.open).toBe(false);
          expect(combobox.query).toBe('Am');
          expect(combobox.value).toBeNull();

          type(inputEl, 'Amst');
          expect(combobox.query).toBe('Amst');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Combo Trigger Invariant', () => {
    it('opens the popup when the field receives focus without taking the caret', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { input, inputEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(input.attributes.role).toBe('combobox');

          inputEl.focus();

          expect(props.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');
          expect(document.activeElement).toBe(inputEl);

          cleanup();
        });
      }));

    it('sends focus into the list on the arrows and commits nothing on the way', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          expect(document.activeElement).toBe(inputEl);

          press(inputEl, 'ArrowDown');
          expect(document.activeElement).toBe(members[0].el);
          expect(combobox.value).toBeNull();

          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[1].el);
          expect(combobox.value).toBeNull();

          cleanup();
        });
      }));

    it('lands on the selected option when the arrows carry focus into the list', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: 'b', open: false });
          const { inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          press(inputEl, 'ArrowDown');

          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toBe('b');

          cleanup();
        });
      }));

    it('keeps the popup open when focus leaves the field', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { inputEl, members, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          inputEl.focus();
          expect(props.open).toBe(true);

          inputEl.dispatchEvent(new FocusEvent('blur'));
          members[0].el.focus();

          expect(props.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Selection Text Invariant', () => {
    it('publishes the chosen label as text and frees the filter after a commit', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'be');

          members[1].el.click();

          expect(combobox.value).toBe('b');
          expect(combobox.text).toBe('Berlin');
          expect(combobox.query).toBe('');

          cleanup();
        });
      }));

    it('shows the chosen text again when focus leaves the composite', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: 'Berlin', value: 'b', open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          const outside = document.createElement('button');
          document.body.appendChild(outside);

          inputEl.focus();
          type(inputEl, 'ber');
          expect(combobox.query).toBe('ber');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(combobox.query).toBe('');
          expect(combobox.text).toBe('Berlin');
          expect(props.open).toBe(false);

          outside.remove();

          cleanup();
        });
      }));

    it('keeps the filter text while focus only moves into the list', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, panelEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'am');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: panelEl }));

          expect(combobox.query).toBe('am');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('clears the filter text on leaving when nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          const outside = document.createElement('button');
          document.body.appendChild(outside);

          inputEl.focus();
          type(inputEl, 'zz');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(combobox.query).toBe('');
          expect(combobox.value).toBeNull();
          expect(props.open).toBe(false);

          outside.remove();
          cleanup();
        });
      }));

    it('keeps the popup open while focus moves into a detached panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, panelEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          const host = document.createElement('div');
          document.body.appendChild(host);
          host.appendChild(panelEl);

          inputEl.focus();
          type(inputEl, 'be');
          expect(combobox.query).toBe('be');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: members[1].el }));
          expect(props.open).toBe(true);
          expect(combobox.query).toBe('be');

          members[1].el.click();
          expect(combobox.value).toBe('b');
          expect(combobox.text).toBe('Berlin');
          expect(combobox.query).toBe('');

          host.remove();
          cleanup();
        });
      }));

    it('clears the text when the selection is absent on leaving', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();
          expect(combobox.text).toBe('Berlin');

          members[1].el.remove();

          inputEl.focus();
          type(inputEl, 'zz');
          expect(combobox.query).toBe('zz');

          const outside = document.createElement('button');
          document.body.appendChild(outside);
          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(combobox.query).toBe('');
          expect(combobox.text).toBe('');
          expect(combobox.value).toBe('b');

          outside.remove();
          cleanup();
        });
      }));

    it('travels the whole list again after a choice, because the filter was freed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, panel, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
            { value: 'c', text: 'Copenhagen' },
          ]);

          members[1].el.click();
          expect(combobox.text).toBe('Berlin');
          expect(combobox.query).toBe('');

          inputEl.focus();
          press(inputEl, 'ArrowDown');

          expect(document.activeElement).toBe(members[1].el);

          press(members[1].el, 'ArrowDown');

          expect(document.activeElement).toBe(members[2].el);
          expect(panel.attributes.role).toBe('listbox');

          cleanup();
        });
      }));
  });

  describe('Fresh Typing Invariant', () => {
    it('clears the selection when the field is emptied by hand', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();
          expect(combobox.value).toBe('b');
          expect(combobox.text).toBe('Berlin');

          inputEl.focus();
          type(inputEl, '');

          expect(combobox.query).toBe('');
          expect(combobox.value).toBeUndefined();
          expect(combobox.text).toBe('');
          expect(inputEl.value).toBe('');

          cleanup();
        });
      }));

    it('treats appended typing after a choice as a fresh filter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();
          expect(combobox.text).toBe('Berlin');

          type(inputEl, 'Berlind');

          expect(combobox.query).toBe('d');
          expect(combobox.value).toBe('b');
          expect(combobox.text).toBe('Berlin');

          cleanup();
        });
      }));

    it('treats replaced text as a fresh filter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();

          type(inputEl, 'x');

          expect(combobox.query).toBe('x');
          expect(combobox.value).toBe('b');

          cleanup();
        });
      }));

    it('keeps a partial deletion verbatim', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();

          type(inputEl, 'Berli');

          expect(combobox.query).toBe('Berli');
          expect(combobox.value).toBe('b');

          cleanup();
        });
      }));

    it('selects the shown label on focus so typing replaces it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[1].el.click();
          inputEl.value = combobox.query || combobox.text;

          inputEl.focus();

          expect(document.activeElement).toBe(inputEl);
          expect(inputEl.value).toBe('Berlin');
          expect(inputEl.selectionStart).toBe(0);
          expect(inputEl.selectionEnd).toBe(6);

          cleanup();
        });
      }));
  });

  describe('Toggling Invariant', () => {
    it('opens on focus and on the arrows while closed, and stays open on a click', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { input, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(input.attributes.role).toBe('combobox');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          inputEl.focus();
          expect(props.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          inputEl.click();
          expect(props.open).toBe(true);

          props.open = false;
          press(inputEl, 'ArrowDown');
          expect(props.open).toBe(true);

          props.open = false;
          press(inputEl, 'ArrowUp');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('closes on Escape without committing and restores focus to the input', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          expect(props.open).toBe(true);

          members[1].el.focus();
          press(members[1].el, 'Escape');

          expect(props.open).toBe(false);
          expect(props.value).toBeNull();
          expect(document.activeElement).toBe(inputEl);

          cleanup();
        });
      }));
  });

  describe('Composition & Commit Invariant', () => {
    it('closes on single commit and stays open on multiple commit', () =>
      scope.run(() => {
        component().run(() => {
          const single = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const first = buildCombobox(single, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(first.input.attributes.role).toBe('combobox');
          expect(first.panel.attributes.role).toBe('listbox');
          expect(first.inputEl.getAttribute('aria-expanded')).toBe('true');

          first.members[0].el.click();
          expect(first.combobox.value).toBe('a');
          expect(single.open).toBe(false);
          first.cleanup();
        });
      }));

    it('keeps multiple values on the host and leaves the popup open after commit', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: [], open: true, multiple: true });
          const { input, panel, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(input.attributes.role).toBe('combobox');
          expect(panel.attributes.role).toBe('listbox');
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          members[0].el.click();
          expect(props.value).toEqual(['a']);
          expect(props.open).toBe(true);

          members[1].el.click();
          expect(props.value).toEqual(['a', 'b']);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('claims the first mounted option while required and nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', open: true, required: true });
          const { combobox, panel, input, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(input.attributes.role).toBe('combobox');
          expect(panel.attributes.role).toBe('listbox');

          expect(props.value).toBe('a');
          expect(combobox.value).toBe('a');
          expect(combobox.query).toBe('');
          expect(members[0].el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));

    it('refuses typing, toggling, and committing while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false, disabled: true });
          const { combobox, input, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(input.attributes.role).toBe('combobox');
          expect(inputEl.disabled).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          inputEl.focus();
          type(inputEl, 'Am');
          expect(combobox.query).toBe('');

          inputEl.click();
          expect(props.open).toBe(false);

          press(inputEl, 'ArrowDown');
          expect(props.open).toBe(false);

          members[0].el.click();
          expect(combobox.value).toBeNull();
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Announcement Invariant', () => {
    it('forwards roving as input and commits as change with the updated value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: 'a', open: true });
          const { comboboxEl, panelEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          const roved: unknown[] = [];
          const changes: unknown[] = [];
          panelEl.addEventListener('input', (event) => roved.push((event as ComboboxInputEvent).detail));
          comboboxEl.addEventListener('change', (event) => {
            if (event.target === comboboxEl) changes.push((event as ComboboxChangeEvent).detail);
          });

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(roved).toEqual(['a', 'b']);

          press(members[1].el, 'Enter');
          expect(props.value).toBe('b');
          expect(changes).toEqual(['b']);

          cleanup();
        });
      }));

    it('emits open and close when the popup visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { comboboxEl, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          const opened: unknown[] = [];
          const closed: unknown[] = [];
          comboboxEl.addEventListener('open', () => opened.push(true));
          comboboxEl.addEventListener('close', () => closed.push(true));

          inputEl.focus();
          expect(opened).toEqual([true]);

          press(inputEl, 'Escape');
          expect(closed).toEqual([true]);

          cleanup();
        });
      }));

    it('closes on outside click and emits close', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { comboboxEl, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          const closed: unknown[] = [];
          comboboxEl.addEventListener('close', () => closed.push(true));

          const outside = document.createElement('div');
          document.body.appendChild(outside);
          outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

          expect(props.open).toBe(false);
          expect(closed).toEqual([true]);

          outside.remove();
          cleanup();
        });
      }));

    it('invokes onopen and onclose across visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          let opened = 0;
          let closed = 0;
          const props = mutable<ComboboxProps>({
            query: '',
            value: null,
            open: false,
            onopen: () => {
              opened += 1;
            },
            onclose: () => {
              closed += 1;
            },
          });
          const { input, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(input.attributes.role).toBe('combobox');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          inputEl.focus();
          expect(opened).toBe(1);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          press(inputEl, 'Escape');
          expect(closed).toBe(1);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));
  });

  describe('Filter Retention Invariant', () => {
    it('keeps the typed filter when arrowing into a teleported panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, comboboxEl, inputEl, panelEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
            { value: 'c', text: 'Copenhagen' },
          ]);

          const host = document.createElement('div');
          document.body.appendChild(host);
          host.appendChild(panelEl);

          const seen: Array<EventTarget | null> = [];
          comboboxEl.addEventListener('focusout', (event) => {
            seen.push((event as FocusEvent).relatedTarget);
          });

          inputEl.focus();
          type(inputEl, 'd');
          expect(combobox.query).toBe('d');

          press(inputEl, 'ArrowDown');
          expect(document.activeElement).toBe(members[0].el);
          expect(combobox.query).toBe('d');

          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[1].el);
          expect(combobox.query).toBe('d');
          expect(seen.length).toBeGreaterThan(0);

          host.remove();
          cleanup();
        });
      }));

    it('ignores the native change the field fires on blur after typing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'd');
          expect(combobox.query).toBe('d');

          members[0].el.focus();
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));

          expect(combobox.query).toBe('d');
          expect(combobox.text).toBe('');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });
});
