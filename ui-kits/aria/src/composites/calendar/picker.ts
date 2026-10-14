import { $static, $symbol, createContext, derived } from '@airlib/core';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { type ParsedDate, parseDate } from '../../utils/calendar.js';
import { PopupAria, type PopupProps, popupCtx } from '../popup.js';

export type DatePickerInputEvent = AriaEvent<string>;

export interface DatePickerBaseProps extends PopupProps {
  min?: string;
  max?: string;
  year?: number;
  month?: number;
  value?: string | [string, string];
  label?: string;
  locales?: string[];
  oninput?: AriaEventHandler<DatePickerInputEvent>;
}

export interface DatePickerOptions extends AriaOptions {
  type?: 'single' | 'range';
  grid?: 'fixed' | 'dynamic';
}

export interface DatePickerProps extends Omit<DatePickerBaseProps, 'value' | 'onchange'> {
  value?: string;
  onchange?: AriaEventHandler<AriaEvent<string | undefined>>;
}

const DATE_PICKER_SYMBOL = $symbol('date-picker');

export const datePickerCtx = createContext<DatePickerBase>();
export const dateSelectionCtx = createContext<AriaProps>();

export class DatePickerBase<
  E extends BaseElement = HTMLElement,
  P extends DatePickerBaseProps = DatePickerBaseProps,
> extends PopupAria<E, P, AriaAttributes<E>, DatePickerOptions> {
  public readonly range: ParsedDate;
  public readonly today: ParsedDate;
  public readonly start: ParsedDate;
  public readonly end: ParsedDate;
  public readonly limit: { min?: Date; max?: Date };

  public get month() {
    return this.properties.month;
  }

  public get year() {
    return this.properties.year;
  }

  constructor(props: DatePickerProps = {}, options: DatePickerOptions = {}) {
    super(props, {
      type: 'single',
      grid: 'fixed',
      ...options,
      name: 'date-picker',
      symbol: DATE_PICKER_SYMBOL,
      panelRole: 'dialog',
      triggerRole: 'combobox',
    });

    this.omittedAttrs.push('value', 'year', 'month', 'locales', 'min', 'max', 'activeDate', 'oninput');

    $static(() => {
      if (!this.properties.locales) {
        this.properties.locales = [Intl.DateTimeFormat().resolvedOptions().locale];
      }
    });

    this.today = derived.as(() => {
      return parseDate(this.properties.locales!, new Date());
    });

    this.start = derived.as(() => {
      const value =
        this.options.type === 'single'
          ? (this.properties.value as string)
          : (this.properties.value as unknown as [string])?.[0];
      if (!value) return {};
      return parseDate(this.properties.locales!, value);
    });

    this.end = derived.as(() => {
      if (this.options.type !== 'range') return {};
      const value = (this.properties.value as unknown as [Date, Date])?.[1];
      if (!value) return {};
      return parseDate(this.properties.locales!, value);
    });

    this.limit = derived.as(() => {
      return {
        min: this.properties.min ? new Date(this.properties.min) : undefined,
        max: this.properties.max ? new Date(this.properties.max) : undefined,
      };
    });

    $static(() => {
      if (!this.properties.year || typeof this.properties.year !== 'number') {
        this.properties.year = this.start.year || this.today.year!;
      }
      if (!this.properties.month || typeof this.properties.month !== 'number') {
        this.properties.month = this.start.month || this.today.month!;
      }
    });

    this.range = derived.as(() => {
      return parseDate(this.properties.locales!, `${this.properties.year!}-${this.properties.month!}`);
    });

    popupCtx.set(this as never);
    datePickerCtx.set(this as never);
    dateSelectionCtx.set(this.properties);
  }

  public select(start: string, end?: string) {
    if (!start || start === this.properties.value) return;

    if (this.options.type === 'single') {
      this.properties.value = start;
      this.commit();
    } else if (this.options.type === 'range') {
      if (start && end) {
        this.properties.value = [start, end];
        this.commit(true);
        return;
      }

      const current = ((this.properties.value as unknown) ?? []) as [string, string];
      if (current.includes(start)) return;

      const date = new Date(start);
      const [cStart] = current;

      if (cStart) {
        const startDate = new Date(cStart);

        if (date < startDate) {
          current[0] = start;
          current[1] = cStart;
        } else {
          current[1] = start;
        }
      } else {
        current[0] = start;
      }

      this.commit(current.every(Boolean));
    }
  }

  public deselect(index?: number) {
    if (this.disabled || !this.properties.value) return;

    if (this.properties.type === 'range' || !index) {
      this.properties.value = undefined;
      this.commit();
    } else {
      (this.properties.value as string[])[index] = undefined as never;
      this.commit((this.properties.value as [string, string]).every(Boolean));
    }
  }

  public navigateYear(direction: -1 | 1): void {
    this.properties.year! += direction;
  }

  public navigateMonth(direction: -1 | 1): void {
    const current = this.properties.month!;

    if (direction === 1 && current === 12) {
      this.properties.year! += 1;
      this.properties.month! = 1;
    } else if (direction === -1 && current === 1) {
      this.properties.year! -= 1;
      this.properties.month! = 12;
    } else {
      this.properties.month! += direction;
    }
  }

  protected commit(close?: boolean) {
    if (close || this.options.type === 'single') this.open = false;
    this.emitChange();
  }

  protected emitChange() {
    if (this.start.year && this.start.month) {
      this.assign({ year: this.start.year, month: this.start.month } as P);
    }

    const event = new CustomEvent('change', { bubbles: true, detail: this.properties.value, cancelable: true });
    this.element?.dispatchEvent(event);
    this.properties.onchange?.(event);
  }
}

export class DatePickerAria<E extends BaseElement = HTMLElement> extends DatePickerBase<E, DatePickerProps> {
  public get value(): string | undefined {
    return this.properties.value;
  }

  public set value(value: string | undefined) {
    this.properties.value = value;
  }

  public constructor(props: DatePickerProps = {}) {
    super(props);
    this.update();
  }
}
