import { aria, type DatePickerAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, For, renderDynamic, Snippet, setup, shadowPortal } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, FIELD_STYLES, type FieldStyles, OMIT_KEYS } from '../config.js';
import { ArrowLeft, ArrowRight, CalendarIcon } from '../icons/index.js';
import { datePickerInField, datePickerScope, datePickerView } from './scopes.js';

export type DatePickerGrid = 'fixed' | 'dynamic';
export type DatePickerSlot = 'start' | 'end';
export type DatePickerDayValue = string | { iso?: string; date?: number };

export type DatePickerProps = FieldStyles & {
  id?: string;
  value?: Bindable<string>;
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
  /** Draws the calendar in place, always showing, with no field or popup: picking a day sets the value and closes nothing. */
  inline?: boolean;
  labels?: DatePickerLabels;
  children?: ReactNode | ((picker: DatePickerAria) => ReactNode);
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<string | undefined>) => void;
  onopen?: (event: CustomEvent<true>) => void;
  onclose?: (event: CustomEvent<false>) => void;
};

/**
 * Accessible names for the icon-only controls the simple form renders. None
 * has a default: names are yours, in your users' language.
 */
export type DatePickerLabels = {
  open?: string;
  previous?: string;
  next?: string;
  year?: string;
  start?: string;
  end?: string;
};

export type DatePickerHeaderProps = {
  previousLabel?: string;
  nextLabel?: string;
  yearLabel?: string;
};

export type DatePickerFieldProps = FieldStyles & {
  children?: ReactNode;
};

export type DatePickerInputProps = FieldStyles & {
  id?: string;
  slot?: DatePickerSlot;
  disabled?: boolean;
  placeholder?: string;
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

register('datePicker', {});
register('datePickerField', { ...FIELD_STYLES });
register('datePickerInput', { ...FIELD_STYLES });
register('datePickerTrigger', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TONAL });
register('datePickerCalendar', { size: SIZES.MD, color: COLORS.PRIMARY });
register('datePickerDay', {});
register('datePickerNav', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });
register('datePickerYearInput', {});

/**
 * Single-date picker. The root holds the chosen date, the month shown, and
 * the popup; the field, the trigger, and the calendar all follow it.
 * Without children it renders one field holding the date and a calendar
 * button, plus the calendar with its default header; pass a render function
 * to compose your own.
 */
export const DatePicker = setup<DatePickerProps>((props) => {
  const grid = $static(() => props.grid);
  const inline = $static(() => !!props.inline);
  const picker = aria(DATE_PICKER_ROLE, props as AnyType, { grid, inline });
  const className = () => $families(AUI_CLASS.DATE_PICKER, { className: props.className }, auiConfig.datePicker);

  datePickerScope.provide(props);
  datePickerView.set(picker as AnyType);

  const header = () => (
    <DatePickerHeader previousLabel={props.labels?.previous} nextLabel={props.labels?.next} yearLabel={props.labels?.year} />
  );

  return () => (
    <div ref={picker.ref} {...picker.restProps([...OMIT_KEYS, 'placeholder', 'labels', 'inline'])} className={className()}>
      {props.children ? (
        renderDynamic(props.children, picker)
      ) : inline ? (
        <DatePickerCalendar>{header()}</DatePickerCalendar>
      ) : (
        <>
          <DatePickerField>
            <DatePickerInput placeholder={props.placeholder} aria-label={props.label} />
            <DatePickerTrigger aria-label={props.labels?.open} />
          </DatePickerField>
          <DatePickerCalendar>{header()}</DatePickerCalendar>
        </>
      )}
    </div>
  );
}, 'DatePicker');

/**
 * One field box holding the date inputs and the calendar button, so typing
 * and picking read as a single control. Inputs inside it go bare and the
 * trigger sits at its end as a quiet icon button.
 */
export const DatePickerField = setup<DatePickerFieldProps>((props) => {
  const styles = datePickerScope.inherit(props);
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.DATE_PICKER_FIELD], styles, auiConfig.datePickerField);

  datePickerInField.set(true);

  return () => <div className={className()}>{props.children}</div>;
}, 'DatePickerField');

/**
 * Text field that types a date instead of opening the calendar. Under a range
 * picker it types one end through `slot`. Inside a `DatePickerField` it drops
 * its own box and lets the field draw it.
 */
