import { aria, type DateRangePickerAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type FieldStyles, OMIT_KEYS } from '../config.js';
import {
  type DatePickerGrid,
  type DatePickerLabels,
  DatePickerCalendar,
  DatePickerField,
  DatePickerHeader,
  DatePickerInput,
  DatePickerTrigger,
} from './DatePicker.js';
import { datePickerScope, datePickerView } from './scopes.js';

export type DateRangePickerValue = [string, string];

export type DateRangePickerProps = FieldStyles & {
  id?: string;
  value?: Bindable<DateRangePickerValue>;
  month?: Bindable<number>;
  year?: Bindable<number>;
  min?: string;
  max?: string;
  label?: string;
  placeholder?: string;
  locales?: string[];
  open?: Bindable<boolean>;
  disabled?: boolean;
  required?: boolean;
  grid?: DatePickerGrid;
  labels?: DatePickerLabels;
  children?: ReactNode | ((picker: DateRangePickerAria) => ReactNode);
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<DateRangePickerValue | undefined>) => void;
  onopen?: (event: CustomEvent<true>) => void;
  onclose?: (event: CustomEvent<false>) => void;
};

const DATE_RANGE_PICKER_ROLE = 'date-range-picker';

register('dateRangePicker', {});

/**
 * Range picker. The first day starts a draft, the second saves the ordered
 * pair; the field, trigger, calendar, and day parts are shared with the
 * single picker. Without children it renders one field holding both ends and
 * the calendar button, plus the calendar with its default header.
 */
export const DateRangePicker = setup<DateRangePickerProps>((props) => {
  const grid = $static(() => props.grid);
  const picker = aria(DATE_RANGE_PICKER_ROLE, props as AnyType, { grid });
  const className = () =>
    $families(AUI_CLASS.DATE_RANGE_PICKER, { className: props.className }, auiConfig.dateRangePicker);

  datePickerScope.provide(props);
  datePickerView.set(picker as AnyType);

  return () => (
    <div ref={picker.ref} {...picker.restProps([...OMIT_KEYS, 'placeholder', 'labels'])} className={className()}>
      {props.children ? (
        renderDynamic(props.children, picker)
      ) : (
        <>
          <DatePickerField>
            <DatePickerInput slot="start" placeholder={props.placeholder} aria-label={props.labels?.start} />
            <span className={AUI_CLASS.DATE_PICKER_SEPARATOR} aria-hidden="true">
              –
            </span>
            <DatePickerInput slot="end" placeholder={props.placeholder} aria-label={props.labels?.end} />
            <DatePickerTrigger aria-label={props.labels?.open} />
          </DatePickerField>
          <DatePickerCalendar>
            <DatePickerHeader
              previousLabel={props.labels?.previous}
              nextLabel={props.labels?.next}
              yearLabel={props.labels?.year}
            />
          </DatePickerCalendar>
        </>
      )}
    </div>
  );
}, 'DateRangePicker');
