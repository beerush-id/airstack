import { Aria } from '../core.js';
import type { AriaAttributes, AriaInvalid, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaInvalid } from '../utils/attributes.js';

/**
 * Configuration options for TextInputAria.
 */
export interface TextInputOptions extends AriaOptions {
  /**
   * Mid-layer face flag set by the public TextInput/SearchInput overloads, never JSX.
   * @default 'text-input'
   */
  role?: 'text-input' | 'search-input';
}

/**
 * Reactive inputs for TextInputAria.
 */
export interface TextInputProps extends AriaProps {
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
 * Compiled HTML and ARIA attributes for text-input elements.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface TextInputAttributes<E extends BaseElement = HTMLInputElement> extends AriaAttributes<E> {
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
 * Configuration options for SearchInputAria.
 */
export interface SearchInputOptions extends AriaOptions {}

/**
 * Reactive inputs for SearchInputAria.
 */
export interface SearchInputProps extends TextInputProps {}

/**
 * Compiled HTML and ARIA attributes for search-input elements.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface SearchInputAttributes<E extends BaseElement = HTMLInputElement> extends TextInputAttributes<E> {
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
export class TextInputAria<
  E extends BaseElement = HTMLInputElement,
  T extends TextInputProps = TextInputProps,
  A extends TextInputAttributes<E> = TextInputAttributes<E>,
  O extends TextInputOptions = TextInputOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, { ...options, native: true } as O);
    if (!this.options.role) (this.options as O).role = 'text-input' as O['role'];
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
   * Computes the HTML, ARIA, and event handler attributes for the text-input.
   *
   * @returns Text-input attributes dictionary
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
      type: this.options.role === 'search-input' ? 'search' : undefined,
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
export class SearchInputAria<
  E extends BaseElement = HTMLInputElement,
  T extends SearchInputProps = SearchInputProps,
  A extends SearchInputAttributes<E> = SearchInputAttributes<E>,
  O extends SearchInputOptions = SearchInputOptions,
> extends TextInputAria<E, T, A, O> {
  public constructor(props?: Partial<T>, options?: Partial<O>) {
    super(props, { ...options, role: 'search-input' } as unknown as O);
  }
}
