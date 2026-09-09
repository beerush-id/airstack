import { Aria } from '../core.js';
import type { AriaAttributes, AriaInvalid, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaInvalid } from '../utils/attributes.js';

/**
 * Configuration options for TextboxAria.
 */
export interface TextboxOptions extends AriaOptions {
  /**
   * Mid-layer face flag set by the public Textbox/Searchbox overloads, never JSX.
   * @default 'textbox'
   */
  role?: 'textbox' | 'searchbox';
}

/**
 * Reactive inputs for TextboxAria.
 */
export interface TextboxProps extends AriaProps {
  /**
   * Live text value.
   */
  value?: string;

  /**
   * Readonly indicator.
   */
  readonly?: boolean;

  /**
   * Whether the input is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Required validation indicator.
   */
  required?: boolean;

  /**
   * Invalid indicator.
   */
  invalid?: AriaInvalid;

  /**
   * Placeholder hint.
   */
  placeholder?: string;

  /**
   * Accessible label compiled to aria-label.
   */
  label?: string;
}

/**
 * Compiled HTML and ARIA attributes for textbox elements.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface TextboxAttributes<E extends BaseElement = HTMLInputElement> extends AriaAttributes<E> {
  value?: string;
  defaultValue?: string;
  type?: 'text' | 'search';
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  'aria-invalid'?: 'true' | 'false' | 'grammar' | 'spelling';
}

/**
 * Configuration options for SearchboxAria.
 */
export interface SearchboxOptions extends AriaOptions {}

/**
 * Reactive inputs for SearchboxAria.
 */
export interface SearchboxProps extends TextboxProps {}

/**
 * Compiled HTML and ARIA attributes for searchbox elements.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface SearchboxAttributes<E extends BaseElement = HTMLInputElement> extends TextboxAttributes<E> {
  type?: 'search';
}

/**
 * Headless native-only text input controller owning live value synchronization.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class TextboxAria<
  E extends BaseElement = HTMLInputElement,
  T extends TextboxProps = TextboxProps,
  A extends TextboxAttributes<E> = TextboxAttributes<E>,
  O extends TextboxOptions = TextboxOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, { ...options, native: true } as O);
    if (!this.options.role) (this.options as O).role = 'textbox' as O['role'];
    this.omittedAttrs.push('value', 'defaultValue', 'readonly', 'required', 'aria-required', 'aria-invalid');
    this.update();
  }

  public override get attributes(): Record<string, unknown> {
    const { value, ...rest } = super.attributes as Record<string, unknown>;
    return { ...rest, defaultValue: value };
  }

  /**
   * Live text value.
   */
  public get value(): string {
    return this.props.value ?? '';
  }

  public set value(next: string) {
    this.props.value = next;
  }

  /**
   * Whether the input is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the textbox.
   *
   * @returns Textbox attributes dictionary
   */
  protected override createAttributes(): A {
    const { value, readonly, disabled, required, placeholder, label, invalid } = this.props;
    return Object.assign(super.createAttributes(), {
      value: value ?? '',
      oninput: this.handleInput,
      readonly: !!readonly,
      disabled: !!disabled,
      required: !!required,
      placeholder,
      'aria-label': label,
      type: this.options.role === 'searchbox' ? 'search' : undefined,
      'aria-invalid': ariaInvalid(invalid) ?? 'false',
    }) as A;
  }

  private readonly handleInput = (e: Event): void => {
    if (this.disabled) return;
    this.props.value = (e.currentTarget as HTMLInputElement).value;
  };
}

/**
 * Headless native-only search input controller owning live query synchronization.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class SearchboxAria<
  E extends BaseElement = HTMLInputElement,
  T extends SearchboxProps = SearchboxProps,
  A extends SearchboxAttributes<E> = SearchboxAttributes<E>,
  O extends SearchboxOptions = SearchboxOptions,
> extends TextboxAria<E, T, A, O> {
  public constructor(props?: Partial<T>, options?: Partial<O>) {
    super(props, { ...options, role: 'searchbox' } as unknown as O);
  }
}
