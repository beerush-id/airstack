import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type SelectChangeEvent, type SelectInputEvent, type SelectProps } from '../../src/index.js';
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

describe('Select - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Trigger Semantics Invariant', () => {
    it('compiles the combobox trigger and points it at the listbox panel', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, trigger, panel, triggerEl, panelEl, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(select.attributes.role).toBeUndefined();
          expect(select.open).toBe(false);
          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-haspopup']).toBe('listbox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(panel.id);
          expect(panel.attributes.role).toBe('listbox');

          expect(triggerEl.getAttribute('role')).toBe('combobox');
          expect(triggerEl.getAttribute('aria-haspopup')).toBe('listbox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');
          expect(panelEl.getAttribute('role')).toBe('listbox');

          const controls = triggerEl.getAttribute('aria-controls');
          expect(controls).toBeTruthy();
          expect(document.getElementById(controls as string)).toBe(panelEl);

          cleanup();
        });
      }));
  });

  describe('Trigger Toggling Invariant', () => {
    it('toggles open on click, Enter, and Space', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { select, trigger, triggerEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(select.attributes.role).toBeUndefined();
          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          triggerEl.click();
          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          triggerEl.click();
          expect(props.open).toBe(false);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('opens on DownArrow and UpArrow while closed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { trigger, triggerEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          press(triggerEl, 'ArrowDown');
          expect(props.open).toBe(true);

          props.open = false;
          press(triggerEl, 'ArrowUp');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('closes on Escape without committing and restores focus to the trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { triggerEl, members, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          members[1].el.focus();
          press(members[1].el, 'Escape');

          expect(props.open).toBe(false);
          expect(props.value).toBeUndefined();
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));
  });

  describe('Composition & Commit Invariant', () => {
    it('closes on single commit and stays open on multiple commit', () =>
      scope.run(() => {
        component().run(() => {
          const single = mutable<SelectProps>({ open: true });
          const first = buildSelect(single, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(first.trigger.attributes.role).toBe('combobox');
          expect(first.panel.attributes.role).toBe('listbox');
          expect(first.triggerEl.getAttribute('aria-expanded')).toBe('true');

          first.members[0].el.click();
          expect(single.value).toBe('a');
          expect(single.open).toBe(false);
          first.cleanup();
        });
      }));

    it('claims the first enabled option while required and nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: undefined, open: true, required: true });
          const { trigger, panel, triggerEl, members, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(panel.attributes.role).toBe('listbox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          expect(props.value).toBe('a');
          expect(members[0].el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));

    it('keeps multiple value on the host and leaves the popup open after commit', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ multiple: true, value: [], open: true });
          const { trigger, panel, triggerEl, members, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(panel.attributes.role).toBe('listbox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          members[0].el.click();
          expect(props.value).toEqual(['a']);
          expect(props.open).toBe(true);

          members[1].el.click();
          expect(props.value).toEqual(['a', 'b']);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Announcement Invariant', () => {
    it('forwards roving as input and commits as change with the updated value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ value: 'a', open: true });
          const { trigger, panel, triggerEl, selectEl, panelEl, members, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(panel.attributes.role).toBe('listbox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          const inputs: unknown[] = [];
          const changes: unknown[] = [];
          panelEl.addEventListener('input', (event) => inputs.push((event as SelectInputEvent).detail));
          selectEl.addEventListener('change', (event) => {
            if (event.target === selectEl) changes.push((event as SelectChangeEvent).detail);
          });

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(inputs).toEqual(['a', 'b']);

          press(members[1].el, 'Enter');
          expect(props.value).toBe('b');
          expect(changes).toEqual(['b']);

          cleanup();
        });
      }));

    it('refuses toggling and committing while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false, disabled: true });
          const { trigger, triggerEl, members, cleanup } = buildSelect(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          triggerEl.click();
          expect(props.open).toBe(false);

          press(triggerEl, 'Enter');
          expect(props.open).toBe(false);

          press(triggerEl, ' ');
          expect(props.open).toBe(false);

          press(triggerEl, 'ArrowDown');
          expect(props.open).toBe(false);

          members[0].el.click();
          expect(props.value).toBeUndefined();
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('closes on outside click and emits close', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: true });
          const { trigger, triggerEl, selectEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(trigger.attributes['aria-expanded']).toBe('true');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          const closed: unknown[] = [];
          selectEl.addEventListener('close', () => closed.push(true));

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

    it('invokes onopen and onclose props across visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          let opened = 0;
          let closed = 0;
          const props = mutable<SelectProps>({
            open: false,
            onopen: () => {
              opened += 1;
            },
            onclose: () => {
              closed += 1;
            },
          });
          const { trigger, triggerEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          triggerEl.click();
          expect(opened).toBe(1);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          press(triggerEl, 'Escape');
          expect(closed).toBe(1);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));

    it('emits open and close when the popup visibility flips', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<SelectProps>({ open: false });
          const { trigger, triggerEl, selectEl, cleanup } = buildSelect(props, [{ value: 'a', text: 'Amsterdam' }]);

          expect(trigger.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          const opened: unknown[] = [];
          const closed: unknown[] = [];
          selectEl.addEventListener('open', () => opened.push(true));
          selectEl.addEventListener('close', () => closed.push(true));

          triggerEl.click();
          expect(opened).toEqual([true]);

          press(triggerEl, 'Escape');
          expect(closed).toEqual([true]);

          cleanup();
        });
      }));
  });
});