export const DatePickerInput = setup<DatePickerInputProps>((props) => {
  const inField = datePickerInField.get();
  const styles = datePickerScope.inherit(props);
  const input = aria(INPUT_ROLE, props as AnyType);
  const className = () =>
    inField
      ? $families(AUI_CLASS.DATE_PICKER_INPUT, { className: props.className }, auiConfig.datePickerInput)
      : $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, AUI_CLASS.DATE_PICKER_INPUT], styles, auiConfig.datePickerInput);

  return () => <input ref={input.ref} {...input.restProps([...OMIT_KEYS, 'slot'])} className={className()} />;
}, 'DatePickerInput');

/**
 * Button that opens the calendar. It carries the popup contract, so the
 * calendar needs no wiring of its own.
 */
export const DatePickerTrigger = setup<DatePickerTriggerProps>((props) => {
  const inField = datePickerInField.get();
  const scoped = datePickerScope.inherit(props);
  const trigger = aria(TRIGGER_ROLE, props as AnyType);
  // The button keeps its own variant (the field's variant names a field surface); inside a field it goes quiet.
  const className = () => {
    const families = $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DATE_PICKER_TRIGGER],
      {
        size: scoped.size,
        color: scoped.color,
        variant: props.variant ?? (inField ? VARIANTS.TEXT : undefined),
        className: props.className,
      },
      auiConfig.datePickerTrigger
    );
    return props.children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
  };

  // Without children it is a calendar glyph: name it with your own `aria-label`.
  return () => (
    <button ref={trigger.ref} {...trigger.restProps(OMIT_KEYS)} className={className()}>
      {props.children ?? <CalendarIcon aria-hidden="true" />}
    </button>
  );
}, 'DatePickerTrigger');

/**
 * Calendar popup. Children are the month header — steppers, the month name,
 * the year field — and the day grid is compiled from the calendar itself.
 */
export const DatePickerCalendar = setup<DatePickerCalendarProps>((props) => {
  const styles = datePickerScope.inherit(props);
  const calendar = aria(CALENDAR_ROLE, props as AnyType);
  const shadow = shadowPortal(() => calendar.open);
  const inline = $static(() => calendar.inline);
  // In place it is a block of the page, not a floating panel.
  const className = () =>
    $families(
      [inline ? AUI_CLASS.DATE_PICKER_INLINE : AUI_CLASS.PANEL, AUI_CLASS.DATE_PICKER_CALENDAR],
      styles,
      auiConfig.datePickerCalendar
    );

  const content = () => (
    <div ref={calendar.ref} {...calendar.restProps([...OMIT_KEYS, 'labels', 'inline'])} className={className()}>
      {props.children && <div className={AUI_CLASS.DATE_PICKER_HEADER}>{props.children}</div>}
      <div className={AUI_CLASS.DATE_PICKER_GRID}>
        <For each={() => calendar.grid.weeks}>{(label) => <div className={AUI_CLASS.DATE_PICKER_WEEKDAY}>{label}</div>}</For>
        <For each={() => calendar.grid.dates}>{(date) => <DatePickerDay date={date} />}</For>
      </div>
    </div>
  );

  return () => (inline ? content() : shadow(content()));
}, 'DatePickerCalendar');

/**
 * The default calendar header: month steppers around the month name and the
 * year field. Drop it into `DatePickerCalendar` when composing by hand; the
 * steppers and the year field are named by the labels you pass.
 */
export const DatePickerHeader = setup<DatePickerHeaderProps>((props) => {
  const view = datePickerView.get();

  return () => (
    <>
      <DatePickerNav type="month" direction={-1} aria-label={props.previousLabel} />
      <span className={AUI_CLASS.DATE_PICKER_TITLE}>
        <Snippet>{() => view?.range.monthStr}</Snippet>
        <DatePickerYearInput aria-label={props.yearLabel} />
      </span>
      <DatePickerNav type="month" direction={1} aria-label={props.nextLabel} />
    </>
  );
}, 'DatePickerHeader');

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
  const scoped = datePickerScope.inherit(props);
  const nav = aria(NAV_ROLE, props as AnyType);
  const className = () => {
    const families = $families(
      [AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, AUI_CLASS.DATE_PICKER_NAV],
      { color: scoped.color, size: props.size, variant: props.variant, className: props.className },
      auiConfig.datePickerNav
    );
    return props.children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
  };

  // Without children it shows an arrow pointing its way: name it with your own `aria-label`.
  return () => (
    <button ref={nav.ref} {...nav.restProps([...OMIT_KEYS, 'type'])} type="button" className={className()}>
      {props.children ??
        ((props.direction ?? 1) < 0 ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />)}
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
