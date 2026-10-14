import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { type DatePickerBase, datePickerCtx } from './picker.js';

export interface DatePickerNavProps extends AriaProps {
  type?: 'month' | 'year';
  direction?: -1 | 1;
}

export class DatePickerNav<E extends BaseElement = HTMLElement> extends Aria<E, DatePickerNavProps, AriaAttributes<E>> {
  protected picker?: DatePickerBase;

  public get type(): 'month' | 'year' {
    return this.properties.type ?? 'month';
  }

  public get direction(): -1 | 1 {
    return this.properties.direction ?? -1;
  }

  public constructor(props: DatePickerNavProps = {}) {
    super(props);
    this.picker = datePickerCtx.get();
    this.omittedAttrs.push('direction');
    this.on('click', this.handleClick);
    this.update();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;

    const picker = this.picker;
    if (!picker || picker.disabled) return;

    if (this.type === 'month') picker.navigateMonth(this.direction);
    else if (this.type === 'year') picker.navigateYear(this.direction);
  };
}

export class DatePickerYearInput<E extends BaseElement = HTMLElement> extends Aria<E> {
  protected picker?: DatePickerBase;

  public constructor(props: DatePickerNavProps = {}) {
    super(props);
    this.picker = datePickerCtx.get();

    this.on('input', this.handleInput);
    this.update();
  }

  protected override createAttributes(): AriaAttributes<E> {
    return {
      type: 'number',
      value: this.picker?.properties.year,
    } as AriaAttributes<E>;
  }

  private readonly handleInput = (event: InputEvent): void => {
    if (event.defaultPrevented) return;

    const picker = this.picker;
    if (!picker || picker.disabled) return;

    const value = (event.target as HTMLInputElement).value;
    if (!value || value.length < 4) return;

    const year = parseInt((event.target as HTMLInputElement).value ?? '', 10);
    if (!Number.isNaN(year)) picker.properties.year = year;
  };
}
