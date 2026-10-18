import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { PopupTriggerAria, type PopupTriggerAttributes } from '../popup/trigger.js';
import type { DatePickerProps } from './picker.js';

export class DatePickerTriggerAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  DatePickerProps,
  PopupTriggerAttributes<E>
> {
  public constructor(props: AriaProps = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);
    this.update();
  }
}
