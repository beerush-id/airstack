import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, DatePickerNav, type DatePickerProps } from '../../src/index.js';
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

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('DatePicker - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('State Projections', () => {
    it('writes committed value through the setter and reads day dates', () =>
      scope.run(() => {
        component().run(() => {
          const { picker, cells, cleanup } = buildPicker({ value: '2026-10-14', open: true }, [
            '2026-10-14',
            '2026-10-20',
          ]);

          picker.value = '2026-10-20';
          expect(picker.value).toBe('2026-10-20');
          expect(cells[1].day.date.iso).toBe('2026-10-20');

          picker.value = undefined;
          expect(picker.value).toBeUndefined();

          cleanup();
        });
      }));

    it('reads calendar visibility through the open getter', () =>
      scope.run(() => {
        component().run(() => {
          const { calendar, cleanup } = buildPicker({ value: '2026-10-14', open: false }, ['2026-10-14']);

          expect(calendar.open).toBe(false);

          cleanup();
        });
      }));

    it('ignores empty and duplicate selects without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, pickerEl, cleanup } = buildPicker(props, ['2026-10-14']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          picker.select('');
          picker.select('2026-10-14');
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('refuses to deselect while disabled or without a value', () =>
      scope.run(() => {
        component().run(() => {
          const { picker, cleanup } = buildPicker({ value: '2026-10-14', open: true, disabled: true }, ['2026-10-14']);
          picker.deselect();
          expect(picker.value).toBe('2026-10-14');
          cleanup();

          const empty = aria<HTMLElement>('date-picker', { open: true });
          empty.deselect();
          expect(empty.value).toBeUndefined();
          empty.destroy();
        });
      }));

    it('keeps month navigation a value-preserving no-op', () =>
      scope.run(() => {
        component().run(() => {
          const { picker, cleanup } = buildPicker({ value: '2026-10-14', open: true }, ['2026-10-14']);

          picker.navigateMonth(1);
          picker.navigateMonth(-1);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));
  });

  describe('Standalone Parts', () => {
    it('compiles a calendar outside any picker from its own props', () =>
      scope.run(() => {
        component().run(() => {
          const calendar = aria<HTMLElement>('date-picker-calendar', { id: 'solo-calendar' });
          expect(calendar.attributes.id).toBe('solo-calendar');

          const el = bind(document.createElement('div'), calendar);
          document.body.appendChild(el);
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          expect(calendar.open).toBe(false);

          calendar.destroy();
          el.remove();
        });
      }));

    it('compiles a day outside any picker as inert and unselected', () =>
      scope.run(() => {
        component().run(() => {
          const day = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });
          expect(day.attributes.tabindex).toBe(0);
          expect(day.attributes['aria-selected']).toBe('false');
          expect(day.attributes['aria-disabled']).toBe('true');

          const el = bind(document.createElement('div'), day);
          document.body.appendChild(el);
          el.focus();
          el.click();
          expect(day.date).toBe('2026-10-14');

          day.destroy();
          el.remove();
        });
      }));

    it('drops input events on an input outside any picker', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLInputElement>('date-picker-input', {});
          const el = bind(document.createElement('input'), input);
          document.body.appendChild(el);

          el.value = '2026-10-20';
          el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

          input.destroy();
          el.remove();
        });
      }));

    it('invokes handlers without a DOM element attached', () =>
      scope.run(() => {
        component().run(() => {
          const seen: unknown[] = [];
          const picker = aria<HTMLElement>('date-picker', {
            value: '2026-10-14',
            onchange: (event) => seen.push((event as CustomEvent).detail),
          });

          picker.select('2026-10-20');
          expect(picker.value).toBe('2026-10-20');
          picker.deselect();
          expect(picker.value).toBeUndefined();
          expect(seen).toEqual(['2026-10-20', null]);

          picker.destroy();
        });
      }));
  });

  describe('Grid Guards', () => {
    it('ignores keydowns off any day cell without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, calendarEl, cleanup } = buildPicker(props, ['2026-10-14']);

          press(calendarEl, 'ArrowRight');
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('ignores canceled keydowns on day cells', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-15']);

          cells[0].el.focus();
          const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
          event.preventDefault();
          cells[0].el.dispatchEvent(event);

          expect(document.activeElement).toBe(cells[0].el);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('ignores grid keys while the picker is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const { picker, cells, cleanup } = buildPicker({ value: '2026-10-14', open: true, disabled: true }, [
            '2026-10-14',
            '2026-10-15',
          ]);

          cells[0].el.focus();
          press(cells[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(cells[0].el);
          expect(picker.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('renders a custom-host input without native affordances', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-picker', { value: '2026-10-14' });
          const pickerEl = bind(document.createElement('div'), picker);
          document.body.appendChild(pickerEl);

          const input = aria<HTMLInputElement>('date-picker-input', {}, { native: false });
          const inputEl = bind(document.createElement('div'), input);
          pickerEl.appendChild(inputEl);

          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.hasAttribute('type')).toBe(false);
          expect(inputEl.getAttribute('aria-haspopup')).toBe('dialog');

          input.destroy();
          picker.destroy();
          pickerEl.remove();
        });
      }));

    it('holds focus on an invalid day instead of crashing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, calendarEl, cleanup } = buildPicker(props, ['2026-10-14']);

          const bogus = aria<HTMLElement>('date-picker-day', { date: 'bogus' });
          const bogusEl = bind(document.createElement('div'), bogus);
          calendarEl.appendChild(bogusEl);

          bogusEl.focus();
          press(bogusEl, 'ArrowRight');
          expect(document.activeElement).toBe(bogusEl);
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          bogus.destroy();
          bogusEl.remove();
          cleanup();
        });
      }));

    it('holds focus on week, bound, and month moves from an invalid day', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, calendarEl, cleanup } = buildPicker(props, ['2026-10-14']);

          const bogus = aria<HTMLElement>('date-picker-day', { date: 'bogus' });
          const bogusEl = bind(document.createElement('div'), bogus);
          calendarEl.appendChild(bogusEl);
          bogusEl.focus();

          for (const key of ['ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
            press(bogusEl, key);
            expect(document.activeElement).toBe(bogusEl);
          }
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          bogus.destroy();
          bogusEl.remove();
          cleanup();
        });
      }));

    it('leaves the event unprevented when the target day is not rendered', () =>
      scope.run(() => {
        component().run(() => {
          const { cells, cleanup } = buildPicker({ value: '2026-10-14', open: true }, ['2026-10-14']);

          cells[0].el.focus();
          const event = press(cells[0].el, 'ArrowRight');
          expect(event.defaultPrevented).toBe(false);

          cleanup();
        });
      }));

    it('commits the focused day on Space the same as Enter', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          cells[1].el.focus();
          press(cells[1].el, ' ');
          expect(picker.value).toBe(new Date('2026-10-20').toISOString());
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('refuses clicks that were already canceled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          const event = new MouseEvent('click', { bubbles: true, cancelable: true });
          event.preventDefault();
          cells[1].el.dispatchEvent(event);

          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('leaves the value alone when a disabled day takes focus', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({
            value: '2026-10-14',
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const { picker, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-11-05']);

          cells[1].el.focus();
          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Open Lifecycle', () => {
    it('opens onto the first focusable when the value is out of bounds', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-11-05', max: '2026-10-31', open: false });
          const { triggerEl, prevEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-11-05']);

          triggerEl.focus();
          triggerEl.click();

          expect(props.open).toBe(true);
          expect(cells[1].el.getAttribute('tabindex')).toBe('-1');
          expect(document.activeElement).toBe(prevEl);

          cleanup();
        });
      }));

    it('ignores dismiss keys that are not Escape while open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: true });
          const { calendarEl, cleanup } = buildPicker(props, ['2026-10-14']);

          press(calendarEl, 'a');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('closes without refocusing a detached opener on Escape', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { picker, triggerEl, cells, cleanup } = buildPicker(props, ['2026-10-14', '2026-10-20']);

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          triggerEl.remove();
          cells[1].el.focus();
          press(cells[1].el, 'Escape');

          expect(picker.value).toBe('2026-10-14');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('constructs every part with no arguments', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLInputElement>('date-picker-input');
          const trigger = aria<HTMLButtonElement>('date-picker-trigger');
          const calendar = aria<HTMLElement>('date-picker-calendar');
          const day = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });

          expect(input.attributes.role).toBe('combobox');
          expect(trigger.attributes['aria-haspopup']).toBe('listbox');
          expect(calendar.attributes.role).toBe('dialog');
          expect(day.attributes.role).toBe('gridcell');

          day.destroy();
          calendar.destroy();
          trigger.destroy();
          input.destroy();
        });
      }));

    it('links an argument-less trigger to the picker dialog', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-picker', { value: '2026-10-14' });
          const pickerEl = bind(document.createElement('div'), picker);
          document.body.appendChild(pickerEl);

          const trigger = aria<HTMLButtonElement>('date-picker-trigger');
          const triggerEl = bind(document.createElement('button'), trigger);
          pickerEl.appendChild(triggerEl);

          expect(trigger.attributes['aria-haspopup']).toBe('dialog');

          trigger.destroy();
          picker.destroy();
          pickerEl.remove();
        });
      }));

    it('opens a hostless calendar without crashing on missing context', () =>
      scope.run(() => {
        component().run(() => {
          const calendar = aria<HTMLElement>('date-picker-calendar', { id: 'solo-open' });
          const el = bind(document.createElement('div'), calendar);
          document.body.appendChild(el);

          calendar.popup.open = true;
          expect(calendar.open).toBe(true);
          calendar.popup.open = false;

          calendar.destroy();
          el.remove();
        });
      }));

    it('ignores Escape while the calendar is already closed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-10-14', open: false });
          const { cells, cleanup } = buildPicker(props, ['2026-10-14']);

          press(cells[0].el, 'Escape');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Shown Month Edges', () => {
    it('falls back to the current month when the value is not a date', () =>
      scope.run(() => {
        component().run(() => {
          const now = new Date();
          const props = mutable<DatePickerProps>({ value: 'not-a-date', open: false });
          const { picker, cleanup } = buildPicker(props, []);

          expect(picker.year).toBe(now.getFullYear());
          expect(picker.month).toBe(now.getMonth() + 1);

          cleanup();
        });
      }));

    it('rolls the year over at the month bounds', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-12-14', open: true });
          const { picker, prevEl, nextEl, cleanup } = buildPicker(props, ['2026-12-14']);

          nextEl.click();
          expect(picker.year).toBe(2027);
          expect(picker.month).toBe(1);
          expect(picker.value).toBe('2026-12-14');

          prevEl.click();
          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(12);

          prevEl.click();
          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(11);
          expect(picker.value).toBe('2026-12-14');

          cleanup();
        });
      }));

    it('holds still without a group and defaults to the previous month', () =>
      scope.run(() => {
        component().run(() => {
          const nav = new DatePickerNav();
          const el = bind(document.createElement('button'), nav);
          document.body.appendChild(el);

          expect(nav.direction).toBe(-1);
          el.click();

          const next = aria<HTMLButtonElement>('date-picker-nav', { direction: 1 });
          expect(next.direction).toBe(1);

          next.destroy();
          nav.destroy();
          el.remove();
        });
      }));
  });
});
