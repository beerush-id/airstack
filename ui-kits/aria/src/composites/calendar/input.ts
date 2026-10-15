import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { PopupTriggerAria, type PopupTriggerAttributes } from '../popup.js';
import type { DatePickerAria } from './picker.js';
import type { DateRangePickerAria } from './range.js';

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
  protected declare host: DatePickerAria | DateRangePickerAria;

  public get slot() {
    return this.properties.slot;
  }

  public get isRangeInput() {
    return !!(this.host?.options.type === 'range' && this.slot);
  }

  protected get index() {
    return this.properties.slot === 'start' ? 0 : this.properties.slot === 'end' ? 1 : undefined;
  }

  public constructor(props: DatePickerInputProps = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);
    this.omittedAttrs.push('value');

    this.on('blur', (e) => {
      this.handleBlur(e);
    });

    this.on('input', (e) => {
      this.handleInput(e);
    });

    this.update();
  }

  protected override createAttributes(): DatePickerInputAttributes<E> {
    const attrs = Object.assign(super.createAttributes(), {
      role: 'combobox',
      'aria-haspopup': 'dialog',
    });

    let value = this.host?.start.iso;
    if (this.isRangeInput && this.slot === 'end') value = this.host?.end.iso;

    if (this.isNative) {
      Object.assign(attrs, {
        type: 'text',
        value,
      });
    }

    return attrs;
  }

  protected handleInput(e: Event) {
    if (!this.host) return;

    const event = new CustomEvent('input', {
      detail: (e.target as HTMLInputElement).value,
      bubbles: true,
      cancelable: true,
    });

    this.dispatch(event);
  }

  protected handleBlur(e: FocusEvent) {
    if (!this.host) return;

    const value = (e.target as HTMLInputElement).value;

    if (!value) {
      if (this.isRangeInput) {
        const store = (this.host.value ?? [undefined, undefined]) as [string | undefined, string | undefined];
        store[this.index as number] = undefined;
        this.host.value = store as [string, string] | undefined;
      } else {
        this.host.value = undefined;
      }
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      if (this.isRangeInput) {
        const current = this.slot === 'start' ? this.host!.start.iso : this.host!.end.iso;
        (this.element as unknown as HTMLInputElement).value = current ?? '';
      } else {
        (this.element as unknown as HTMLInputElement).value = this.host!.start.iso ?? '';
      }
    } else if (this.isRangeInput) {
      const store = (this.host.value || [undefined, undefined]) as never as [string, string];
      store[this.index as number] = date.toISOString();
      this.host.value = store;
    } else {
      this.host.value = date.toISOString();
    }
  }
}
