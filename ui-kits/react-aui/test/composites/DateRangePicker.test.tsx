import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import type { DateRangePickerValue } from '../../src/index.js';
import {
  DatePickerCalendar,
  DatePickerInput,
  DatePickerTrigger,
  DatePickerYearInput,
  DateRangePicker,
} from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type RangeProps = {
  value?: DateRangePickerValue;
  disabled?: boolean;
  onchange?: (value: DateRangePickerValue | undefined) => void;
};

function BasicRange(props: RangeProps) {
  return (
    <DateRangePicker
      value={props.value}
      disabled={props.disabled}
      label="Choose range"
      onchange={(event) => props.onchange?.(event.detail)}
    >
      <DatePickerInput slot="start" aria-label="Start date" />
      <DatePickerInput slot="end" aria-label="End date" />
      <DatePickerTrigger aria-label="Open calendar">Open</DatePickerTrigger>
      <DatePickerCalendar>
        <DatePickerYearInput aria-label="Year" />
      </DatePickerCalendar>
    </DateRangePicker>
  );
}

const dayCell = (iso: string) => document.querySelector(`[data-date="${iso}"]`) as HTMLElement;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('DateRangePicker', () => {
  it('holds change until both ends are picked', async () => {
    destroy = await runApp(async () => {
      const changes: (DateRangePickerValue | undefined)[] = [];
      render(<BasicRange onchange={(value) => changes.push(value)} />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-10')).toBeInstanceOf(HTMLElement));

      await act(async () => {
        await userEvent.click(dayCell('2026-10-10'));
      });
      expect(changes).toHaveLength(0);
      expect(screen.getByRole('dialog', { name: 'Choose range' })).toBeInstanceOf(HTMLElement);

      await act(async () => {
        await userEvent.click(dayCell('2026-10-14'));
      });
      expect(changes).toHaveLength(1);
      expect(changes[0]?.[0]).toContain('2026-10-10');
      expect(changes[0]?.[1]).toContain('2026-10-14');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  it('orders the pair when the later day is picked first', async () => {
    destroy = await runApp(async () => {
      const changes: (DateRangePickerValue | undefined)[] = [];
      render(<BasicRange onchange={(value) => changes.push(value)} />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-20')).toBeInstanceOf(HTMLElement));

      await act(async () => {
        await userEvent.click(dayCell('2026-10-20'));
      });
      await act(async () => {
        await userEvent.click(dayCell('2026-10-08'));
      });

      expect(changes).toHaveLength(1);
      expect(changes[0]?.[0]).toContain('2026-10-08');
      expect(changes[0]?.[1]).toContain('2026-10-20');
    });
  });

  it('binds the pair two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ stay: undefined as DateRangePickerValue | undefined });
      render(
        <DateRangePicker value={$bind(state, 'stay')} label="Choose range">
          <DatePickerInput slot="start" aria-label="Start date" />
          <DatePickerInput slot="end" aria-label="End date" />
          <DatePickerTrigger aria-label="Open calendar">Open</DatePickerTrigger>
          <DatePickerCalendar>
            <DatePickerYearInput aria-label="Year" />
          </DatePickerCalendar>
        </DateRangePicker>
      );

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });
      await waitFor(() => expect(dayCell('2026-10-06')).toBeInstanceOf(HTMLElement));
      await act(async () => {
        await userEvent.click(dayCell('2026-10-06'));
      });
      await act(async () => {
        await userEvent.click(dayCell('2026-10-09'));
      });

      expect(state.stay?.[0]).toContain('2026-10-06');
      expect(state.stay?.[1]).toContain('2026-10-09');
    });
  });

  it('stays shut while disabled', async () => {
    destroy = await runApp(async () => {
      render(<BasicRange disabled />);

      await act(async () => {
        await userEvent.click(screen.getByRole('combobox', { name: 'Open calendar' }));
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('keeps its classes, ref, and additive mode', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const { unmount } = render(
        <DateRangePicker ref={ref} className="my-range" label="Choose range">
          <DatePickerInput slot="start" aria-label="Start date" />
          <DatePickerInput slot="end" aria-label="End date" />
          <DatePickerCalendar>
            <DatePickerYearInput aria-label="Year" />
          </DatePickerCalendar>
        </DateRangePicker>
      );

      expect(ref.current?.className).toContain('aui-date-range-picker');
      expect(ref.current?.className).toContain('my-range');

      unmount();
      configure({ overrides: true });
      render(
        <DateRangePicker className="only-me" label="Choose range">
          <DatePickerInput slot="start" aria-label="Start date" />
        </DateRangePicker>
      );
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
