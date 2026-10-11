import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaOptions, AriaProps, BaseElement, EventHandler } from '../types.js';

/**
 * Ambient instance context for the enclosing Field coordinator.
 */
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
  role?: 'group';
}

/**
 * Compiled HTML and ARIA attributes for FieldLabel elements.
 *
 * @template E - Target Element type
 */
export interface FieldLabelAttributes<E extends BaseElement = HTMLLabelElement> extends AriaAttributes<E> {
  id: string;
  for?: string;
}

/**
 * Compiled HTML and ARIA attributes for FieldControl elements.
 *
 * @template E - Target Element type
 */
export interface FieldControlAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: 'true';
  'aria-disabled'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
}

/**
 * Compiled HTML and ARIA attributes for FieldDescription elements.
 *
 * @template E - Target Element type
 */
export interface FieldDescriptionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

/**
 * Compiled HTML and ARIA attributes for FieldError elements.
 *
 * @template E - Target Element type
 */
export interface FieldErrorAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  'aria-live': 'polite';
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
    this.omittedAttrs.push('id', 'type', 'value', 'invalid', 'oninput', 'disabled', 'required', 'placeholder');

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

/**
 * Slotted control proxy reflecting ambient field ID, disabled, required,
 * invalid, and describedby state onto the bound element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldControlAria<
  E extends BaseElement = HTMLElement,
  A extends FieldControlAttributes<E> = FieldControlAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public get type() {
    return this.field?.type ?? 'text';
  }

  public get value() {
    return this.field?.value ?? '';
  }

  public get invalid() {
    return this.field?.invalid ?? false;
  }

  public get disabled() {
    return this.field?.disabled ?? false;
  }

  public get required() {
    return this.field?.required ?? false;
  }

  /**
   * Controls bind native inputs far more often than custom elements,
   * so native is the default unless explicitly declined.
   */
  public override get isNative(): boolean {
    return this.options.native ?? true;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push(
      'id',
      'type',
      'value',
      'disabled',
      'required',
      'placeholder',
      'aria-labelledby',
      'aria-describedby',
      'aria-errormessage'
    );

    this.on('input', (e: KeyboardEvent) => {
      if (!this.field) return;

      const target = e.target as HTMLInputElement;
      const value = target.value;
      this.field.value = value;

      if (this.field.canValidate) {
        const message = this.field.validate(value);
        this.field!.assign({
          invalid: !!message,
          invalidMessages: message!,
        });
      } else {
        this.field.invalid = !target.checkValidity();
      }

      this.dispatch(e as never as AriaEvent);
    });
    this.on('blur', () => {
      if (!this.field) return;
      this.field.touched = true;
    });

    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the control element.
   */
  protected override createAttributes(): A {
    const field = this.field;
    if (!field) return {} as A;

    const { labelled, described } = field.options;
    const key = field.id;
    const invalid = field.touched && field.invalid;

    const attrs = {
      id: `${key}-control`,
      'aria-invalid': invalid ? 'true' : undefined,
      'aria-labelledby': labelled ? `${key}-label` : undefined,
      'aria-describedby': described ? `${key}-desc` : undefined,
      'aria-errormessage': invalid ? `${key}-error` : undefined,
    } as A;

    if (this.isNative) {
      Object.assign(attrs, {
        type: field.type,
        value: this.value,
        disabled: this.disabled,
        required: this.required,
        placeholder: field.placeholder,
      });
    } else {
      Object.assign(attrs, {
        'aria-disabled': this.disabled ? 'true' : 'false',
        'aria-required': this.required ? 'true' : 'false',
      });
    }

    return attrs;
  }
}

/**
 * Label association member binding to the field control via `for` or ID reference.
 *
 * @template E - Target Element type (defaults to HTMLLabelElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldLabelAria<
  E extends BaseElement = HTMLLabelElement,
  A extends FieldLabelAttributes<E> = FieldLabelAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('for');
    this.update();
  }

  /**
   * Labels bind `<label>` far more often than custom elements,
   * so native is the default unless explicitly declined.
   */
  public override get isNative(): boolean {
    return this.options.native ?? true;
  }

  /**
   * Computes HTML attributes for the label element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;
    const fieldId = this.field?.id;

    return {
      id: `${fieldId}-label`,
      for: this.isNative ? `${fieldId}-control` : undefined,
    } as A;
  }
}

/**
 * Helper text container referenced via the control's `aria-describedby`.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldDescriptionAria<
  E extends BaseElement = HTMLElement,
  A extends FieldDescriptionAttributes<E> = FieldDescriptionAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id');
    this.update();
  }

  /**
   * Computes HTML attributes for the description element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;

    return {
      id: `${this.field.id}-desc`,
    } as A;
  }
}

/**
 * Error message container with polite live region, referenced while invalid.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class FieldErrorAria<
  E extends BaseElement = HTMLElement,
  A extends FieldErrorAttributes<E> = FieldErrorAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Enclosing Field coordinator discovered from ambient context.
   */
  protected field = fieldCtx.get();

  public get visible() {
    if (!this.field) return false;
    return this.field.touched && this.field?.invalid;
  }

  public get message() {
    return this.field?.invalidMessages;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id', 'hidden', 'aria-live');
    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the error element.
   */
  protected override createAttributes(): A {
    if (!this.field) return {} as A;

    return {
      id: `${this.field.id}-error`,
      hidden: !this.visible,
      'aria-live': 'polite',
    } as A;
  }
}
