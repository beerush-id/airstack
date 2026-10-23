import { aria, TIME_PART, type TimePartLabels, type TimePickerAria, timePickerCtx } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, type AnyType, type Bindable, classx, Show, setup } from '@airlib/react';
import { $families, auiConfig, FIELD_STYLES, type FieldStyles, OMIT_KEYS } from '../config.js';
import { ArrowDown } from '../icons/index.js';
import { Popover } from './Popover.js';

/**
 * Names for the picker's parts — `hour`, `minute`, and `period` — each naming
 * and captioning its segment. None has a default: names are yours, in your
 * users' language. The periods read in the locale's own words.
 */
export type TimePickerLabels = TimePartLabels;

export type TimePickerProps = FieldStyles & {
  /** The time, as `HH:MM` on a 24-hour clock whatever the display shows, e.g. `14:30`. */
  value?: Bindable<string>;
  /** A 12-hour clock with AM/PM, or a 24-hour one. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Minutes between the minute segment's steps. Defaults to 1. */
  step?: number;
  /** Names the picker for screen readers. */
  label?: string;
  /** What the field shows before a time is set. */
  placeholder?: string;
  locales?: string[];
  /** Draws the segments in place, with no field or popup. */
  inline?: boolean;
  disabled?: boolean;
  labels?: TimePickerLabels;
};

const CLASS = {
  PICKER: 'aui-time-picker',
  INLINE: 'aui-time-picker-inline',
  FIELD: 'aui-time-picker-field',
  PANEL: 'aui-time-picker-panel',
  INPUT: 'aui-time-picker-input',
  SEGMENT: 'aui-time-picker-segment',
  SEGMENT_SLOT: 'aui-time-picker-slot',
  CAPTION: 'aui-time-picker-caption',
  SEPARATOR: 'aui-time-picker-separator',
  PERIOD: 'aui-time-picker-period',
};

// The shell's own props, which the group element doesn't take.
const SHELL_KEYS = [...OMIT_KEYS, 'inline', 'hourCycle', 'step', 'locales', 'disabled'];

register('timePicker', { ...FIELD_STYLES });

/**
 * A time of day: a field showing the time that opens its segments in a popup —
 * hour, minute, and AM/PM on a 12-hour clock. `inline` draws the segments in
 * place instead, for a form or an answer. The value is always `HH:MM` on a
 * 24-hour clock, so it reads the same to code and to an agent.
 */
export const TimePicker = setup<TimePickerProps>((props) => {
  // The clock and the locale are the picker's mode, read once.
  const { inline, ...options } = $static(() => ({
    inline: !!props.inline,
    hourCycle: props.hourCycle,
    locales: props.locales,
    step: props.step,
  }));
  aria('time-picker', props as AnyType, options);

  return () => (
    <div className={$families(classx(CLASS.PICKER, inline && CLASS.INLINE), { className: props.className })}>
      {inline ? <TimePickerInput /> : <TimePickerField />}
    </div>
  );
}, 'TimePicker');

/**
 * The field: the time as text and a caret, opening the segments in a popup.
 * It never reads the time itself, so a change redraws only the text.
 */
const TimePickerField = setup((props: AnyType) => {
  const picker = timePickerCtx.get() as TimePickerAria;
  const time = picker.properties as TimePickerProps;
  const trigger = aria('button', props, { native: true } as never);

  // The popup is created after the button, so it opens from it.
  return () => (
    <>
      <button
        ref={trigger.ref}
        {...trigger.restProps(OMIT_KEYS)}
        type="button"
        aria-label={time.label}
        disabled={time.disabled}
        className={$families([AUI_CLASS.CONTROL, AUI_CLASS.SELECT_TRIGGER, CLASS.FIELD], time, auiConfig.timePicker)}
      >
        <TimePickerText />
        <ArrowDown className={AUI_CLASS.SELECT_CARET} aria-hidden="true" />
      </button>
      <Popover className={CLASS.PANEL}>
        <TimePickerInput />
      </Popover>
    </>
  );
}, 'TimePickerField');

/**
 * The field's text: the time formatted for the locale, or the placeholder
 * before one is set. The only reader of the time outside the segments.
 */
const TimePickerText = setup(() => {
  const picker = timePickerCtx.get() as TimePickerAria;
  const time = picker.properties as TimePickerProps;

  return () => <span className={AUI_CLASS.SELECT_VALUE}>{picker.text || time.placeholder}</span>;
}, 'TimePickerText');

/**
 * The segments: hour and minute, and AM/PM on a 12-hour clock. Arrows, the
 * wheel, and a vertical drag step a segment; typing sets it.
 */
export const TimePickerInput = setup(() => {
  const picker = timePickerCtx.get() as TimePickerAria;

  return () => (
    <div ref={picker.ref} {...picker.restProps(SHELL_KEYS as never)} className={CLASS.INPUT}>
      <TimePickerSegment index={TIME_PART.HOUR} />
      <span className={CLASS.SEPARATOR} aria-hidden="true">
        :
      </span>
      <TimePickerSegment index={TIME_PART.MINUTE} />
      {picker.twelve && <TimePickerSegment index={TIME_PART.PERIOD} />}
    </div>
  );
}, 'TimePickerInput');

/**
 * One segment — a text input the segment part fills with its token — with its
 * name captioned under it. The part writes the input's value, so a change to
 * the time never redraws the segment.
 */
const TimePickerSegment = setup<{ index: number }>((props) => {
  const time = (timePickerCtx.get() as TimePickerAria).properties as TimePickerProps;
  const segment = aria('time-segment', props, { native: true });

  return () => (
    <div className={CLASS.SEGMENT_SLOT}>
      <input
        ref={segment.ref}
        {...segment.restProps(OMIT_KEYS as never)}
        type="text"
        className={classx(
          $families([AUI_CLASS.CONTROL, AUI_CLASS.INPUT, CLASS.SEGMENT], time, auiConfig.timePicker),
          props.index === TIME_PART.PERIOD && CLASS.PERIOD
        )}
      />
      <Show when={() => segment.label}>
        {(label) => (
          <span className={CLASS.CAPTION} aria-hidden="true">
            {label}
          </span>
        )}
      </Show>
    </div>
  );
}, 'TimePickerSegment');
