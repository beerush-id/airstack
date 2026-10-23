import { aria, type DateRangePickerAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, renderDynamic, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { DatePickerGrid } from './DatePicker.js';

export type DateRangePickerValue = [string, string];

export type DateRangePickerProps = ComponentStyles & {
  id?: string;
  value?: Bindable<DateRangePickerValue>;
  month?: Bindable<number>;
  year?: Bindable<number>;
  min?: string;
  max?: string;
  label?: string;
  locales?: string[];
  open?: Bindable<boolean>;
  disabled?: boolean;
  required?: boolean;
  grid?: DatePickerGrid;
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
 * single picker.
 */
export const DateRangePicker = setup<DateRangePickerProps>((props) => {
  const grid = $static(() => props.grid);
  const picker = aria(DATE_RANGE_PICKER_ROLE, props as AnyType, { grid });
  const className = () => $families(AUI_CLASS.DATE_RANGE_PICKER, props, auiConfig.dateRangePicker);

  return () => (
    <div ref={picker.ref} {...picker.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, picker)}
    </div>
  );
}, 'DateRangePicker');
