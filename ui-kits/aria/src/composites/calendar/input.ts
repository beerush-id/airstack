import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { PopupTriggerAria, type PopupTriggerAttributes } from '../popup.js';
import type { DatePickerAria } from './picker.js';

export interface DatePickerInputProps extends AriaProps {
  id?: string;
  slot?: string;
  disabled?: boolean;
}

export interface DatePickerInputAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {
  value?: string;
}

export class DatePickerInputAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  DatePickerInputProps,
  DatePickerInputAttributes<E>
> {
  protected declare host: DatePickerAria;

  public get slot() {
    return this.properties.slot;
  }

  protected get index() {
    return this.properties.slot === 'start' ? 0 : this.properties.slot === 'end' ? 1 : undefined;
  }

  public constructor(props: DatePickerInputProps = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);
    this.omittedAttrs.push('value');

    this.on('blur', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (!value) this.host?.deselect(this.index);

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        (this.element as unknown as HTMLInputElement).value = this.host!.start.iso ?? '';
      } else {
        this.host.select(date.toISOString());
      }
    });

    this.on('input', (e) => {
      const event = new CustomEvent('input', {
        detail: (e.target as HTMLInputElement).value,
        bubbles: true,
        cancelable: true,
      });

      this.dispatch(event);
    });

    this.update();
  }

  protected override createAttributes(): DatePickerInputAttributes<E> {
    const attrs = Object.assign(super.createAttributes(), {
      role: 'combobox',
      'aria-haspopup': 'dialog',
    });

    if (this.isNative) {
      Object.assign(attrs, {
        type: 'text',
        value: this.host?.start.iso,
      });
    }

    return attrs;
  }
}
