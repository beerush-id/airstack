import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Reactive input properties for ButtonAria.
 */
export interface ButtonProps extends AriaProps {
  /**
   * HTML button behavior type (defaults to 'button' to avoid accidental form submission).
   */
  type?: 'button' | 'submit' | 'reset';

  /**
   * Whether the button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for ButtonAria.
 */
export interface ButtonOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a button element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface ButtonAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  role?: 'button';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA button controller that compiles native button type/disabled attributes
 * or polyfills non-native elements with ARIA semantics and Space/Enter keyboard activation.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends ButtonProps = ButtonProps,
  A extends ButtonAttributes<E> = ButtonAttributes<E>,
  O extends ButtonOptions = ButtonOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.update();
  }

  /**
   * The button's functional behavior type.
   */
  public get type(): 'button' | 'submit' | 'reset' {
    return this.props.type ?? 'button';
  }

  /**
   * Whether the button is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the button.
   *
   * @returns Button attributes dictionary
   */
  protected override createAttributes(): A {
    const base = super.createAttributes();

    if (this.isNative) {
      return Object.assign(base, {
        type: this.type,
        disabled: this.disabled,
      }) as A;
    }

    const isDisabled = this.disabled;

    return Object.assign(base, {
      role: 'button',
      tabindex: isDisabled ? -1 : 0,
      'aria-disabled': isDisabled ? 'true' : 'false',
      onclick: (e?: MouseEvent) => {
        if (isDisabled) return;
        if (e?.defaultPrevented) return;

        if (this.type === 'submit') {
          (this.element?.closest('form') as HTMLFormElement | null)?.requestSubmit();
        } else if (this.type === 'reset') {
          (this.element?.closest('form') as HTMLFormElement | null)?.reset();
        }
      },
      onkeydown: (e: KeyboardEvent) => {
        if (isDisabled) return;
        if (e.defaultPrevented) return;

        if (e.key === ' ') {
          e.preventDefault();
        } else if (e.key === 'Enter') {
          (e.currentTarget as HTMLElement)?.click?.();
        }
      },
      onkeyup: (e: KeyboardEvent) => {
        if (isDisabled) return;

        if (e.key === ' ') {
          (e.currentTarget as HTMLElement)?.click?.();
        }
      },
    }) as A;
  }
}
