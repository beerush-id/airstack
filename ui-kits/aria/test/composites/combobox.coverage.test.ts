import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ComboboxProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCombobox(props: ComboboxProps, options: Array<{ value: string; text: string; disabled?: boolean }>) {
  const combobox = aria<HTMLElement>('combobox', props);
  const comboboxEl = bind(document.createElement('div'), combobox);
  document.body.appendChild(comboboxEl);

  const input = combobox.input();
  const inputEl = bind(document.createElement('input'), input);
  comboboxEl.appendChild(inputEl);

  const panel = combobox.panel();
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

describe('Combobox - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Defaults Invariant', () => {
    it('orchestrates with defaults when constructed bare', () =>
      scope.run(() => {
        component().run(() => {
          const combobox = aria<HTMLElement>('combobox');
          const comboboxEl = bind(document.createElement('div'), combobox);
          document.body.appendChild(comboboxEl);

          const input = combobox.input();
          const inputEl = bind(document.createElement('input'), input);
          comboboxEl.appendChild(inputEl);

          const panel = combobox.panel();
          const panelEl = bind(document.createElement('div'), panel);
          comboboxEl.appendChild(panelEl);

          expect(combobox.attributes.role).toBeUndefined();
          expect(combobox.open).toBe(false);
          expect(combobox.multiple).toBe(false);
          expect(combobox.query).toBe('');
          expect(input.attributes.role).toBe('combobox');
          expect(input.attributes['aria-autocomplete']).toBe('list');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(panel.attributes.role).toBe('listbox');
          expect(panel.open).toBe(false);

          inputEl.focus();
          expect(combobox.open).toBe(true);
          expect(panel.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          panel.destroy();
          input.destroy();
          combobox.destroy();
          comboboxEl.remove();
        });
      }));
  });

  describe('Identity Invariant', () => {
    it('wires an explicit id into aria-controls and the panel id', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false, id: 'city' });
          const { inputEl, panelEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(inputEl.getAttribute('aria-controls')).toBe('city-panel');
          expect(panelEl.getAttribute('id')).toBe('city-panel');
          expect(document.getElementById('city-panel')).toBe(panelEl);

          cleanup();
        });
      }));
  });

  describe('State Projections Invariant', () => {
    it('writes query and value through their projections', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          combobox.query = 'oslo';
          expect(props.query).toBe('oslo');
          expect(combobox.query).toBe('oslo');

          combobox.value = 'a';
          expect(props.value).toBe('a');
          expect(combobox.value).toBe('a');

          combobox.open = true;
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('reads multiple through the combobox multiple getter', () =>
      scope.run(() => {
        component().run(() => {
          const single = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const first = buildCombobox(single, [{ value: 'a', text: 'Amsterdam' }]);
          expect(first.combobox.multiple).toBe(false);
          first.cleanup();

          const multi = mutable<ComboboxProps>({ query: '', value: [], open: false, multiple: true });
          const second = buildCombobox(multi, [{ value: 'a', text: 'Amsterdam' }]);
          expect(second.combobox.multiple).toBe(true);
          second.cleanup();
        });
      }));
  });

  describe('Empty Popup Invariant', () => {
    it('travels and commits nothing when the popup holds no options', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: true });
          const { combobox, panel, inputEl, cleanup } = buildCombobox(props, []);

          inputEl.focus();
          press(inputEl, 'ArrowDown');
          press(inputEl, 'Home');
          press(inputEl, 'End');
          press(inputEl, 'Enter');

          expect(combobox.value).toBeNull();
          expect(props.open).toBe(true);
          expect(panel.attributes.role).toBe('listbox');

          cleanup();
        });
      }));
  });

  describe('Custom Host Invariant', () => {
    it('compiles combobox semantics on a custom-host input', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const combobox = aria<HTMLElement>('combobox', props);
          const comboboxEl = bind(document.createElement('div'), combobox);
          document.body.appendChild(comboboxEl);

          const input = combobox.input({}, { native: false });
          const inputEl = bind(document.createElement('div'), input);
          comboboxEl.appendChild(inputEl);

          const panel = combobox.panel();
          const panelEl = bind(document.createElement('div'), panel);
          comboboxEl.appendChild(panelEl);

          expect(input.attributes.role).toBe('combobox');
          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-autocomplete')).toBe('list');
          expect(inputEl.getAttribute('tabindex')).toBe('0');
          expect(inputEl.hasAttribute('type')).toBe(false);

          inputEl.focus();
          expect(props.open).toBe(true);

          panel.destroy();
          input.destroy();
          combobox.destroy();
          comboboxEl.remove();
        });
      }));

    it('locks out a disabled custom-host input', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false, disabled: true });
          const combobox = aria<HTMLElement>('combobox', props);
          const comboboxEl = bind(document.createElement('div'), combobox);
          document.body.appendChild(comboboxEl);

          const input = combobox.input({}, { native: false });
          const inputEl = bind(document.createElement('div'), input);
          comboboxEl.appendChild(inputEl);

          const panel = combobox.panel();
          const panelEl = bind(document.createElement('div'), panel);
          comboboxEl.appendChild(panelEl);

          expect(inputEl.getAttribute('tabindex')).toBe('-1');
          expect(inputEl.getAttribute('aria-disabled')).toBe('true');

          inputEl.click();
          press(inputEl, 'ArrowDown');
          expect(props.open).toBe(false);

          panel.destroy();
          input.destroy();
          combobox.destroy();
          comboboxEl.remove();
        });
      }));
  });

  describe('Ambient Guards Invariant', () => {
    it('leaves typing inert on an input with no orchestrating combobox', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLInputElement>('combobox-input');
          const inputEl = bind(document.createElement('input'), input);
          document.body.appendChild(inputEl);

          inputEl.focus();
          type(inputEl, 'Oslo');

          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(inputEl.value).toBe('Oslo');

          input.destroy();
          inputEl.remove();
        });
      }));

    it('commits as a plain listbox when no combobox orchestrates the panel', () =>
      scope.run(() => {
        component().run(() => {
          const panel = aria<HTMLElement>('combobox-panel', { value: undefined, open: true });
          const panelEl = bind(document.createElement('div'), panel);
          document.body.appendChild(panelEl);

          const option = aria<HTMLElement>('option', { value: 'a' });
          const optionEl = bind(document.createElement('div'), option);
          panelEl.appendChild(optionEl);

          optionEl.click();

          expect(panel.value).toBe('a');
          expect(optionEl.getAttribute('aria-selected')).toBe('true');

          option.destroy();
          panel.destroy();
          panelEl.remove();
        });
      }));
  });

  describe('Shielding Invariant', () => {
    it('shields the compiled combobox semantics from refiners', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { input, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          input.refine(() => ({
            role: 'textbox',
            'aria-autocomplete': 'both',
            'aria-expanded': 'true',
          }));

          expect(input.attributes.role).toBe('combobox');
          expect(input.attributes['aria-autocomplete']).toBe('list');
          expect(input.attributes['aria-expanded']).toBe('false');

          cleanup();
        });
      }));

    it('shields value, query, and open from refiners on the orchestrator', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: 'am', value: null, open: false });
          const { combobox, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          combobox.refine(() => ({ value: 'a', query: 'zzz', open: true }));

          expect(combobox.value).toBeNull();
          expect(combobox.query).toBe('am');
          expect(combobox.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Panel Absent Invariant', () => {
    it('leaves the query empty when leaving before any panel is mounted', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const combobox = aria<HTMLElement>('combobox', props);
          const comboboxEl = bind(document.createElement('div'), combobox);
          document.body.appendChild(comboboxEl);

          const input = combobox.input();
          const inputEl = bind(document.createElement('input'), input);
          comboboxEl.appendChild(inputEl);

          const outside = document.createElement('button');
          document.body.appendChild(outside);

          inputEl.focus();
          type(inputEl, 'am');
          expect(combobox.query).toBe('am');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(combobox.query).toBe('');
          expect(props.open).toBe(false);

          outside.remove();
          input.destroy();
          combobox.destroy();
          comboboxEl.remove();
        });
      }));
    it('names nothing on leaving while no panel is mounted to read the choice from', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: 'berlin', value: 'b', open: false });
          const combobox = aria<HTMLElement>('combobox', props);
          const comboboxEl = bind(document.createElement('div'), combobox);
          document.body.appendChild(comboboxEl);

          const input = combobox.input();
          const inputEl = bind(document.createElement('input'), input);
          comboboxEl.appendChild(inputEl);

          const outside = document.createElement('button');
          document.body.appendChild(outside);

          inputEl.focus();
          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(combobox.query).toBe('');
          expect(props.value).toBe('b');

          outside.remove();
          input.destroy();
          combobox.destroy();
          comboboxEl.remove();
        });
      }));
  });

  describe('Focus Without Destination Invariant', () => {
    it('treats a focus move to nowhere as leaving the composite', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: 'a', open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          inputEl.focus();
          type(inputEl, 'ams');
          expect(combobox.query).toBe('ams');

          inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

          expect(combobox.query).toBe('');
          expect(combobox.text).toBe('Amsterdam');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Fresh Typing Invariant', () => {
    it('keeps multiple values when the filter is emptied by hand', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: [], open: true, multiple: true });
          const { combobox, inputEl, members, cleanup } = buildCombobox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[0].el.click();
          members[1].el.click();
          expect(props.value).toEqual(['a', 'b']);

          inputEl.focus();
          type(inputEl, '');

          expect(combobox.query).toBe('');
          expect(props.value).toEqual(['a', 'b']);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('leaves an empty single combobox untouched when cleared by hand', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          inputEl.focus();
          type(inputEl, '');

          expect(combobox.query).toBe('');
          expect(combobox.value).toBeNull();
          expect(combobox.text).toBe('');

          cleanup();
        });
      }));
  });

  describe('Teardown Invariant', () => {
    it('stops rewriting the live input once the orchestrator is destroyed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ComboboxProps>({ query: '', value: null, open: false });
          const { combobox, inputEl, cleanup } = buildCombobox(props, [{ value: 'a', text: 'Amsterdam' }]);

          inputEl.focus();
          type(inputEl, 'Am');
          expect(props.open).toBe(true);

          combobox.destroy();

          press(inputEl, 'Escape');
          expect(combobox.query).toBe('Am');

          inputEl.remove();
          cleanup();
        });
      }));
  });
});
