import { isEmpty } from '@airlib/core';
import type { AriaOptions, AriaProps, BaseElement, DetachFn } from '../../types.js';
import { PopupTriggerAria, type PopupTriggerAttributes, type PopupTriggerOptions } from '../popup/trigger.js';
import type { ComboboxAria } from './combobox.js';

/**
 * Reactive input properties for the Combobox text input.
 */
export interface ComboboxInputProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Whether this input is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Optional placeholder text.
   */
  placeholder?: string;
}

export interface ComboboxInputOptions extends PopupTriggerOptions {}

/**
 * Compiled HTML and ARIA attributes for a Combobox text input.
 *
 * @template E - Target Element type
 */
export interface ComboboxInputAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {
  'aria-autocomplete'?: 'list';
}
/**
 * Editable text input carrying the combobox role: it drives the filter query and the
 * popup's expansion, while traversal and commits run through the composed listbox panel.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ComboboxInputAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  ComboboxInputProps,
  ComboboxInputAttributes<E>,
  ComboboxInputOptions
> {
  protected declare host: ComboboxAria;

  /**
   * Current combobox value.
   */
  public get value() {
    return this.host?.value ?? '';
  }

  /**
   * Current combobox label.
   */
  public get label() {
    return this.host?.label ?? '';
  }

  /**
   * Current combobox text.
   */
  public get text() {
    return this.host?.text ?? '';
  }

  /**
   * Current combobox query.
   */
  public get query() {
    return this.host?.query ?? '';
  }

  /**
   * @param props - User-provided input properties.
   * @param options - User-provided input options.
   */
  public constructor(props: ComboboxInputProps = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);

    this.omittedAttrs.push('aria-autocomplete', 'placeholder');
    this.update();
  }

  /**
   * Compile the input attributes.
   * @return {ComboboxInputAttributes<E>}
   */
  protected override createAttributes(): ComboboxInputAttributes<E> {
    const attrs = super.createAttributes() as ComboboxInputAttributes<E>;

    if (this.isNative) {
      Object.assign(attrs, {
        name: this.host?.triggerId,
        type: 'text',
        value: this.query || this.label || this.text || this.value,
        required: this.host?.properties.required,
        placeholder: this.properties.placeholder,
      });
    } else {
      Object.assign(attrs, {
        'aria-required': this.host?.properties.required ? 'true' : 'false',
        'aria-placeholder': this.properties.placeholder,
      });
    }

    Object.assign(attrs, {
      'aria-autocomplete': 'list',
      'data-placeholder-visible': isEmpty(this.host?.label),
    });

    return attrs;
  }

  protected override attach(): DetachFn | void {
    const detach = super.attach();
    const host = this.element!;

    const selectLabel = (): void => {
      const combo = this.host as unknown as ComboboxAria | undefined;
      if (!combo || this.disabled) return;
      if (combo.query !== '' || combo.text === '') return;
      (this.element as unknown as HTMLInputElement | null)?.select?.();
    };

    const handleInput = (event: Event): void => {
      this.handleInput(event);
    };

    host.addEventListener('input', handleInput);
    host.addEventListener('focus', selectLabel);

    return () => {
      detach?.();
      host.removeEventListener('input', handleInput);
      host.removeEventListener('focus', selectLabel);
    };
  }

  private readonly handleInput = (event: Event): void => {
    const host = this.host as unknown as ComboboxAria | undefined;
    if (!host || this.disabled) return;

    let value = (event.target as HTMLInputElement).value;
    if (host.query === '' && host.text !== '' && value.length > host.text.length && value.startsWith(host.text)) {
      value = value.slice(host.text.length);
    }
    host.assign({ query: value, open: true });

    if (value === '' && !host.multiple) {
      if (host.value !== null && host.value !== undefined) host.value = undefined;
      if (host.text !== '') host.properties.text = '';
    }
  };
}
