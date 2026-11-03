import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, SelectAria, SelectPanelAria, type SelectProps, SelectTriggerAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildSelect(props: SelectProps, options: Array<{ value: string; text: string; disabled?: boolean }>) {
  const select = aria<HTMLElement>('select', props);
  const selectEl = bind(document.createElement('div'), select);
  document.body.appendChild(selectEl);

  const trigger = aria<HTMLButtonElement>('select-trigger', {});
  const triggerEl = bind(document.createElement('button'), trigger);
  selectEl.appendChild(triggerEl);

  const panel = aria<HTMLElement>('select-panel', {});
  const panelEl = bind(document.createElement('div'), panel);
  selectEl.appendChild(panelEl);

  const members = options.map(({ value, text, disabled }) => {
    const option = aria<HTMLElement>('option', { value, disabled });
    const el = bind(document.createElement('div'), option);
    el.textContent = text;
    panelEl.appendChild(el);
    return { value, option, el };
  });

  const cleanup = () => {
    for (const { option } of members) option.destroy();
    panel.destroy();
    trigger.destroy();
    select.destroy();
    selectEl.remove();
  };

  return { select, selectEl, trigger, triggerEl, panel, panelEl, members, cleanup };
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Select - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Public Read Surface', () => {
    it('exposes the id, the labels of the current choice, and the part factories', () =>
      scope.run(() => {
        component().run(() => {
          const select = new SelectAria({ id: 'picker', value: 'b' }, { a: 'Alpha', b: 'Beta' });

          expect(select.id).toBe('picker');
          expect(select.label).toBe('Beta');

          const panel = select.panel();
          const trigger = select.trigger();

          expect(panel).toBeInstanceOf(SelectPanelAria);
          expect(trigger).toBeInstanceOf(SelectTriggerAria);
          expect(trigger.value).toBe('b');
          expect(trigger.text).toBe('');
          expect(trigger.label).toBe('Beta');

          const multi = new SelectAria({ value: ['a', 'b'], multiple: true }, { a: 'Alpha', b: 'Beta' });
          expect(multi.label).toBe('Alpha, Beta');

          const unknown = new SelectAria({ value: 'missing' }, { a: 'Alpha' });
          expect(unknown.label).toBe('');

          panel.destroy();
          trigger.destroy();
          multi.destroy();
          unknown.destroy();
          select.destroy();
        });
      }));

    it('reads an empty label when nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const select = new SelectAria({ id: 'empty' }, { a: 'Alpha' });

          expect(select.label).toBe('');
          expect(select.text).toBe('');

          select.destroy();
        });
      }));

    it('keeps a trigger built without a select inert and honors explicit trigger options', () =>
      scope.run(() => {
        component().run(() => {
          const orphan = new SelectTriggerAria({});

          expect(orphan.value).toBeUndefined();
          expect(orphan.text).toBe('');
          expect(orphan.label).toBe('');

          orphan.destroy();

          const select = new SelectAria({ id: 'picker', value: 'a' }, { a: 'Alpha' });
          const custom = select.trigger({}, { native: false });
          const el = bind(document.createElement('div'), custom);
          document.body.appendChild(el);

          expect(custom.value).toBe('a');
          expect(custom.label).toBe('Alpha');

          custom.destroy();
          select.destroy();
          el.remove();
        });
      }));
  });

  describe('Defaults Invariant', () => {
    it('orchestrates with defaults when constructed bare', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria<HTMLElement>('select');
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const trigger = aria<HTMLButtonElement>('select-trigger');
          const triggerEl = bind(document.createElement('button'), trigger);
          selectEl.appendChild(triggerEl);

          const panel = aria<HTMLElement>('select-panel');
          const panelEl = bind(document.createElement('div'), panel);
          selectEl.appendChild(panelEl);

          expect(select.attributes.role).toBeUndefined();
          expect(select.open).toBe(false);
          expect(select.multiple).toBe(false);
          expect(trigger.attributes.role).toBe('combobox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');
          expect(panel.attributes.role).toBe('listbox');

          triggerEl.click();
          expect(select.open).toBe(true);

          panel.destroy();
          trigger.destroy();
          select.destroy();
          selectEl.remove();
        });
      }));
  });

  describe('Identity Invariant', () => {
    it('wires an explicit id into aria-controls and the panel id', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false, id: 'fruit' });
          const { triggerEl, panelEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(triggerEl.getAttribute('aria-controls')).toBe('fruit-panel');
          expect(panelEl.getAttribute('id')).toBe('fruit-panel');
          expect(document.getElementById('fruit-panel')).toBe(panelEl);

          cleanup();
        });
      }));
  });

  describe('Programmatic Open Invariant', () => {
    it('opens and closes through the select open setter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, triggerEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          select.open = true;
          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          select.open = false;
          expect(props.open).toBe(false);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('reads multiple through the select multiple getter', () =>
      scope.run(() => {
        component().run(() => {
          const single = mutable<SelectProps>({ open: false });
          const first = buildSelect(single, [{ value: 'a', text: 'Amsterdam' }]);
          expect(first.select.multiple).toBe(false);
          first.cleanup();

          const multi = mutable<SelectProps>({ value: [], open: false, multiple: true });
          const second = buildSelect(multi, [{ value: 'a', text: 'Amsterdam' }]);
          expect(second.select.multiple).toBe(true);
          second.cleanup();
        });
      }));
  });

  describe('Value Accessor Invariant', () => {
    it('reads and writes the selection through the value accessor', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(select.value).toBeUndefined();

          select.value = 'b';
          expect(select.value).toBe('b');
          expect(props.value).toBe('b');

          cleanup();
        });
      }));

    it('reads empty text by default and normalizes assigned text', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(select.text).toBe('');

          select.text = 'Berlin';
          expect(select.text).toBe('Berlin');

          select.text = undefined as unknown as string;
          expect(select.text).toBe('');

          cleanup();
        });
      }));

    it('leaves text alone when capturing without a bound element', () =>
      scope.run(() => {
        component().run(() => {
          const select = aria<HTMLElement>('select', {});
          select.text = 'keep';

          select.captureChange();
          expect(select.text).toBe('keep');

          const bare = aria<HTMLElement>('select', {});
          expect(bare.text).toBe('');
          bare.destroy();

          select.destroy();
        });
      }));

    it('creates bound panel and trigger instances through the factories', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          const panel = select.panel();
          expect(panel).toBeInstanceOf(SelectPanelAria);
          panel.destroy();

          const trigger = select.trigger();
          expect(trigger).toBeInstanceOf(SelectTriggerAria);
          trigger.destroy();

          cleanup();
        });
      }));

    it('reads popup visibility through the panel open getter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, panel, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(panel.open).toBe(false);

          select.open = true;
          expect(panel.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Custom Host Invariant', () => {
    it('compiles combobox semantics on a custom-host trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const select = aria<HTMLElement>('select', props);
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const trigger = aria<HTMLElement>('select-trigger', {}, { native: false });
          const triggerEl = bind(document.createElement('div'), trigger);
          selectEl.appendChild(triggerEl);

          const panel = aria<HTMLElement>('select-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          selectEl.appendChild(panelEl);

          expect(trigger.attributes.role).toBe('combobox');
          expect(triggerEl.getAttribute('role')).toBe('combobox');
          expect(triggerEl.getAttribute('tabindex')).toBe('0');
          expect(triggerEl.hasAttribute('type')).toBe(false);

          triggerEl.click();
          expect(props.open).toBe(true);

          panel.destroy();
          trigger.destroy();
          select.destroy();
          selectEl.remove();
        });
      }));

    it('locks out a disabled custom-host trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false, disabled: true });
          const select = aria<HTMLElement>('select', props);
          const selectEl = bind(document.createElement('div'), select);
          document.body.appendChild(selectEl);

          const trigger = aria<HTMLElement>('select-trigger', {}, { native: false });
          const triggerEl = bind(document.createElement('div'), trigger);
          selectEl.appendChild(triggerEl);

          const panel = aria<HTMLElement>('select-panel', {});
          const panelEl = bind(document.createElement('div'), panel);
          selectEl.appendChild(panelEl);

          expect(triggerEl.getAttribute('tabindex')).toBe('-1');
          expect(triggerEl.getAttribute('aria-disabled')).toBe('true');

          triggerEl.click();
          press(triggerEl, 'Enter');
          press(triggerEl, ' ');
          press(triggerEl, 'ArrowDown');
          expect(props.open).toBe(false);

          panel.destroy();
          trigger.destroy();
          select.destroy();
          selectEl.remove();
        });
      }));
  });
});
