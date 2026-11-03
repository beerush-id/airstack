import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import {
  DatePicker,
  DatePickerCalendar,
  DatePickerInput,
  DatePickerNav,
  DatePickerTrigger,
  DatePickerYearInput,
} from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type PickerProps = {
  value?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  oninput?: (value: string) => void;
  onchange?: (value: string | undefined) => void;
};

function BasicPicker(props: PickerProps) {
  return (
    <DatePicker
      value={props.value}
      disabled={props.disabled}
      min={props.min}
      max={props.max}
      label="Choose date"
      oninput={(event) => props.oninput?.(event.detail)}
      onchange={(event) => props.onchange?.(event.detail)}
    >
      <DatePickerInput aria-label="Date" />
      <DatePickerTrigger aria-label="Open calendar">Open</DatePickerTrigger>
      <DatePickerCalendar>
        <DatePickerNav type="month" direction={-1} aria-label="Previous month">
          Previous
        </DatePickerNav>
        <DatePickerYearInput aria-label="Year" />
        <DatePickerNav type="month" direction={1} aria-label="Next month">
          Next
        </DatePickerNav>
      </DatePickerCalendar>
    </DatePicker>
  );
}

const dayCell = (iso: string) => document.querySelector(`[data-date="${iso}"]`) as HTMLElement;

const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('DatePicker', () => {
  it('announces typed text without choosing anything', async () => {
    destroy = await runApp(async () => {
      const typed: string[] = [];
      let committed = 0;
      render(<BasicPicker oninput={(value) => typed.push(value)} onchange={() => (committed += 1)} />);

      const input = screen.getByRole('combobox', { name: 'Date' });
      await act(async () => {
        await userEvent.type(input, '2026-10-14');
      });

      expect(typed.at(-1)).toBe('2026-10-14');
      expect(committed).toBe(0);
    });
  });

  it('opens a named calendar on the trigger, on the chosen day', async () => {
    destroy = await runApp(async () => {
      const today = localIso(new Date());
      render(<BasicPicker value={today} />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });

      const calendar = await screen.findByRole('dialog', { name: 'Choose date' });
      expect(calendar.className).toContain('aui-date-picker-calendar');
      await waitFor(() => expect(dayCell(today)).toBeInstanceOf(HTMLElement));
      expect(dayCell(today).getAttribute('aria-selected')).toBe('true');
      expect(dayCell(today).getAttribute('aria-current')).toBe('date');
    });
  });

  it('saves the chosen day, reports it once, and closes', async () => {
    destroy = await runApp(async () => {
      const changes: (string | undefined)[] = [];
      render(<BasicPicker onchange={(value) => changes.push(value)} />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-14')).toBeInstanceOf(HTMLElement));

      await act(async () => {
        await userEvent.click(dayCell('2026-10-14'));
      });

      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe('2026-10-14T00:00:00.000Z');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect((screen.getByRole('combobox', { name: 'Date' }) as HTMLInputElement).value).toContain('2026-10-14');
    });
  });

  it('refuses days outside the allowed range', async () => {
    destroy = await runApp(async () => {
      const changes: (string | undefined)[] = [];
      render(<BasicPicker min="2026-10-10" max="2026-10-20" onchange={(value) => changes.push(value)} />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-05')).toBeInstanceOf(HTMLElement));

      expect(dayCell('2026-10-05').getAttribute('aria-disabled')).toBe('true');
      await act(async () => {
        await userEvent.click(dayCell('2026-10-05'));
      });
      expect(changes).toHaveLength(0);
    });
  });

  it('binds the chosen day two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ date: '2026-10-14' });
      render(
        <DatePicker value={$bind(state, 'date')} label="Choose date">
          <DatePickerInput aria-label="Date" />
          <DatePickerTrigger aria-label="Open calendar">Open</DatePickerTrigger>
          <DatePickerCalendar>
            <DatePickerYearInput aria-label="Year" />
          </DatePickerCalendar>
        </DatePicker>
      );

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-20')).toBeInstanceOf(HTMLElement));
      await act(async () => {
        await userEvent.click(dayCell('2026-10-20'));
      });

      expect(state.date).toContain('2026-10-20');
    });
  });

  it('stays shut while disabled and keeps its classes and ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const { unmount } = render(
        <DatePicker ref={ref} className="my-picker" disabled label="Choose date">
          <DatePickerInput aria-label="Date" />
          <DatePickerTrigger aria-label="Open calendar">Open</DatePickerTrigger>
          <DatePickerCalendar>
            <DatePickerYearInput aria-label="Year" />
          </DatePickerCalendar>
        </DatePicker>
      );

      expect(ref.current?.className).toContain('aui-date-picker');
      expect(ref.current?.className).toContain('my-picker');

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      expect(screen.queryByRole('dialog')).toBeNull();

      unmount();
      configure({ overrides: true });
      render(
        <DatePicker className="only-me" label="Choose date">
          <DatePickerInput aria-label="Date" />
          <DatePickerCalendar>
            <DatePickerYearInput aria-label="Year" />
          </DatePickerCalendar>
        </DatePicker>
      );
      const root = document.querySelector('.only-me') as HTMLElement;
      expect(root.className).toBe('only-me');
      expect(within(root).getByRole('combobox', { name: 'Date' })).toBeInstanceOf(HTMLInputElement);
    });
  });
});
