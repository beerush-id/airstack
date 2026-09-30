import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DatePickerProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildPicker(props: Partial<DatePickerProps>, dates: string[]) {
  const picker = aria('date-picker', props as DatePickerProps);
  const pickerEl = bind(document.createElement('div'), picker);
  document.body.appendChild(pickerEl);

  const input = aria('date-picker-input');
  const inputEl = bind(document.createElement('input'), input);
  pickerEl.appendChild(inputEl);

  const trigger = aria('date-picker-trigger');
  const triggerEl = bind(document.createElement('button'), trigger);
  pickerEl.appendChild(triggerEl);

  const calendar = aria('date-picker-calendar');
  const calendarEl = bind(document.createElement('div'), calendar);
  pickerEl.appendChild(calendarEl);

  const days = new Map<string, { el: HTMLElement; press: () => unknown }>();
  const dayControllers: Array<{ destroy: () => void }> = [];

  for (const date of dates) {
    const day = aria('date-picker-day', { date });
    const el = bind(document.createElement('button'), day);
    el.dataset.date = date;
    calendarEl.appendChild(el);
    dayControllers.push(day);
    days.set(date, { el, press: () => day });
  }

  const cleanup = () => {
    for (const day of dayControllers) {
      day.destroy();
    }

    picker.destroy();
    input.destroy();
    trigger.destroy();
    calendar.destroy();
    pickerEl.remove();
  };

  return { picker, pickerEl, input, inputEl, trigger, triggerEl, calendar, calendarEl, days, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const MARCH = [
  '2026-03-01',
  '2026-03-02',
  '2026-03-03',
  '2026-03-04',
  '2026-03-05',
  '2026-03-06',
  '2026-03-07',
];

const FEBRUARY = [
  '2026-02-01',
  '2026-02-02',
  '2026-02-03',
  '2026-02-04',
  '2026-02-05',
  '2026-02-06',
  '2026-02-07',
];

describe('DatePicker - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Temporal Entry & Dialog Coordination Invariant', () => {
    it('wires the trigger and input to the calendar dialog and toggles it open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '', open: false });
          const { input, inputEl, trigger, triggerEl, calendar, calendarEl, cleanup } = buildPicker(
            props,
            MARCH,
          );

          // Both entry points name the dialog and follow its visibility
          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(calendar.attributes.id);
          expect(
            document.getElementById(triggerEl.getAttribute('aria-controls') as string),
          ).toBe(calendarEl);
          expect(inputEl.getAttribute('role')).toBe('combobox');
          expect(inputEl.getAttribute('aria-haspopup')).toBe('dialog');
          expect(inputEl.getAttribute('aria-expanded')).toBe('false');

          expect(calendarEl.getAttribute('role')).toBe('dialog');
          expect(calendarEl.getAttribute('aria-label')).toBe('Calendar');

          triggerEl.click();
          expect(props.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');
          expect(inputEl.getAttribute('aria-expanded')).toBe('true');

          triggerEl.click();
          expect(props.open).toBe(false);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          // The calendar's own root takes no role: it is the dialog that carries it
          expect(calendar.attributes.role).toBe('dialog');

          cleanup();
        });
      }));

    it('synchronizes direct ISO text entry with the committed value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-03-04', open: false });
          const { pickerEl, inputEl, days, cleanup } = buildPicker(props, MARCH);

          expect(inputEl.value).toBe('2026-03-04');
          expect(days.get('2026-03-04')?.el.getAttribute('aria-selected')).toBe('true');
          expect(days.get('2026-03-01')?.el.getAttribute('aria-selected')).toBe('false');

          inputEl.value = '2026-03-06';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          expect(props.value).toBe('2026-03-06');
          expect(days.get('2026-03-06')?.el.getAttribute('aria-selected')).toBe('true');

          // The container compiles nothing of its own
          expect(pickerEl.getAttribute('role')).toBeNull();

          cleanup();
        });
      }));

    it('marks out-of-range days disabled and refuses to commit them', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({
            value: '',
            open: true,
            min: '2026-03-02',
            max: '2026-03-05',
          });
          const { triggerEl, days, cleanup } = buildPicker(props, MARCH);

          expect(days.get('2026-03-01')?.el.getAttribute('aria-disabled')).toBe('true');
          expect(days.get('2026-03-02')?.el.getAttribute('aria-disabled')).toBe('false');
          expect(days.get('2026-03-05')?.el.getAttribute('aria-disabled')).toBe('false');
          expect(days.get('2026-03-06')?.el.getAttribute('aria-disabled')).toBe('true');

          triggerEl.focus();

          days.get('2026-03-01')?.el.focus();
          press(days.get('2026-03-01')?.el as HTMLElement, 'Enter');
          expect(props.value).toBe('');

          days.get('2026-03-04')?.el.focus();
          press(days.get('2026-03-04')?.el as HTMLElement, 'Enter');
          expect(props.value).toBe('2026-03-04');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Two-Dimensional Grid Traversal Invariant', () => {
    it('moves one day sideways and one week vertically', () =>
      scope.run(() => {
        component().run(() => {
          const { days, cleanup } = buildPicker(
            { value: '', open: true },
            ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'],
          );

          const focused = () => (document.activeElement as HTMLElement).getAttribute('data-date');

          days.get('2026-03-05')?.el.focus();
          expect(focused()).toBe('2026-03-05');

          press(days.get('2026-03-05')?.el as HTMLElement, 'ArrowRight');
          expect(focused()).toBe('2026-03-06');

          press(days.get('2026-03-06')?.el as HTMLElement, 'ArrowLeft');
          press(days.get('2026-03-05')?.el as HTMLElement, 'ArrowLeft');
          expect(focused()).toBe('2026-03-04');

          // A vertical move crosses the row boundary by a full week
          days.get('2026-03-03')?.el.focus();
          press(days.get('2026-03-03')?.el as HTMLElement, 'ArrowDown');
          expect(focused()).toBe('2026-03-10');

          press(days.get('2026-03-10')?.el as HTMLElement, 'ArrowUp');
          expect(focused()).toBe('2026-03-03');

          // The keys the grid owns are consumed, and the ones it does not are left alone
          expect(press(days.get('2026-03-03')?.el as HTMLElement, 'ArrowRight').defaultPrevented).toBe(
            true,
          );
          expect(press(days.get('2026-03-03')?.el as HTMLElement, 'a').defaultPrevented).toBe(false);

          cleanup();
        });
      }));

    it('bounds the week with Home and End and turns the month with Page keys', () =>
      scope.run(() => {
        component().run(() => {
          const { days, cleanup } = buildPicker(
            { value: '', open: true },
            [...FEBRUARY, ...MARCH],
          );

          const focused = () => (document.activeElement as HTMLElement).getAttribute('data-date');

          days.get('2026-03-04')?.el.focus();

          press(days.get('2026-03-04')?.el as HTMLElement, 'End');
          expect(focused()).toBe('2026-03-07');

          press(days.get('2026-03-07')?.el as HTMLElement, 'Home');
          expect(focused()).toBe('2026-03-01');

          // A month turn keeps the day of the month and moves the focused cell into the next grid
          days.get('2026-02-03')?.el.focus();
          press(days.get('2026-02-03')?.el as HTMLElement, 'PageDown');
          expect(focused()).toBe('2026-03-03');

          press(days.get('2026-03-03')?.el as HTMLElement, 'PageUp');
          expect(focused()).toBe('2026-02-03');

          cleanup();
        });
      }));
  });

  describe('Focus Restoration & Value Commit Invariant', () => {
    it('commits the focused day on Enter and returns focus to the opening trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '', open: false });
          const { triggerEl, days, cleanup } = buildPicker(props, MARCH);

          triggerEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          days.get('2026-03-02')?.el.focus();
          press(days.get('2026-03-02')?.el as HTMLElement, 'Enter');

          expect(props.value).toBe('2026-03-02');
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(triggerEl);
          expect(days.get('2026-03-02')?.el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));

    it('closes on Escape without committing and hands focus back', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DatePickerProps>({ value: '2026-03-01', open: false });
          const { inputEl, triggerEl, days, cleanup } = buildPicker(props, MARCH);

          inputEl.focus();
          triggerEl.click();
          expect(props.open).toBe(true);

          // Moving the highlight is not a commit
          days.get('2026-03-05')?.el.focus();
          press(days.get('2026-03-05')?.el as HTMLElement, 'Escape');

          expect(props.value).toBe('2026-03-01');
          expect(props.open).toBe(false);
          expect(document.activeElement).toBe(triggerEl);
          expect(days.get('2026-03-01')?.el.getAttribute('aria-selected')).toBe('true');
          expect(days.get('2026-03-05')?.el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));
  });
});
