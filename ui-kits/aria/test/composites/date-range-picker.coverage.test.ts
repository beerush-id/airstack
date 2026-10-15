import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, DatePickerNav, type DateRangePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildRange(props: DateRangePickerProps, days: string[]) {
  const picker = aria<HTMLElement>('date-range-picker', props);
  const pickerEl = bind(document.createElement('div'), picker);
  document.body.appendChild(pickerEl);

  const start = aria<HTMLInputElement>('date-picker-input', { slot: 'start' });
  const startEl = bind(document.createElement('input'), start);
  pickerEl.appendChild(startEl);

  const end = aria<HTMLInputElement>('date-picker-input', { slot: 'end' });
  const endEl = bind(document.createElement('input'), end);
  pickerEl.appendChild(endEl);

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
    end.destroy();
    start.destroy();
    picker.destroy();
    pickerEl.remove();
  };

  return { picker, pickerEl, startEl, endEl, triggerEl, calendar, calendarEl, prevEl, nextEl, cells, cleanup };
}

function type(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
}

function iso(day: string): string {
  return new Date(day).toISOString();
}

describe('DateRangePicker - Coverage', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Construction Defaults', () => {
    it('constructs without props', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-range-picker');
          const pickerEl = bind(document.createElement('div'), picker);
          document.body.appendChild(pickerEl);

          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);

          picker.destroy();
          pickerEl.remove();
        });
      }));
  });

  describe('Month Navigation Buttons', () => {
    it('steps the shown month from the nav buttons without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: true });
          const { picker, pickerEl, prevEl, nextEl, cleanup } = buildRange(props, ['2026-10-14']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          prevEl.click();
          expect(picker.month).toBe(9);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);
          expect(props.open).toBe(true);

          nextEl.click();
          expect(picker.month).toBe(10);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);
          expect(props.open).toBe(true);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('wraps the shown month across year boundaries', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-12-14', '2026-12-20'], open: true });
          const { picker, nextEl, cleanup } = buildRange(props, []);
          expect(picker.month).toBe(12);

          nextEl.click();
          expect(picker.year).toBe(2027);
          expect(picker.month).toBe(1);

          cleanup();
        });
      }));

    it('steps the shown year from the year nav buttons without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: true });
          const { picker, pickerEl, calendarEl, cleanup } = buildRange(props, []);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          const prevYear = aria<HTMLButtonElement>('date-picker-nav', { direction: -1, type: 'year' });
          const prevYearEl = bind(document.createElement('button'), prevYear);
          calendarEl.appendChild(prevYearEl);

          const nextYear = aria<HTMLButtonElement>('date-picker-nav', { direction: 1, type: 'year' });
          const nextYearEl = bind(document.createElement('button'), nextYear);
          calendarEl.appendChild(nextYearEl);

          nextYearEl.click();
          expect(picker.year).toBe(2027);
          expect(picker.month).toBe(10);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          prevYearEl.click();
          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(10);
          expect(changes).toEqual([]);

          nextYear.destroy();
          prevYear.destroy();
          cleanup();
        });
      }));

    it('wraps the shown month backwards across year boundaries', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-01-14', '2026-01-20'], open: true });
          const { picker, prevEl, cleanup } = buildRange(props, []);
          expect(picker.month).toBe(1);

          prevEl.click();
          expect(picker.year).toBe(2025);
          expect(picker.month).toBe(12);

          cleanup();
        });
      }));
  });

  describe('Programmatic Value', () => {
    it('writes the range through the setter and clears it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, []);

          picker.value = [iso('2026-10-14'), iso('2026-10-20')];
          expect(picker.value).toEqual([iso('2026-10-14'), iso('2026-10-20')]);
          expect(startEl.value).toBe('2026-10-14');
          expect(endEl.value).toBe('2026-10-20');

          picker.value = undefined;
          expect(picker.value).toBeUndefined();
          expect(startEl.value).toBe('');
          expect(endEl.value).toBe('');

          cleanup();
        });
      }));
  });

  describe('Clearing Slots', () => {
    it('clears the start slot when its field is emptied and blurred', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, []);

          startEl.focus();
          type(startEl, '');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: endEl }));

          expect(picker.value?.[0]).toBeUndefined();
          expect(picker.value?.[1]).toBe('2026-10-20');
          expect(startEl.value).toBe('');

          cleanup();
        });
      }));

    it('clears the whole range when both fields are emptied', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, []);

          startEl.focus();
          type(startEl, '');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: endEl }));

          endEl.focus();
          type(endEl, '');
          endEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(picker.value?.[0]).toBeUndefined();
          expect(picker.value?.[1]).toBeUndefined();
          expect(startEl.value).toBe('');
          expect(endEl.value).toBe('');

          cleanup();
        });
      }));
  });

  describe('Single-Sided Bounds', () => {
    it('disables only days before min when no max is set', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ min: '2026-10-10', open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-08', '2026-10-14']);

          expect(cells[0].el.getAttribute('aria-disabled')).toBe('true');
          expect(cells[1].el.getAttribute('aria-disabled')).toBe('false');

          cells[0].el.click();
          expect(picker.value).toBeUndefined();

          cleanup();
        });
      }));

    it('disables only days after max when no min is set', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ max: '2026-10-10', open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-08', '2026-10-14']);

          expect(cells[0].el.getAttribute('aria-disabled')).toBe('false');
          expect(cells[1].el.getAttribute('aria-disabled')).toBe('true');

          cells[1].el.click();
          expect(picker.value).toBeUndefined();

          cleanup();
        });
      }));
  });

  describe('Calendar Reads', () => {
    it('exposes weeks, dates, and open state from the calendar', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: true });
          const { calendar, cleanup } = buildRange(props, ['2026-10-14']);

          expect(calendar.open).toBe(true);
          expect((calendar as unknown as { id: string }).id).toBeTruthy();
          expect((calendar as unknown as { weeks: unknown[] }).weeks.length).toBeGreaterThan(0);
          expect((calendar as unknown as { dates: unknown[] }).dates.length).toBeGreaterThan(0);

          cleanup();
        });
      }));
  });

  describe('Direct Mutations', () => {
    it('commits an ordered pair through select with both endpoints', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, pickerEl, cleanup } = buildRange(props, []);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          picker.select(iso('2026-10-20'), iso('2026-10-14'));

          expect(picker.value).toEqual([iso('2026-10-20'), iso('2026-10-14')]);
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(props.open).toBe(false);
          expect(changes).toEqual([[iso('2026-10-20'), iso('2026-10-14')]]);

          cleanup();
        });
      }));

    it('clears the range through deselect', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, []);

          picker.deselect();

          expect(picker.value?.[0]).toBeUndefined();
          expect(picker.value?.[1]).toBeUndefined();
          expect(startEl.value).toBe('');
          expect(endEl.value).toBe('');

          cleanup();
        });
      }));

    it('retains the range on deselect while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({
            value: ['2026-10-14', '2026-10-20'],
            open: false,
            disabled: true,
          });
          const { picker, cleanup } = buildRange(props, []);

          picker.deselect();

          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          cleanup();
        });
      }));

    it('steps the year through navigateYear', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: true });
          const { picker, cleanup } = buildRange(props, []);

          picker.navigateYear(1);
          expect(picker.year).toBe(2027);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          picker.navigateYear(-1);
          expect(picker.year).toBe(2026);

          cleanup();
        });
      }));
  });

  describe('Deselect Edges', () => {
    it('keeps the empty range on deselect without a value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, cleanup } = buildRange(props, []);

          picker.deselect();

          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);

          cleanup();
        });
      }));
  });

  describe('Invalid Dates', () => {
    it('disables a day with an unparseable date and refuses it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, calendarEl, cleanup } = buildRange(props, []);

          const day = aria<HTMLElement>('date-picker-day', { date: 'bogus' });
          const el = bind(document.createElement('div'), day);
          calendarEl.appendChild(el);

          expect(el.getAttribute('aria-disabled')).toBe('true');
          expect(el.getAttribute('aria-selected')).toBe('false');

          el.click();
          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);

          day.destroy();
          cleanup();
        });
      }));
  });

  describe('Standalone Parts', () => {
    it('compiles an input without a picker scope', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLInputElement>('date-picker-input', { slot: 'start' });

          expect(input.attributes.role).toBe('combobox');

          input.destroy();
        });
      }));

    it('compiles a day without a picker scope as unselected', () =>
      scope.run(() => {
        component().run(() => {
          const day = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });

          expect(day.attributes.role).toBe('gridcell');
          expect(day.attributes['aria-selected']).toBe('false');

          day.destroy();
        });
      }));

    it('compiles a calendar without a picker scope as a closed dialog', () =>
      scope.run(() => {
        component().run(() => {
          const calendar = aria<HTMLElement>('date-picker-calendar', {});
          const calendarEl = bind(document.createElement('div'), calendar);
          document.body.appendChild(calendarEl);

          expect(calendar.attributes.role).toBe('dialog');
          expect(calendar.open).toBe(false);
          expect((calendar as unknown as { id: string }).id).toBeUndefined();

          calendar.destroy();
          calendarEl.remove();
        });
      }));

    it('shows the start endpoint on an input without a slot', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { pickerEl, cleanup } = buildRange(props, []);

          const input = aria<HTMLInputElement>('date-picker-input', {});
          const el = bind(document.createElement('input'), input);
          pickerEl.appendChild(el);

          expect(el.getAttribute('role')).toBe('combobox');
          expect(el.value).toBe('2026-10-14');

          input.destroy();
          cleanup();
        });
      }));

    it('steps the month through an explicitly constructed nav', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: true });
          const { picker, calendarEl, cleanup } = buildRange(props, []);

          const nav = new DatePickerNav({ direction: 1 });
          const el = bind(document.createElement('button'), nav);
          calendarEl.appendChild(el);

          expect(nav.direction).toBe(1);
          el.click();
          expect(picker.month).toBe(11);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          nav.destroy();
          el.remove();
          cleanup();
        });
      }));
  });

  describe('Disabled Guards', () => {
    it('holds the month still when navigating while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({
            value: ['2026-10-14', '2026-10-20'],
            open: true,
            disabled: true,
          });
          const { picker, prevEl, nextEl, cleanup } = buildRange(props, []);

          prevEl.click();
          expect(picker.month).toBe(10);

          nextEl.click();
          expect(picker.month).toBe(10);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          cleanup();
        });
      }));
  });
});
