import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type AriaEvent, type DatePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildPicker(props: DatePickerProps, days: string[]) {
  const picker = aria<HTMLElement>('date-picker', props);
  const pickerEl = bind(document.createElement('div'), picker);
  document.body.appendChild(pickerEl);

  const input = aria<HTMLInputElement>('date-picker-input', {});
  const inputEl = bind(document.createElement('input'), input);
  pickerEl.appendChild(inputEl);

  const trigger = aria<HTMLButtonElement>('date-picker-trigger', {});
  const triggerEl = bind(document.createElement('button'), trigger);
  pickerEl.appendChild(triggerEl);

  const calendar = aria<HTMLElement>('date-picker-calendar', {});
  const calendarEl = bind(document.createElement('div'), calendar);
  pickerEl.appendChild(calendarEl);

  const prev = aria<HTMLButtonElement>('date-picker-nav', { direction: -1 });
  const prevEl = bind(document.createElement('button'), prev);
  calendarEl.appendChild(prevEl);

  const next = aria<HTMLButtonElement>('date-picker-nav', { direction: 1 });
  const nextEl = bind(document.createElement('button'), next);
  calendarEl.appendChild(nextEl);

  const cells = days.map((date) => {
    const day = aria<HTMLElement>('date-picker-day', { date });
    const el = bind(document.createElement('div'), day);
    calendarEl.appendChild(el);
    return { date, day, el };
  });

  const cleanup = () => {
    for (const { day } of cells) day.destroy();
    next.destroy();
    prev.destroy();
    calendar.destroy();
    trigger.destroy();
    input.destroy();
    picker.destroy();
    pickerEl.remove();
  };

  return { picker, pickerEl, input, inputEl, trigger, triggerEl, calendar, calendarEl, prevEl, nextEl, cells, cleanup };
}

