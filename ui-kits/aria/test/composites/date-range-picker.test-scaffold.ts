import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DateRangePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildRange(props: Partial<DateRangePickerProps>, dates: string[]) {
  const picker = aria('date-range-picker', props as DateRangePickerProps);
  const pickerEl = bind(document.createElement('div'), picker);
  document.body.appendChild(pickerEl);

  const start = aria('date-range-picker-input', { endpoint: 'start', label: 'Start date' });
  const startEl = bind(document.createElement('div'), start);
  pickerEl.appendChild(startEl);

  const end = aria('date-range-picker-input', { endpoint: 'end', label: 'End date' });
  const endEl = bind(document.createElement('div'), end);
  pickerEl.appendChild(endEl);

  const trigger = aria('date-range-picker-trigger');
  const triggerEl = bind(document.createElement('button'), trigger);
  pickerEl.appendChild(triggerEl);

  const calendar = aria('date-range-picker-calendar');
  const calendarEl = bind(document.createElement('div'), calendar);
  pickerEl.appendChild(calendarEl);

  const days = new Map<string, HTMLElement>();
  const dayControllers: Array<{ destroy: () => void }> = [];

  for (const date of dates) {
    const day = aria('date-range-picker-day', { date });
    const el = bind(document.createElement('button'), day);
    el.dataset.date = date;
    calendarEl.appendChild(el);
    days.set(date, el);
    dayControllers.push(day);
  }

  const cleanup = () => {
    for (const day of dayControllers) {
      day.destroy();
    }

    picker.destroy();
    start.destroy();
    end.destroy();
    trigger.destroy();
    calendar.destroy();
    pickerEl.remove();
  };

  return { picker, pickerEl, start, startEl, end, endEl, trigger, triggerEl, calendar, calendarEl, days, cleanup };
}

function click(el: HTMLElement | undefined) {
  (el as HTMLElement).click();
}

