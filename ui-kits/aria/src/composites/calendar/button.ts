import { effect } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { parseDate, type ParsedDate } from '../../utils/calendar.js';
import { type DatePickerBase, datePickerCtx } from './picker.js';

export interface DatePickerDayProps extends AriaProps {
  date: string | ParsedDate;
}

export interface DatePickerDayAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'gridcell';
  tabindex?: number;
  'data-date'?: string;
  'aria-current'?: 'date';
  'aria-selected'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

export class DatePickerDayAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  DatePickerDayProps,
  DatePickerDayAttributes<E>
> {
  protected picker?: DatePickerBase;

  public get date(): ParsedDate {
    return this.properties.date as ParsedDate;
  }

  public get selected() {
    if (!this.picker) return false;
    return this.date.iso === this.picker.start.iso || this.date.iso === this.picker.end.iso;
  }

  public get disabled() {
    if (this.properties.disabled || this.picker?.disabled || !this.date.time) return true;
    if (this.picker?.limit.min && this.date.time < this.picker.limit.min.getTime()) return true;
    return !!(this.picker?.limit.max && this.date.time > this.picker.limit.max.getTime());
  }

  public get inRange() {
    if (!this.date.time || !this.picker?.start.time || !this.picker?.end.time) return false;
    return this.date.time >= this.picker.start.time && this.date.time <= this.picker.end.time;
  }

  public constructor(props: DatePickerDayProps) {
    super(props, { clickable: true, native: false });

    this.picker = datePickerCtx.get();
    this.omittedAttrs.push('date', 'role', 'tabindex', 'aria-selected', 'aria-disabled', 'aria-current');

    effect(() => {
      if (!this.picker) return;

      const { date } = this.properties;
      if (typeof date === 'string') {
        this.properties.date = parseDate(this.picker.properties.locales!, date);
      }
    });

    this.on('click', this.handleClick);
    this.on('focus', () => {
      const event = new CustomEvent('input', { bubbles: true, cancelable: true, detail: this.date.raw });
      this.element?.dispatchEvent(event);
      this.properties.oninput?.(event);
      this.dispatch(event);
    });

    this.update();
  }

  protected override createAttributes(): DatePickerDayAttributes<E> {
    const date = this.date;
    const picker = this.picker;
    const isToday = this.date.iso === this.picker?.today.iso;
    const disabled = this.disabled;
    const selected = disabled ? false : this.selected;

    return {
      role: 'gridcell',
      tabindex: selected || isToday ? 0 : -1,
      'data-date': date.iso,
      'data-in-range': this.inRange ? 'true' : undefined,
      'data-offside': date.month !== picker?.range.month ? ('true' as const) : undefined,
      'aria-selected': ariaBoolean(selected),
      'aria-disabled': ariaBoolean(disabled),
      'aria-current': isToday ? 'date' : undefined,
    } as DatePickerDayAttributes<E>;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || !this.date.raw || this.disabled) return;
    this.picker?.select(this.date.raw);
  };
}