function press(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function type(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
}

describe('DatePicker - Combobox Family Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('SSR Contract Invariant', () => {
    it('compiles every part without a DOM', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-picker', { value: '2026-10-14', open: false });
          const input = aria<HTMLInputElement>('date-picker-input', {});
          const trigger = aria<HTMLButtonElement>('date-picker-trigger', {});
          const calendar = aria<HTMLElement>('date-picker-calendar', {});
          const prev = aria<HTMLButtonElement>('date-picker-nav', { direction: -1 });
          const next = aria<HTMLButtonElement>('date-picker-nav', { direction: 1 });
          const day = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });

          expect(picker.attributes.role).toBeUndefined();
          expect(input.attributes.role).toBe('combobox');
          expect(input.attributes['aria-haspopup']).toBe('dialog');
          expect(input.attributes['aria-expanded']).toBe('false');
          expect(input.attributes['aria-controls']).toBe(calendar.attributes.id);
          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(calendar.attributes.id);
          expect(calendar.attributes.role).toBe('dialog');
          expect(day.attributes.role).toBe('gridcell');
          expect(prev.attributes.role).toBeUndefined();
          expect(next.attributes.role).toBeUndefined();

          day.destroy();
          next.destroy();
          prev.destroy();
          calendar.destroy();
          trigger.destroy();
          input.destroy();
          picker.destroy();
        });
      }));

    it('projects open and day state into SSR attributes', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-picker', {
            value: '2026-10-14',
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const input = aria<HTMLInputElement>('date-picker-input', {});
          const selected = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });
          const outside = aria<HTMLElement>('date-picker-day', { date: '2026-11-05' });

          expect(input.attributes['aria-expanded']).toBe('true');
          expect(selected.attributes['aria-selected']).toBe('true');
          expect(outside.attributes['aria-selected']).toBe('false');
          expect(outside.attributes['aria-disabled']).toBe('true');

          outside.destroy();
          selected.destroy();
          input.destroy();
          picker.destroy();
        });
      }));
  });

  describe('Input Semantics Invariant', () => {
    it('compiles SSR attributes without a DOM', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-picker', { value: '2026-10-14', open: false });
          const input = aria<HTMLInputElement>('date-picker-input', {});
          const calendar = aria<HTMLElement>('date-picker-calendar', {});

          expect(picker.attributes.role).toBeUndefined();
          expect(input.attributes.role).toBe('combobox');
          expect(input.attributes['aria-haspopup']).toBe('dialog');
          expect(input.attributes['aria-expanded']).toBe('false');
          expect(calendar.attributes.role).toBe('dialog');
          expect(input.attributes['aria-controls']).toBe(calendar.attributes.id);

          calendar.destroy();
          input.destroy();
          picker.destroy();
        });
      }));

    it('binds those attributes onto browser elements with a live linkage', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { inputEl, triggerEl, calendarEl, cleanup } = buildPicker(props, ['2026-10-14']);

          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-haspopup')).toBe('dialog');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(calendarEl.getAttribute('role')).toBe('dialog');

          const controls = inputEl.getAttribute('aria-controls');
          expect(controls).toBeTruthy();
          expect(document.getElementById(controls as string)).toBe(calendarEl);

          const triggerControls = triggerEl.getAttribute('aria-controls');
          expect(triggerControls).toBeTruthy();
          expect(document.getElementById(triggerControls as string)).toBe(calendarEl);

          cleanup();
        });
      }));

    it('reflects popup visibility on both the field and the trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ open: false });
          const { picker, inputEl, triggerEl, cleanup } = buildPicker(props, ['2026-10-14']);

          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(triggerEl.getAttribute('aria-haspopup')).toBe('dialog');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          props.open = true;
          expect(picker.open).toBe(true);
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          picker.open = false;
          expect(props.open).toBe(false);
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          cleanup();
        });
      }));
  });

  describe('Text Entry Invariant', () => {
    it('announces typed text as input without committing a date', () =>
      scope.run(() => {
        component().run(() => {
          const seen: unknown[] = [];
          const props = mutable<DatePickerProps>({
            open: false,
            value: '2026-10-14',
            oninput: (event: AriaEvent) => seen.push((event as CustomEvent).detail),
          });

          const { picker, inputEl, cleanup } = buildPicker(props, ['2026-10-14']);

          inputEl.focus();
          type(inputEl, '2026-10-20');

          expect(seen).toEqual(['2026-10-20']);
          expect(picker.value).toBe('2026-10-14');
          expect(props.value).toBe('2026-10-14');

          cleanup();
        });
      }));
  });

  describe('Popup Trigger Invariant', () => {
    it('opens from the trigger and lands focus on the chosen day', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-13', '2026-10-14']);

          triggerEl.focus();
          triggerEl.click();

          expect(props.open).toBe(true);
          expect(document.activeElement).toBe(cells[1].el);
          expect(cells[1].el.getAttribute('tabindex')).toBe('0');
          expect(cells[0].el.getAttribute('tabindex')).toBe('-1');

          cleanup();
        });
      }));

    it('marks the chosen day selected and out-of-range days disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({
            value: '2026-10-14',
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const { cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-11-05']);

          expect(cells[0].el.getAttribute('role')).toBe('gridcell');
          expect(cells[0].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[1].el.getAttribute('aria-selected')).toBe('false');
          expect(cells[1].el.getAttribute('aria-disabled')).toBe('true');

          cleanup();
        });
      }));

    it('refuses to activate an out-of-range day', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({
            value: '2026-10-14',
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-11-05']);

          cells[0].el.focus();
          cells[0].el.click();

          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Day Grid Invariant', () => {
    it('moves focus by day with Left and Right without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-13', '2026-10-14', '2026-10-15']);

          cells[1].el.focus();
          press(cells[1].el, 'ArrowLeft');
          expect(document.activeElement).toBe(cells[0].el);

          press(cells[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(cells[1].el);
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('moves focus by week with Up and Down without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-07', '2026-10-14', '2026-10-21']);

          cells[1].el.focus();
          press(cells[1].el, 'ArrowUp');
          expect(document.activeElement).toBe(cells[0].el);

          press(cells[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(cells[1].el);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('travels toward week bounds with Home and End without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-15', open: true });
          const { picker, cells, cleanup } = buildPicker(props, [
            '2026-10-11',
            '2026-10-12',
            '2026-10-15',
            '2026-10-17',
            '2026-10-18',
          ]);
          const at = () => cells.findIndex((c) => c.el === document.activeElement);

          cells[2].el.focus();
          press(cells[2].el, 'Home');
          expect(at()).toBeLessThan(2);

          const home = at();
          press(document.activeElement as HTMLElement, 'End');
          expect(at()).toBeGreaterThan(home);
          expect(picker.value).toBe('2026-10-15');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('changes month with PageUp and PageDown without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-14']);

          cells[0].el.focus();
          press(cells[0].el, 'PageUp');
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          press(document.activeElement as HTMLElement, 'PageDown');
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('moves the shown month from the month buttons without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, prevEl, nextEl, cleanup } = buildPicker(props, ['2026-10-14']);

          prevEl.click();
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          nextEl.click();
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Full Coverage Invariant', () => {
    it('focuses the current day when opening with no committed value', () =>
      scope.run(() => {
        component().run(() => {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const props = mutable<DatePickerProps>({ open: false });
          const { triggerEl, cells, cleanup } = buildPicker(props, [today]);

          triggerEl.focus();
          triggerEl.click();

          expect(props.open).toBe(true);
          expect(document.activeElement).toBe(cells[0].el);
          expect(cells[0].el.getAttribute('tabindex')).toBe('0');

          cleanup();
        });
      }));

    it('marks the current day', () =>
      scope.run(() => {
        component().run(() => {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const props = mutable<DatePickerProps>({ value: '2030-06-15', open: false });
          const { cells, cleanup } = buildPicker(props, ['2030-06-15', today]);

          expect(cells[1].el.getAttribute('aria-current')).toBe('date');
          expect(cells[0].el.getAttribute('aria-current')).toBeNull();

          cleanup();
        });
      }));

    it('commits the clicked day the same as Enter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, pickerEl, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          triggerEl.focus();
          triggerEl.click();
          cells[1].el.click();

          const expected = new Date('2026-10-20').toISOString();
          expect(picker.value).toBe(expected);
          expect(props.open).toBe(false);
          expect(changes).toEqual([expected]);
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));
  });

  describe('Commit & Dismiss Invariant', () => {
    it('commits the focused day on Enter, closes, and returns focus to the opener', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, pickerEl, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          cells[1].el.focus();
          press(cells[1].el, 'Enter');

          const expected = new Date('2026-10-20').toISOString();

          expect(picker.value).toBe(expected);
          expect(props.value).toBe(expected);
          expect(props.open).toBe(false);
          expect(changes).toEqual([expected]);
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));

    it('closes on Escape without committing and returns focus to the opener', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, pickerEl, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);
          cells[1].el.focus();

          press(cells[1].el, 'Escape');

          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(false);
          expect(changes).toEqual([]);
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));

    it('refuses typing, toggling, and committing while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false, disabled: true });
          const { picker, inputEl, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          expect(inputEl.disabled).toBe(true);

          inputEl.focus();
          type(inputEl, '2026-10-20');
          expect(picker.value).toBe('2026-10-14');

          triggerEl.click();
          expect(props.open).toBe(false);

          cells[1].el.click();
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));
  });

  describe('Field Synchronization Invariant', () => {
    it('shows the committed value in the field on bind', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { inputEl, cleanup } = buildPicker(props, ['2026-10-14']);

          expect(inputEl.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('writes the picked day into the field on commit', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { inputEl, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          triggerEl.focus();
          triggerEl.click();
          cells[1].el.click();

          expect(inputEl.value).toBe('2026-10-20');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('keeps typed text in the field while it stays uncommitted', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, inputEl, cleanup } = buildPicker(props, ['2026-10-14']);

          inputEl.focus();
          type(inputEl, '2026-10-2');

          expect(inputEl.value).toBe('2026-10-2');
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('deselects when the field is cleared and blurred', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, pickerEl, triggerEl, inputEl, cleanup } = buildPicker(props, ['2026-10-14']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          type(inputEl, '');
          inputEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: triggerEl }));

          expect(picker.value).toBeUndefined();
          expect(inputEl.value).toBe('');
          expect(changes).toHaveLength(1);
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('keeps typed text when the calendar opens', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { inputEl, triggerEl, cleanup } = buildPicker(props, ['2026-10-14']);

          inputEl.focus();
          type(inputEl, '2026-10-2');

          triggerEl.focus();
          triggerEl.click();

          expect(props.open).toBe(true);
          expect(inputEl.value).toBe('2026-10-02');
          expect(inputEl.value).not.toBe('2026-10-14');

          cleanup();
        });
      }));
  });

  describe('Shown Month Invariant', () => {
    it('seeds the shown month from the committed value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, cleanup } = buildPicker(props, ['2026-10-14']);

          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(10);

          cleanup();
        });
      }));

    it('seeds the shown month from today without a value', () =>
      scope.run(() => {
        component().run(() => {
          const now = new Date();
          const props = mutable<DatePickerProps>({ open: false });
          const { picker, cleanup } = buildPicker(props, []);

          expect(picker.month).toBe(now.getMonth() + 1);

          cleanup();
        });
      }));

    it('steps the shown month from the month buttons without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, prevEl, nextEl, cleanup } = buildPicker(props, ['2026-10-14']);

          prevEl.click();
          expect(picker.month).toBe(9);
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          nextEl.click();
          expect(picker.month).toBe(10);
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('follows a valid typed date with the shown month when committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, inputEl, cleanup } = buildPicker(props, ['2026-10-14']);

          type(inputEl, '2026-03-05');
          inputEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: inputEl }));

          expect(picker.month).toBe(3);
          expect(picker.value).toBe(new Date('2026-03-05').toISOString());
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('fallback to the committed value on an invalid month', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', month: 'nope', open: true });
          const { picker, prevEl, cleanup } = buildPicker(props, ['2026-10-14']);

          prevEl.click();
          expect(picker.month).toBe(9);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('travels nothing on a cancelled click', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, prevEl, cleanup } = buildPicker(props, ['2026-10-14']);

          const event = new MouseEvent('click', { bubbles: true, cancelable: true });
          event.preventDefault();
          prevEl.dispatchEvent(event);

          expect(picker.month).toBe(10);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('holds still while the group is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true, disabled: true });
          const { picker, prevEl, cleanup } = buildPicker(props, ['2026-10-14']);

          prevEl.click();
          expect(picker.month).toBe(10);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));
  });
});
