import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaOptions, AriaProps, BaseElement, Primitive } from '../types.js';

/**
 * Configuration options for ToggleAria.
 */
export interface ToggleOptions extends AriaOptions {
  /**
   * Whether bound to a native HTML button element.
   * @default true
   */
  native?: boolean;
}

/**
 * Reactive input properties for ToggleAria.
 *
 * @template T - Member value type when in a group
 */
export interface ToggleProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Member value token when nested inside a toggle group.
   */
  value?: T;

  /**
   * Explicit toggle pressed state when standalone.
   */
  pressed?: boolean;

  /**
   * Whether the toggle button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a toggle button element.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface ToggleAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role?: 'button';
  type?: 'button';
  'aria-pressed'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA Toggle controller managing two-state pressed selections,
 * toggle group coordination, and native button equivalence.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class ToggleAria<
  E extends BaseElement = HTMLButtonElement,
  T extends ToggleProps = ToggleProps,
  A extends ToggleAttributes<E> = ToggleAttributes<E>,
  O extends ToggleOptions = ToggleOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
      role: 'button',
      key: 'pressed',
    });

    this.omittedAttrs.push('value');
    this.update();
  }

  /**
   * Whether the toggle button is currently pressed.
   */
  public get pressed(): boolean {
    return this.selected;
  }

  public set pressed(value: boolean) {
    this.selected = value;
  }

  /**
   * Computes HTML and ARIA attributes for the toggle button.
   */
  protected override createAttributes(): A {
    const isPressed = this.pressed;
    const attrs = Object.assign(super.createAttributes(), {
      'aria-pressed': isPressed ? 'true' : 'false',
    });

    if (this.isNative) {
      attrs.type = 'button';
    } else {
      attrs.role = 'button';
    }

    return attrs as A;
  }
}
