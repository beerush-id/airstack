import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { type FieldAria, fieldCtx } from './field.js';

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