describe('DateRangePicker - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Dual Endpoint Normalization Invariant', () => {
    it('normalizes two clicked days into an ordered start and end', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, open: true });
          const { picker, days, cleanup } = buildRange(props, ['2026-05-02', '2026-05-04', '2026-05-06', '2026-05-09']);

          // Later day first, then an earlier one: the range still resolves in order
          click(days.get('2026-05-09'));
          click(days.get('2026-05-04'));

          expect(props.value).toEqual(['2026-05-04', '2026-05-09']);
          expect(picker.value).toEqual(['2026-05-04', '2026-05-09']);

          days.get('2026-05-04')?.focus();
          const selected = [
            days.get('2026-05-04')?.getAttribute('aria-selected'),
            days.get('2026-05-09')?.getAttribute('aria-selected'),
            days.get('2026-05-06')?.getAttribute('aria-selected'),
          ];
          expect(selected).toEqual(['true', 'true', 'false']);

          cleanup();
        });
      }));

    it('gives each endpoint its own accessible name and draft slot', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, draft: ['', ''], open: false });
          const { start, startEl, end, endEl, cleanup } = buildRange(props, ['2026-05-02']);

          expect(startEl.getAttribute('role')).toBe('textbox');
          expect(startEl.getAttribute('aria-label')).toBe('Start date');
          expect(endEl.getAttribute('role')).toBe('textbox');
          expect(endEl.getAttribute('aria-label')).toBe('End date');

          // Each endpoint writes only its own draft slot
          startEl.textContent = '2026-05-02';
          startEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.draft).toEqual(['2026-05-02', '']);

          endEl.textContent = '2026-05-09';
          endEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.draft).toEqual(['2026-05-02', '2026-05-09']);

          // The committed range is untouched until a selection resolves
          expect(props.value).toBeNull();
          expect(start.attributes['aria-expanded']).toBe('false');

          cleanup();
        });
      }));
  });

  describe('Interval Selection & Draft Lifecycle Invariant', () => {
    it('keeps the calendar open on the first pick and closes it on the second', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, open: false });
          const { triggerEl, days, cleanup } = buildRange(props, ['2026-06-03', '2026-06-07']);

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          click(days.get('2026-06-03'));
          expect(props.open).toBe(true);
          expect(props.draft).toEqual(['2026-06-03', '']);
          expect(props.value).toBeNull();

          click(days.get('2026-06-07'));
          expect(props.open).toBe(false);
          expect(props.value).toEqual(['2026-06-03', '2026-06-07']);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');
          expect(document.activeElement).toBe(triggerEl);

          cleanup();
        });
      }));

    it('announces draft movement and the committed range as separate events', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, open: true });
          const { pickerEl, days, cleanup } = buildRange(props, ['2026-06-01', '2026-06-05']);

          const drafts: unknown[] = [];
          const commits: unknown[] = [];
          pickerEl.addEventListener('input', (event) => drafts.push((event as CustomEvent).detail));
          pickerEl.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));

          click(days.get('2026-06-05'));
          expect(drafts).toEqual([['2026-06-05', '']]);
          expect(commits).toEqual([]);

          click(days.get('2026-06-01'));
          expect(commits).toEqual([['2026-06-01', '2026-06-05']]);
          expect(drafts).toHaveLength(2);

          cleanup();
        });
      }));

    it('disables days outside the declared window and keeps them out of the interval', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({
            value: null,
            open: true,
            min: '2026-07-03',
            max: '2026-07-06',
          });
          const { days, cleanup } = buildRange(props, ['2026-07-01', '2026-07-03', '2026-07-05', '2026-07-08']);

          expect(days.get('2026-07-01')?.getAttribute('aria-disabled')).toBe('true');
          expect(days.get('2026-07-03')?.getAttribute('aria-disabled')).toBe('false');
          expect(days.get('2026-07-05')?.getAttribute('aria-disabled')).toBe('false');
          expect(days.get('2026-07-08')?.getAttribute('aria-disabled')).toBe('true');

          // An out-of-window day cannot open or close an interval
          click(days.get('2026-07-01'));
          expect(props.draft).toBeUndefined();
          expect(props.value).toBeNull();

          click(days.get('2026-07-03'));
          click(days.get('2026-07-08'));
          expect(props.value).toBeNull();
          expect(props.draft).toEqual(['2026-07-03', '']);

          click(days.get('2026-07-05'));
          expect(props.value).toEqual(['2026-07-03', '2026-07-05']);

          cleanup();
        });
      }));
  });

  describe('Dialog Coordination & Trap Invariant', () => {
    it('hides the shared calendar while closed and shows one dialog when open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, open: false });
          const { trigger, calendar, calendarEl, triggerEl, cleanup } = buildRange(props, ['2026-08-01']);

          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(document.getElementById(triggerEl.getAttribute('aria-controls') as string)).toBe(calendarEl);

          expect(calendar.attributes.role).toBe('dialog');
          expect(calendarEl.getAttribute('aria-label')).toBe('Choose date range');
          expect(calendarEl.hidden).toBe(true);

          triggerEl.click();
          expect(calendarEl.hidden).toBe(false);
          expect(calendarEl.getAttribute('aria-expanded')).toBeNull();

          triggerEl.click();
          expect(calendarEl.hidden).toBe(true);

          cleanup();
        });
      }));

    it('roves a single tab stop across the day cells of the shared grid', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: null, open: true });
          const { days, cleanup } = buildRange(props, ['2026-09-01', '2026-09-02', '2026-09-03']);

          const stops = ['2026-09-01', '2026-09-02', '2026-09-03'].map((date) =>
            days.get(date)?.getAttribute('tabindex')
          );

          // A grid member holds exactly one tab stop, not three
          expect(stops.filter((value) => value === '0')).toHaveLength(1);
          expect(stops.filter((value) => value === '-1')).toHaveLength(2);

          cleanup();
        });
      }));
  });
});
