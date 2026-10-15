import { $static } from '@airlib/core';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaInvalid,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
} from '../types.js';
import { ariaBoolean, ariaInvalid, ariaRequired } from '../utils/attributes.js';

/**
 * Controller-dispatched text-input event carrying the committed text in `detail`.
 */
export type TextInputEvent = AriaEvent<string>;

/**
 * Controller-dispatched search-input event carrying the committed query in `detail`.
 */
export type SearchInputEvent = AriaEvent<string>;

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
 * Text input kind selecting the custom-host role and native type behavior.
 */
export type TextInputKind = 'text' | 'password' | 'search' | 'email' | 'tel' | 'url';

/**
 * Reactive inputs for TextInputAria.
 */
export interface TextInputProps extends AriaProps {
  /**
   * Called with the committed text when the value commits.
   */
  onchange?: AriaEventHandler<TextInputEvent>;
  /**
   * Live text value.
   */
  value?: string;

  /**
   * Text input kind selecting the searchbox role on custom hosts.
   */
  kind?: TextInputKind;

  /**
   * Multiline flag compiled to aria-multiline on custom hosts.
   */
  multiline?: boolean;

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
  private lastCommitted: string | null = null;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, { native: true, ...options } as O);
    if (!this.options.role) (this.options as O).role = 'text-input' as O['role'];
    this.omittedAttrs.push(
      'onchange',
      'value',
      'defaultValue',
      'kind',
      'multiline',
      'label',
      'type',
      'role',
      'tabindex',
      'readonly',
      'required',
      'aria-required',
      'aria-readonly',
      'aria-disabled',
      'aria-multiline',
      'aria-invalid'
    );
    $static(() => {
      this.lastCommitted = this.properties.value ?? '';
    });
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
    return this.properties.value ?? '';
  }

  public set value(next: string) {
    this.properties.value = next;
  }

  /**
   * Whether the input is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the text-input.
   *
   * @returns Text-input attributes dictionary
   */
  protected override createAttributes(): A {
    const { value, readonly, disabled, required, placeholder, label, invalid } = this.properties;
    const type = this.options.role === 'search-input' || this.properties.kind === 'search' ? 'search' : undefined;
    const attrs: Record<string, unknown> = {
      value: value ?? '',
      oninput: this.handleInput,
      readonly: !!readonly,
      disabled: !!disabled,
      required: !!required,
      placeholder,
      'aria-label': label,
      'aria-invalid': ariaInvalid(invalid) ?? 'false',
    };

    if (this.isNative) {
      if (type !== undefined) {
        attrs.type = type;
      }
      if (this.options.role === 'search-input') {
        attrs['aria-required'] = ariaRequired(required) ?? 'false';
      }
      return Object.assign(super.createAttributes(), attrs) as A;
    }

    return Object.assign(super.createAttributes(), attrs, {
      role: this.properties.kind === 'search' || this.options.role === 'search-input' ? 'searchbox' : 'textbox',
      tabindex: disabled ? -1 : 0,
      ...(this.properties.multiline ? { 'aria-multiline': 'true' as const } : {}),
      'aria-readonly': ariaBoolean(readonly),
      'aria-disabled': ariaBoolean(disabled),
      'aria-required': ariaRequired(required) ?? 'false',
    }) as A;
  }

  protected override attach(): DetachFn | void {
    const host = this.element;
    /* istanbul ignore next: attach only runs post-assignment with a live element */
    if (!host) return;

    const commit = (): void => {
      const current = this.value;
      if (current === this.lastCommitted) return;
      this.lastCommitted = current;
      if (this.disabled) return;
      const event: TextInputEvent = new CustomEvent('change', { bubbles: true, detail: current });
      if (!this.isNative) host.dispatchEvent(event);
      this.properties.onchange?.(event);
    };

    const signal = this.isNative ? 'change' : 'blur';
    host.addEventListener(signal, commit);

    return () => host.removeEventListener(signal, commit);
  }

  private readonly handleInput = (e: Event): void => {
    if (this.disabled || this.properties.readonly) return;
    this.properties.value = (e.currentTarget as HTMLInputElement).value;
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
