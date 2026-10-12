import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type {
  AriaEvent,
  AriaEventHandler,
  AriaInvalid,
  AriaOptions,
  AriaProps,
  BaseElement,
  Primitive,
} from '../types.js';
import { ariaInvalid, ariaRequired } from '../utils/attributes.js';

/**
 * Controller-dispatched checkbox event carrying the committed state in `detail`.
 */
export type CheckboxEvent = AriaEvent<boolean>;

/**
 * Reactive input properties for CheckboxAria.
 *
 * @template T - Value payload type extending Primitive
 */
export interface CheckboxProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Called with the committed state after each activation.
   */
  oninput?: AriaEventHandler<CheckboxEvent>;

  /**
   * Called with the committed state when the selection changes.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;
  /**
   * Whether the checkbox is in a checked state.
   */
  checked?: boolean;

  /**
   * Whether the checkbox is in a tri-state indeterminate/mixed condition.
   */
  indeterminate?: boolean;

  /**
   * Whether the checkbox is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Whether a checked state is required for form validation.
   */
  required?: boolean;

  /**
   * Invalid indicator compiled to aria-invalid.
   */
  invalid?: AriaInvalid;

  /**
   * Semantic identity key or field name on the parent group or form.
   */
  name?: string;

  /**
   * Value payload for collection membership or form submission.
   */
  value?: T;
}

/**
 * Configuration options for CheckboxAria.
 */
export interface CheckboxOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for Checkbox elements.
 *
 * @template E - Target Element type
 */
export interface CheckboxAttributes<E extends BaseElement = HTMLButtonElement | HTMLInputElement>
  extends SelectionAttributes<E> {
  role?: string;
  type?: string;
  checked?: boolean;
  indeterminate?: boolean;
  required?: boolean;
  'aria-checked'?: 'true' | 'false' | 'mixed';
  'aria-required'?: 'true' | 'false';
  'aria-invalid'?: 'true' | 'false' | 'grammar' | 'spelling';
}

/**
 * Headless WAI-ARIA Checkbox controller managing two-state and tri-state indeterminate selections,
 * keyboard accessibility polyfills, group coordination, and native HTML input synchronization.
 *
 * @template E - Target Element type (HTMLInputElement, HTMLButtonElement, or generic BaseElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class CheckboxAria<
  E extends BaseElement = HTMLButtonElement | HTMLInputElement,
  T extends CheckboxProps = CheckboxProps,
  A extends CheckboxAttributes<E> = CheckboxAttributes<E>,
  O extends CheckboxOptions = CheckboxOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'checkbox',
      key: 'checked',
      allowKeys: [' '],
    });

    this.omittedAttrs.push(
      'value',
      'name',
      'oninput',
      'onchange',
      'indeterminate',
      'required',
      'aria-checked',
      'aria-required',
      'aria-invalid'
    );
    this.update();
  }

  /**
   * Whether the checkbox is currently checked.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Whether the checkbox is in a tri-state indeterminate/mixed condition.
   */
  public get indeterminate(): boolean {
    return this.properties.indeterminate === true;
  }

  /**
   * Selects the checkbox, clearing any indeterminate condition
   * so click/Space activation always resolves into a definitive checked state.
   */
  public override select(): void {
    if (this.disabled) return;
    const was = this.checked;
    if (this.properties.indeterminate) this.properties.indeterminate = false;
    super.select();
    this.notifyInput(was);
  }

  /**
   * Deselects the checkbox, clearing any indeterminate condition
   * so click/Space activation always resolves into a definitive checked state.
   */
  public override deselect(): void {
    if (this.disabled || this.idempotent) return;
    const was = this.checked;
    if (this.properties.indeterminate) this.properties.indeterminate = false;
    super.deselect();
    this.notifyInput(was);
  }

  /**
   * Dispatches the input event for a real commit on a custom host. Native hosts
   * leave input to the browser, and mutations that commit nothing stay silent.
   */
  private notifyInput(was: boolean): void {
    if (this.isNative || this.checked === was) return;
    const host = this.element;
    if (host) {
      const event: CheckboxEvent = new CustomEvent('input', { bubbles: true, detail: this.checked });
      host.dispatchEvent(event);
      this.properties.oninput?.(event);
    }
  }

  /**
   * Toggles the checkbox, resolving a mixed condition toward checked instead of
   * inverting: activation from mixed always commits `checked: true`.
   */
  public override toggle(): void {
    if (this.disabled) return;
    if (this.properties.indeterminate) {
      this.select();
      return;
    }
    super.toggle();
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the checkbox.
   *
   * @returns Checkbox attributes dictionary
   */
  protected override createAttributes(): A {
    const isChecked = this.checked;
    const isIndeterminate = this.properties.indeterminate === true;
    const isRequired = this.properties.required === true;
    const invalidAttr = ariaInvalid(this.properties.invalid);

    if (this.isNative) {
      return Object.assign(super.createAttributes(), {
        type: 'checkbox',
        checked: isChecked,
        indeterminate: isIndeterminate,
        required: isRequired,
        'aria-invalid': invalidAttr,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'checkbox',
      'aria-checked': isIndeterminate ? 'mixed' : isChecked ? 'true' : 'false',
      'aria-required': ariaRequired(this.properties.required) ?? 'false',
      'aria-invalid': invalidAttr,
    }) as A;
  }
}
