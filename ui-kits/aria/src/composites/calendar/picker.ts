import { $static, $symbol, createContext, derived, mutable } from '@airlib/core';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { parseDate, type ParsedDate } from '../../utils/calendar.js';
import { PopupAria, popupCtx, type PopupProps } from '../popup/popup.js';

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
  /**
   * The calendar is drawn in place, always open, with no trigger or popup: picking a day writes
   * the value and closes nothing.
   */
  inline?: boolean;
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
  public readonly draft = mutable<(string | undefined)[]>([undefined, undefined]);

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
      clickable: true,
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
          : (this.properties.value as unknown as [string, string])?.[0];
      if (!value) return {};
      return parseDate(this.properties.locales!, value);
    });

    this.end = derived.as(() => {
      if (this.options.type !== 'range') return {};
      const value = (this.properties.value as unknown as [string, string])?.[1];
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

    /* istanbul ignore else */
    if (this.options.type === 'single') {
      this.properties.value = start;
      this.commit();
    } else if (this.options.type === 'range') {
      if (start && end) {
        this.properties.value = [start, end];
        this.commit(true);
        return;
      }

      const draft = this.draft;
      const store = (this.properties.value as [string | undefined, string | undefined]) ?? [undefined, undefined];
      if (draft.includes(start)) return;

      const date = new Date(start);
      const [cStart] = draft;

      if (cStart) {
        const startDate = new Date(cStart);

        if (date < startDate) {
          draft[0] = start;
          draft[1] = cStart;
        } else {
          draft[1] = start;
        }
      } else {
        draft[0] = start;
      }

      Object.assign(store, { 0: draft[0], 1: draft[1] });
      this.properties.value = store as [string, string];

      if (draft.every(Boolean)) {
        this.commit(true);
      }
    }
  }

  public deselect(index?: number) {
    if (this.disabled || !this.properties.value) return;

    /* istanbul ignore else */
    if (this.options.type === 'single') {
      this.properties.value = undefined;
      this.commit();
    } else if (this.options.type === 'range') {
      if (index) {
        (this.properties.value as string[])[index] = undefined as never;
      } else {
        this.properties.value = [undefined, undefined] as never;
      }

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
    if (!this.options.inline && (close || this.options.type === 'single')) this.open = false;

    this.draft[0] = undefined;
    this.draft[1] = undefined;

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
    this.commit();
  }

  public constructor(props: DatePickerProps = {}, options?: DatePickerOptions) {
    super(props, options);
    this.update();
  }
}
