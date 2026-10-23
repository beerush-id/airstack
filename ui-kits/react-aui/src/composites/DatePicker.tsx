import { aria, type DatePickerAria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, For, renderDynamic, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type DatePickerGrid = 'fixed' | 'dynamic';
export type DatePickerSlot = 'start' | 'end';
export type DatePickerDayValue = string | { iso?: string; date?: number };

export type DatePickerProps = ComponentStyles & {
  id?: string;
  value?: Bindable<string>;
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
  children?: ReactNode | ((picker: DatePickerAria) => ReactNode);
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<string | undefined>) => void;
  onopen?: (event: CustomEvent<true>) => void;
  onclose?: (event: CustomEvent<false>) => void;
};

export type DatePickerInputProps = ComponentStyles & {
  id?: string;
  slot?: DatePickerSlot;
  disabled?: boolean;
  oninput?: (event: CustomEvent<string>) => void;
};

export type DatePickerTriggerProps = ComponentStyles & {
  disabled?: boolean;
  children?: ReactNode;
};

export type DatePickerCalendarProps = ComponentStyles & {
  id?: string;
  children?: ReactNode;
};

export type DatePickerDayProps = ComponentStyles & {
  date: DatePickerDayValue;
  children?: ReactNode;
};

export type DatePickerNavProps = ComponentStyles & {
  type?: 'month' | 'year';
  direction?: -1 | 1;
  children?: ReactNode;
};

export type DatePickerYearInputProps = ComponentStyles;

const DATE_PICKER_ROLE = 'date-picker';
const INPUT_ROLE = 'date-picker-input';
const TRIGGER_ROLE = 'date-picker-trigger';
const CALENDAR_ROLE = 'date-picker-calendar';
const DAY_ROLE = 'date-picker-day';
const NAV_ROLE = 'date-picker-nav';
const YEAR_INPUT_ROLE = 'date-picker-year-input';

const datePickerStyles: ComponentStyles = {};

register('datePicker', datePickerStyles);
register('datePickerInput', {});
register('datePickerTrigger', {});
register('datePickerCalendar', {});
register('datePickerDay', {});
register('datePickerNav', {});
register('datePickerYearInput', {});

/**
 * Single-date picker. The root holds the chosen date, the month shown, and
 * the popup; the field, the trigger, and the calendar all follow it.
 */
export const DatePicker = setup<DatePickerProps>((props) => {
  const grid = $static(() => props.grid);
  const picker = aria(DATE_PICKER_ROLE, props as AnyType, { grid });
  const className = () => $families(AUI_CLASS.DATE_PICKER, props, auiConfig.datePicker);

  return () => (
    <div ref={picker.ref} {...picker.restProps(OMIT_KEYS)} className={className()}>
      {renderDynamic(props.children, picker)}
    </div>
  );
}, 'DatePicker');

/**
 * Text field that types a date instead of opening the calendar. Under a range
 * picker it types one end through `slot`.
 */
export const DatePickerInput = setup<DatePickerInputProps>((props) => {
  const input = aria(INPUT_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DATE_PICKER_INPUT, props, auiConfig.datePickerInput);

  return () => <input ref={input.ref} {...input.restProps([...OMIT_KEYS, 'slot'])} className={className()} />;
}, 'DatePickerInput');

/**
 * Button that opens the calendar. It carries the popup contract, so the
 * calendar needs no wiring of its own.
 */
export const DatePickerTrigger = setup<DatePickerTriggerProps>((props) => {
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DATE_PICKER_TRIGGER], props, auiConfig.datePickerTrigger);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </button>
  );
}, 'DatePickerTrigger');

/**
 * Calendar popup. Children are the month header — steppers, the month name,
 * the year field — and the day grid is compiled from the calendar itself.
 */
export const DatePickerCalendar = setup<DatePickerCalendarProps>((props) => {
  const calendar = aria(CALENDAR_ROLE, props as AnyType);
  const shadow = shadowPortal(() => calendar.open);
  const className = () =>
    $families([AUI_CLASS.MENU_PANEL, AUI_CLASS.DATE_PICKER_CALENDAR], props, auiConfig.datePickerCalendar);

  return () =>
    shadow(
      <div ref={calendar.ref} {...calendar.restProps(OMIT_KEYS)} className={className()}>
        {props.children && <div className={AUI_CLASS.DATE_PICKER_HEADER}>{props.children}</div>}
        <div className={AUI_CLASS.DATE_PICKER_GRID}>
          <For each={() => calendar.grid.weeks}>
            {(label) => <div className={AUI_CLASS.DATE_PICKER_WEEKDAY}>{label}</div>}
          </For>
          <For each={() => calendar.grid.dates}>{(date) => <DatePickerDay date={date} />}</For>
        </div>
      </div>
    );
}, 'DatePickerCalendar');

/**
 * One day cell. It is a gridcell, not a button: the calendar owns the tab
 * stop and the arrows, and activation chooses the day.
 */
export const DatePickerDay = setup<DatePickerDayProps>((props) => {
  const day = aria(DAY_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DATE_PICKER_DAY, props, auiConfig.datePickerDay);

  return () => (
    <div ref={day.ref} {...day.restProps(OMIT_KEYS)} className={className()}>
      {props.children ?? day.date.date}
    </div>
  );
}, 'DatePickerDay');

/**
 * Month or year stepper. Activating it moves the grid; it never chooses a day.
 */
export const DatePickerNav = setup<DatePickerNavProps>((props) => {
  const nav = aria(NAV_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.DATE_PICKER_NAV], props, auiConfig.datePickerNav);

  return () => (
    <button ref={nav.ref} {...nav.restProps([...OMIT_KEYS, 'type'])} type="button" className={className()}>
      {props.children}
    </button>
  );
}, 'DatePickerNav');

/**
 * Four-digit field that jumps the grid to a year without choosing a day.
 */
export const DatePickerYearInput = setup<DatePickerYearInputProps>((props) => {
  const input = aria<HTMLInputElement>(YEAR_INPUT_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.DATE_PICKER_YEAR, props, auiConfig.datePickerYearInput);

  return () => <input ref={input.ref} {...input.restProps(OMIT_KEYS)} className={className()} />;
}, 'DatePickerYearInput');
