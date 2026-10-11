import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

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
   * Validation failure flag.
   */
  invalid?: boolean;

  /**
   * Requirement flag.
   */
  required?: boolean;

  /**
   * Disabled flag inherited by controls.
   */
  disabled?: boolean;
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
  'aria-disabled'?: 'true' | 'false';
  'aria-required'?: 'true' | 'false';
  'aria-invalid'?: 'true';
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
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

const liveFields = new WeakSet<FieldAria>();

function liveField(field: FieldAria | undefined): FieldAria | undefined {
  return field && liveFields.has(field) ? field : undefined;
}

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
> extends Aria<E, T, A> {
  /**
   * Controls registered under this field, driving the grouping role.
   */
  protected controls = new Set<FieldControlAria>();

  /**
   * Labels registered under this field, driving custom-label association.
   */
  protected labels = new Set<FieldLabelAria>();

  public constructor(props: Partial<T> = {}, options: AriaOptions = {}) {
    super(props, options);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_FIELD}-${uIndex($symbol(ROLE_FIELD), true)}`;
    });

    liveFields.add(this as never);
    fieldCtx.set(this as unknown as FieldAria);
    this.omittedAttrs.push('id');
    this.update();
  }

  public override destroy(): void {
    liveFields.delete(this as never);
    super.destroy();
  }

  /**
   * Registers a control, recomputing the grouping role for the new count.
   */
  public registerControl(control: FieldControlAria): void {
    this.controls.add(control);
    this.update();
  }

  /**
   * Unregisters a destroyed control, recomputing the grouping role.
   */
  public unregisterControl(control: FieldControlAria): void {
    this.controls.delete(control);
    this.update();
  }

  /**
   * Registers a label for custom-label association discovery.
   */
  public registerLabel(label: FieldLabelAria): void {
    this.labels.add(label);
  }

  /**
   * First registered label, if any.
   */
  public get label(): FieldLabelAria | undefined {
    return this.labels.values().next().value;
  }

  /**
   * Whether user interaction is disabled across the entire field.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Whether the field currently fails validation.
   */
  public get invalid(): boolean {
    return !!this.properties.invalid;
  }

  /**
   * Whether the field is required.
   */
  public get required(): boolean {
    return !!this.properties.required;
  }

  /**
   * Computes HTML and ARIA attributes for the field container.
   */
  protected override createAttributes(): A {
    const attrs: Record<string, unknown> = {
      id: this.properties.id,
      role: !this.isNative && this.controls.size > 1 ? 'group' : undefined,
    };

    return attrs as A;
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
    liveField(this.field)?.registerLabel(this as unknown as FieldLabelAria);
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
    const field = liveField(this.field);
    const fieldId = field ? field.properties.id! : '';

    return {
      id: `${fieldId}-label`,
      for: field && this.isNative ? `${fieldId}-control` : undefined,
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

  /**
   * ARIA state keys announced at least once, kept explicit afterwards.
   */
  protected announced = new Set<string>();

  /**
   * Controls bind native inputs far more often than custom elements,
   * so native is the default unless explicitly declined.
   */
  public override get isNative(): boolean {
    return this.options.native ?? true;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    liveField(this.field)?.registerControl(this as unknown as FieldControlAria);
    this.omittedAttrs.push('id', 'aria-describedby', 'aria-labelledby');
    this.update();
  }

  public override destroy(): void {
    liveField(this.field)?.unregisterControl(this as unknown as FieldControlAria);
    super.destroy();
  }

  /**
   * Projects a custom-host ARIA state, omitted until first announced.
   */
  protected projectState(key: 'aria-disabled' | 'aria-required', value: boolean): 'true' | 'false' | undefined {
    if (value) {
      this.announced.add(key);
      return 'true';
    }

    return this.announced.has(key) ? 'false' : undefined;
  }

  /**
   * Computes HTML and ARIA attributes for the control element.
   */
  protected override createAttributes(): A {
    const field = liveField(this.field);
    if (!field) {
      return { ...this.attrs } as unknown as A;
    }

    const fieldId = field.properties.id!;
    const invalid = field.invalid;
    const describedby = invalid ? `${fieldId}-desc ${fieldId}-error` : `${fieldId}-desc`;
    const label = field.label;
    const labelledby = label && !label.isNative ? `${fieldId}-label` : undefined;

    if (this.isNative) {
      return {
        id: `${fieldId}-control`,
        disabled: field.disabled,
        required: field.required,
        'aria-invalid': invalid ? 'true' : undefined,
        'aria-describedby': describedby,
        'aria-labelledby': labelledby,
      } as A;
    }

    return {
      id: `${fieldId}-control`,
      'aria-disabled': this.projectState('aria-disabled', field.disabled),
      'aria-required': this.projectState('aria-required', field.required),
      'aria-invalid': invalid ? 'true' : undefined,
      'aria-describedby': describedby,
      'aria-labelledby': labelledby,
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
    const field = liveField(this.field);
    const fieldId = field ? field.properties.id! : '';

    return {
      id: `${fieldId}-desc`,
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

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id');
    this.update();
  }

  /**
   * Computes HTML and ARIA attributes for the error element.
   */
  protected override createAttributes(): A {
    const field = liveField(this.field);
    const fieldId = field ? field.properties.id! : '';

    return {
      id: `${fieldId}-error`,
      'aria-live': 'polite',
    } as A;
  }
}
