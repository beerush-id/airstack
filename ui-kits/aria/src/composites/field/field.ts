import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, EventHandler } from '../../types.js';

export const fieldCtx = createContext<FieldAria>();

/**
 * Reactive input properties for the Field root coordinator.
 */
export interface FieldProps extends AriaProps {
  /**
   * Explicit field namespace ID.
   */
  id?: string;

  /**
   * Requirement flag.
   */
  required?: boolean;

  /**
   * Disabled flag inherited by controls.
   */
  disabled?: boolean;

  /**
   * Input type.
   */
  type?: string;

  /**
   * Input value.
   */
  value?: string | number;

  /**
   * Input placeholder.
   */
  placeholder?: string;

  /**
   * Whether the field is invalid.
   */
  invalid?: boolean;

  /**
   * Invalid messages.
   */
  invalidMessages?: string | string[];

  /**
   * Whether the field has been touched.
   */
  touched?: boolean;

  /**
   * Input event handler.
   */
  oninput?: EventHandler<InputEvent, HTMLInputElement>;
}

export interface FieldOptions extends AriaOptions {
  validate?: (value?: string | number) => string | string[] | void;
  labelled?: boolean;
  described?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Field container element.
 *
 * @template E - Target Element type
 */
export interface FieldAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}
const ROLE_FIELD = 'field';

/**
 * Container coordinator hosting ambient field ID, disabled, invalid, and required state.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class FieldAria<
  E extends BaseElement = HTMLElement,
  T extends FieldProps = FieldProps,
  A extends FieldAttributes<E> = FieldAttributes<E>,
> extends Aria<E, T, A, FieldOptions> {
  public get id() {
    return this.properties.id!;
  }

  public get type() {
    return this.properties.type ?? 'text';
  }

  public get value() {
    return this.properties.value;
  }

  public set value(value: string | number | undefined) {
    this.properties.value = value;
  }

  /**
   * Whether the field currently fails validation.
   */
  public get invalid(): boolean {
    return !!this.properties.invalid;
  }

  public set invalid(value: boolean) {
    this.properties.invalid = value;
  }

  public get touched(): boolean {
    return !!this.properties.touched;
  }

  public set touched(value: boolean) {
    this.properties.touched = value;
  }

  /**
   * Whether user interaction is disabled across the entire field.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Whether the field is required.
   */
  public get required(): boolean {
    return !!this.properties.required;
  }

  /**
   * Input placeholder.
   */
  public get placeholder(): string {
    return this.properties.placeholder ?? '';
  }

  public get canValidate() {
    return typeof this.options.validate === 'function';
  }

  public get invalidMessages(): string | string[] | undefined {
    return this.properties.invalidMessages;
  }

  public set invalidMessages(messages: string | string[] | undefined) {
    this.properties.invalidMessages = messages;
  }

  public declare options: FieldOptions;

  public constructor(props: Partial<T> = {}, options: AriaOptions = {}) {
    super(props, { labelled: true, described: true, ...options });

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_FIELD}-${uIndex($symbol(ROLE_FIELD), true)}`;
    });
    this.omittedAttrs.push('id', 'type', 'value', 'invalid', 'touched', 'invalidMessages', 'oninput', 'disabled', 'required', 'placeholder');

    fieldCtx.set(this as unknown as FieldAria);
    this.update();
  }

  public validate(value?: string | number) {
    return this.options?.validate?.(value);
  }

  /**
   * Computes HTML and ARIA attributes for the field container.
   */
  protected override createAttributes(): A {
    return {
      id: this.properties.id,
    } as A;
  }
}
