import type { AriaEvent, AriaEventHandler, BaseElement } from '../../types.js';
import { DatePickerBase, type DatePickerBaseProps, type DatePickerOptions } from './picker.js';

export type DateRangePickerChangeEvent = AriaEvent<[string, string] | undefined>;

export interface DateRangePickerProps extends Omit<DatePickerBaseProps, 'value' | 'onchange'> {
  value?: [string, string] | undefined;
  onchange?: AriaEventHandler<DateRangePickerChangeEvent>;
}

export class DateRangePickerAria<E extends BaseElement = HTMLElement> extends DatePickerBase<E, DateRangePickerProps> {
  public get value(): [string, string] | undefined {
    return this.properties.value;
  }

  public set value(value: [string, string] | undefined) {
    this.properties.value = value;
    this.commit(true);
  }

  public constructor(props: DateRangePickerProps = {}, options?: DatePickerOptions) {
    super(props as never, { ...options, type: 'range' });
    this.update();
  }
}
