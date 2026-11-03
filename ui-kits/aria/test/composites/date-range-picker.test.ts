import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type DateRangePickerProps } from '../../src/index.js';
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

  const cells = days.map((date) => {
    const day = aria<HTMLElement>('date-picker-day', { date });
    const el = bind(document.createElement('div'), day);
    calendarEl.appendChild(el);
    return { date, day, el };
  });

  const cleanup = () => {
    for (const { day } of cells) day.destroy();
    calendar.destroy();
    trigger.destroy();
    end.destroy();
    start.destroy();
    picker.destroy();
    pickerEl.remove();
  };

  return { picker, pickerEl, startEl, endEl, trigger, triggerEl, calendarEl, cells, cleanup };
}

function press(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function type(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
}

function iso(day: string): string {
  return new Date(day).toISOString();
}

describe('DateRangePicker - Interval Entry Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('SSR Contract Invariant', () => {
    it('compiles every part without a DOM', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-range-picker', { open: false });
          const start = aria<HTMLInputElement>('date-picker-input', { slot: 'start' });
          const end = aria<HTMLInputElement>('date-picker-input', { slot: 'end' });
          const trigger = aria<HTMLButtonElement>('date-picker-trigger', {});
          const calendar = aria<HTMLElement>('date-picker-calendar', {});
          const day = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });

          expect(picker.attributes.role).toBeUndefined();
          expect(start.attributes['aria-label']).toBeUndefined();
          expect(end.attributes['aria-label']).toBeUndefined();
          expect(trigger.attributes['aria-haspopup']).toBe('dialog');
          expect(trigger.attributes['aria-expanded']).toBe('false');
          expect(trigger.attributes['aria-controls']).toBe(calendar.attributes.id);
          expect(calendar.attributes.role).toBe('dialog');
          expect(calendar.attributes['aria-label']).toBeUndefined();
          expect(day.attributes.role).toBe('gridcell');

          day.destroy();
          calendar.destroy();
          trigger.destroy();
          end.destroy();
          start.destroy();
          picker.destroy();
        });
      }));

    it('projects open and day state into SSR attributes', () =>
      scope.run(() => {
        component().run(() => {
          const picker = aria<HTMLElement>('date-range-picker', {
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const inside = aria<HTMLElement>('date-picker-day', { date: '2026-10-14' });
          const outside = aria<HTMLElement>('date-picker-day', { date: '2026-11-05' });

          expect(inside.attributes['aria-disabled']).toBe('false');
          expect(outside.attributes['aria-disabled']).toBe('true');

          outside.destroy();
          inside.destroy();
          picker.destroy();
        });
      }));
  });

  describe('Endpoint Semantics Invariant', () => {
    it('leaves field naming to the developer and hides the shared calendar', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, endEl, calendarEl, cleanup } = buildRange(props, ['2026-10-14']);

          expect(picker.attributes.role).toBeUndefined();
          expect(startEl.hasAttribute('aria-label')).toBe(false);
          expect(endEl.hasAttribute('aria-label')).toBe(false);
          expect(calendarEl.getAttribute('role')).toBe('dialog');
          expect(calendarEl.hasAttribute('aria-label')).toBe(false);
          expect(calendarEl.hidden).toBe(true);

          cleanup();
        });
      }));

    it('reflects popup visibility on the trigger', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, triggerEl, calendarEl, cleanup } = buildRange(props, ['2026-10-14']);

          expect(triggerEl.getAttribute('aria-haspopup')).toBe('dialog');
          expect(triggerEl.getAttribute('aria-expanded')).toBe('false');

          props.open = true;
          expect(picker.open).toBe(true);
          expect(triggerEl.getAttribute('aria-expanded')).toBe('true');

          const controls = triggerEl.getAttribute('aria-controls');
          expect(controls).toBeTruthy();
          expect(document.getElementById(controls as string)).toBe(calendarEl);

          cleanup();
        });
      }));
  });

  describe('Host Parity Invariant', () => {
    it('names the field as a combobox without a default label on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const custom = aria<HTMLElement>('date-picker-input', { slot: 'start' }, { native: false });
          const native = aria<HTMLInputElement>('date-picker-input', { slot: 'end' });

          expect(custom.attributes.role).toBe('combobox');
          expect(custom.attributes['aria-label']).toBeUndefined();
          expect(native.attributes.role).toBe('combobox');
          expect(native.attributes['aria-label']).toBeUndefined();

          native.destroy();
          custom.destroy();
        });
      }));

    it('binds the same naming on both hosts', () =>
      scope.run(() => {
        component().run(() => {
          const custom = aria<HTMLElement>('date-picker-input', { slot: 'start' }, { native: false });
          const customEl = bind(document.createElement('div'), custom);
          document.body.appendChild(customEl);

          const native = aria<HTMLInputElement>('date-picker-input', { slot: 'end' });
          const nativeEl = bind(document.createElement('input'), native);
          document.body.appendChild(nativeEl);

          expect(customEl.getAttribute('role')).toBe('combobox');
          expect(customEl.hasAttribute('aria-label')).toBe(false);
          expect(nativeEl.getAttribute('role')).toBe('combobox');
          expect(nativeEl.hasAttribute('aria-label')).toBe(false);

          native.destroy();
          custom.destroy();
          nativeEl.remove();
          customEl.remove();
        });
      }));

    it('compiles the calendar without modal semantics', () =>
      scope.run(() => {
        component().run(() => {
          const calendar = aria<HTMLElement>('date-picker-calendar', {});

          expect(calendar.attributes['aria-modal']).toBeUndefined();

          calendar.destroy();
        });
      }));

    it('binds the calendar hidden and non-modal while closed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { calendarEl, cleanup } = buildRange(props, ['2026-10-14']);

          expect(calendarEl.hidden).toBe(true);
          expect(calendarEl.hasAttribute('aria-modal')).toBe(false);

          cleanup();
        });
      }));
  });

  describe('Two-Step Selection Invariant', () => {
    it('starts a draft on first activation and keeps the calendar open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const inputs: unknown[] = [];
          pickerEl.addEventListener('input', (event) => inputs.push((event as CustomEvent).detail));

          cells[0].el.focus();
          cells[0].el.click();

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).not.toBe(picker.draft);
          expect(props.open).toBe(true);
          expect(inputs).toEqual([iso('2026-10-14')]);

          cleanup();
        });
      }));

    it('marks the first pick as draft while the range stays open', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          cells[0].el.click();

          expect(cells[0].el.getAttribute('data-draft')).toBeNull();
          expect(cells[0].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[1].el.getAttribute('data-draft')).toBeNull();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('marks days inside the committed range', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-10', '2026-10-14'], open: true });
          const { cells, cleanup } = buildRange(props, [
            '2026-10-10',
            '2026-10-11',
            '2026-10-12',
            '2026-10-13',
            '2026-10-14',
          ]);

          expect(cells[0].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[0].el.getAttribute('data-in-range')).toBe('true');
          expect(cells[1].el.getAttribute('data-in-range')).toBe('true');
          expect(cells[2].el.getAttribute('data-in-range')).toBe('true');
          expect(cells[3].el.getAttribute('data-in-range')).toBe('true');
          expect(cells[4].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[4].el.getAttribute('data-in-range')).toBe('true');

          cleanup();
        });
      }));

    it('commits an ordered range on second activation and closes', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          cells[1].el.click();
          cells[0].el.click();

          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), iso('2026-10-20')]);
          expect(props.value).toEqual([iso('2026-10-14'), iso('2026-10-20')]);
          expect(props.open).toBe(false);
          expect(changes).toEqual([[iso('2026-10-14'), iso('2026-10-20')]]);

          cleanup();
        });
      }));

    it('keeps drafting when the same day is activated twice', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14']);

          cells[0].el.click();
          cells[0].el.click();

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('activates days with Enter and Space the same as a click', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          cells[0].el.focus();
          press(cells[0].el, 'Enter');
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);

          cells[1].el.focus();
          press(cells[1].el, ' ');
          expect(picker.value).toEqual([iso('2026-10-14'), iso('2026-10-20')]);
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('marks out-of-range days disabled and mutes activation while allowing roving', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({
            min: '2026-10-01',
            max: '2026-10-31',
            open: true,
          });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-11-05']);

          expect(cells[1].el.getAttribute('aria-disabled')).toBe('true');
          expect(cells[1].el.getAttribute('tabindex')).toBe('-1');

          cells[1].el.focus();
          expect(document.activeElement).toBe(cells[1].el);

          cells[1].el.click();
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.value).toBeUndefined();
          expect(props.open).toBe(true);

          press(cells[1].el, 'Enter');
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.value).toBeUndefined();

          press(cells[1].el, ' ');
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.value).toBeUndefined();
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('starts over when the end is already filled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-10', '2026-10-12'], open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          cells[0].el.click();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));
  });

  describe('Full Coverage Invariant', () => {
    it('assigns the start slot from typed text on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, pickerEl, startEl, cleanup } = buildRange(props, ['2026-10-14']);

          const inputs: unknown[] = [];
          pickerEl.addEventListener('input', (event) => inputs.push((event as CustomEvent).detail));

          startEl.focus();
          type(startEl, '2026-10-14');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(picker.value?.[0]).toBe(iso('2026-10-14'));
          expect(picker.value?.[1]).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(startEl.value).toBe('2026-10-14');
          expect(inputs.length).toBeGreaterThan(0);

          cleanup();
        });
      }));

    it('assigns the end slot from typed text on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, ['2026-10-20']);

          startEl.focus();
          type(startEl, '2026-10-14');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          endEl.focus();
          type(endEl, '2026-10-20');
          endEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(picker.value).toEqual([iso('2026-10-14'), iso('2026-10-20')]);
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(endEl.value).toBe('2026-10-20');

          cleanup();
        });
      }));

    it('follows a valid typed endpoint with the shown month on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, startEl, cleanup } = buildRange(props, ['2026-10-14']);

          startEl.focus();
          type(startEl, '2026-03-05');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(3);
          expect(picker.value?.[0]).toBe(iso('2026-03-05'));
          expect(picker.draft).toEqual([undefined, undefined]);

          cleanup();
        });
      }));

    it('changes month with PageUp and PageDown without committing and without change', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({
            value: ['2026-10-14', '2026-10-20'],
            open: true,
          });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          cells[0].el.focus();
          press(cells[0].el, 'PageUp');

          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(9);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);
          expect(props.open).toBe(true);

          press(document.activeElement as HTMLElement, 'PageDown');
          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(10);
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);
          expect(props.open).toBe(true);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('travels by week and toward week bounds without committing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, [
            '2026-10-08',
            '2026-10-11',
            '2026-10-12',
            '2026-10-15',
            '2026-10-17',
            '2026-10-18',
            '2026-10-22',
          ]);
          const at = () => cells.findIndex((c) => c.el === document.activeElement);

          cells[3].el.focus();
          press(cells[3].el, 'ArrowUp');
          expect(document.activeElement).toBe(cells[0].el);

          press(cells[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(cells[3].el);

          press(cells[3].el, 'Home');
          expect(at()).toBeLessThan(3);

          const home = at();
          press(document.activeElement as HTMLElement, 'End');
          expect(at()).toBeGreaterThan(home);
          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('marks committed endpoints selected with a single tab stop each', () =>
      scope.run(() => {
        component().run(() => {
          const base = new Date();
          base.setDate(base.getDate() + 30);
          const day = (offset: number) => {
            const d = new Date(base);
            d.setDate(d.getDate() + offset);
            return d.toISOString().slice(0, 10);
          };
          const start = day(0);
          const mid = day(1);
          const end = day(4);
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, [start, mid, end]);

          cells[0].el.click();
          cells[2].el.click();

          expect(picker.value).toEqual([iso(start), iso(end)]);
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(cells[0].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[2].el.getAttribute('aria-selected')).toBe('true');
          expect(cells[1].el.getAttribute('aria-selected')).toBe('false');
          expect(cells[0].el.getAttribute('tabindex')).toBe('0');
          expect(cells[2].el.getAttribute('tabindex')).toBe('0');
          expect(cells[1].el.getAttribute('tabindex')).toBe('-1');

          cleanup();
        });
      }));

    it('retains the draft on Escape when nothing was committed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          cells[0].el.focus();
          cells[0].el.click();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);

          press(cells[0].el, 'Escape');

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(false);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('closes an in-progress draft on Escape without a circular state report', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14']);

          const reports: string[] = [];
          const warn = console.warn;
          const error = console.error;
          console.warn = (...args: unknown[]) => {
            reports.push(args.map(String).join(' '));
          };
          console.error = (...args: unknown[]) => {
            reports.push(args.map(String).join(' '));
          };
          try {
            cells[0].el.focus();
            cells[0].el.click();
            expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);

            press(cells[0].el, 'Escape');

            expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
            expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
            expect(props.open).toBe(false);
          } finally {
            console.warn = warn;
            console.error = error;
          }

          expect(reports.join('\n')).not.toMatch(/Circular mutation/);

          cleanup();
        });
      }));

    it('retains the draft on trigger dismissal', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-10', '2026-10-12'], open: true });
          const { picker, pickerEl, triggerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          cells[0].el.click();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);

          triggerEl.click();

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(false);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('keeps the calendar open when a press inside moves focus to the body', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { cells, cleanup } = buildRange(props, ['2026-10-14']);

          cells[0].el.focus();
          cells[0].el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
          expect(props.open).toBe(true);
          cells[0].el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('retains the draft when focus leaves without a completed edit', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-10', '2026-10-12'], open: true });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          const outside = document.createElement('button');
          document.body.appendChild(outside);

          cells[0].el.focus();
          cells[0].el.click();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);

          cells[0].el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(true);
          expect(changes).toEqual([]);

          outside.remove();
          cleanup();
        });
      }));

    it('bubbles day input past the container', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { cells, cleanup } = buildRange(props, ['2026-10-14']);

          const seen: unknown[] = [];
          const onInput = (event: Event) => seen.push((event as CustomEvent).detail);
          document.body.addEventListener('input', onInput);

          cells[0].el.focus();
          cells[0].el.click();

          expect(seen).toEqual([iso('2026-10-14')]);

          document.body.removeEventListener('input', onInput);
          cleanup();
        });
      }));

    it('bubbles committed change past the container', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const seen: unknown[] = [];
          const onChange = (event: Event) => seen.push((event as CustomEvent).detail);
          document.body.addEventListener('change', onChange);

          cells[0].el.click();
          cells[1].el.click();

          expect(seen).toEqual([picker.value]);

          document.body.removeEventListener('change', onChange);
          cleanup();
        });
      }));
  });

  describe('Draft Lifecycle Invariant', () => {
    it('retains the draft on Escape', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-10', '2026-10-12'], open: true });
          const { picker, pickerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          const changes: unknown[] = [];
          pickerEl.addEventListener('change', (event) => changes.push((event as CustomEvent).detail));

          cells[0].el.click();
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);

          press(cells[0].el, 'Escape');

          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(props.open).toBe(false);
          expect(changes).toEqual([]);

          cleanup();
        });
      }));

    it('moves focus by day and week without committing a range', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cells, cleanup } = buildRange(props, ['2026-10-13', '2026-10-14', '2026-10-21']);

          cells[1].el.focus();
          press(cells[1].el, 'ArrowLeft');
          expect(document.activeElement).toBe(cells[0].el);

          press(cells[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(cells[1].el);

          press(cells[1].el, 'ArrowDown');
          expect(document.activeElement).toBe(cells[2].el);
          expect(picker.value).toBeUndefined();
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('refuses typing, toggling, and committing while disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false, disabled: true });
          const { picker, startEl, triggerEl, cells, cleanup } = buildRange(props, ['2026-10-14']);

          startEl.focus();
          type(startEl, '2026-10-20');
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.value).toBeUndefined();

          triggerEl.click();
          expect(props.open).toBe(false);

          cells[0].el.click();
          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);

          press(cells[0].el, 'Enter');
          expect(picker.value).toBeUndefined();

          press(cells[0].el, ' ');
          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);

          cleanup();
        });
      }));
  });

  describe('Endpoint Field Synchronization Invariant', () => {
    it('shows the saved endpoints in the fields on bind', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { startEl, endEl, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          expect(startEl.value).toBe('2026-10-14');
          expect(endEl.value).toBe('2026-10-20');

          cleanup();
        });
      }));

    it('writes the completed pair into the fields on save', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { startEl, endEl, triggerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          triggerEl.focus();
          triggerEl.click();
          cells[0].el.click();
          cells[1].el.click();

          expect(startEl.value).toBe('2026-10-14');
          expect(endEl.value).toBe('2026-10-20');
          expect(props.open).toBe(false);

          cleanup();
        });
      }));

    it('shows the draft start while the pair is unfinished', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, endEl, triggerEl, cells, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          triggerEl.focus();
          triggerEl.click();
          cells[0].el.click();

          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.draft).toEqual([iso('2026-10-14'), undefined]);
          expect(startEl.value).toBe('2026-10-14');
          expect(endEl.value).toBe('');
          expect(props.open).toBe(true);

          cleanup();
        });
      }));

    it('writes edited endpoint text into the value slot on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, cleanup } = buildRange(props, []);

          startEl.focus();
          type(startEl, '2026-10-14');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(picker.value).toEqual([iso('2026-10-14'), undefined]);
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(startEl.value).toBe('2026-10-14');

          cleanup();
        });
      }));

    it('reverts invalid typed text to the selected date or empty on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          startEl.focus();
          type(startEl, 'not-a-date');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: endEl }));

          expect(startEl.value).toBe('2026-10-14');
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          cleanup();
        });
      }));

    it('reverts invalid end text to the selected end date on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, startEl, endEl, cleanup } = buildRange(props, ['2026-10-14', '2026-10-20']);

          endEl.focus();
          type(endEl, 'bogus');
          endEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: startEl }));

          expect(endEl.value).toBe('2026-10-20');
          expect(picker.value).toEqual(['2026-10-14', '2026-10-20']);

          cleanup();
        });
      }));

    it('reverts invalid typed text to empty when nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: false });
          const { picker, startEl, cleanup } = buildRange(props, []);

          startEl.focus();
          type(startEl, 'not-a-date');
          startEl.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));

          expect(startEl.value).toBe('');
          expect(picker.value).toBeUndefined();

          cleanup();
        });
      }));
  });

  describe('Shown Month Invariant', () => {
    it('seeds the shown month from the saved range', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ value: ['2026-10-14', '2026-10-20'], open: false });
          const { picker, cleanup } = buildRange(props, ['2026-10-14']);

          expect(picker.year).toBe(2026);
          expect(picker.month).toBe(10);

          cleanup();
        });
      }));

    it('steps the shown month without saving anything', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<DateRangePickerProps>({ open: true });
          const { picker, cleanup } = buildRange(props, []);

          const year = picker.year;
          const month = picker.month;
          picker.navigateMonth(1);

          expect(picker.value).toBeUndefined();
          expect(picker.draft).toEqual([undefined, undefined]);
          expect(picker.year).toBe(month === 12 ? year! + 1 : year);
          expect(picker.month).toBe(month === 12 ? 1 : month! + 1);

          cleanup();
        });
      }));
  });
});
