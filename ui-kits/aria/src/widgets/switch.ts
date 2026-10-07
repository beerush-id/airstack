import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement, Primitive } from '../types.js';

/**
 * Controller-dispatched switch event carrying the committed state in `detail`.
 */
export type SwitchEvent = AriaEvent<boolean>;

/**
 * Configuration options for SwitchAria.
 */
export interface SwitchOptions extends AriaOptions {
  /**
   * Whether bound to a native <button> host.
   * @default false
   */
  native?: boolean;
}

/**
 * Reactive inputs for SwitchAria.
 *
 * @template T - Candidate value type when nested in a selection group
 */
export interface SwitchProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Called with the committed state after each activation.
   */
  oninput?: AriaEventHandler<SwitchEvent>;

  /**
   * Called with the committed state when the selection changes.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;
  /**
   * Choice candidate value if nested in a selection group.
   */
  value?: T;

  /**
   * Semantic identity key or field name on the parent settings group.
   */
  name?: string;

  /**
   * Whether the switch is currently toggled on.
   */
  checked?: boolean;

  /**
   * Whether the switch is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a switch element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SwitchAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'switch';
  'aria-checked'?: 'true' | 'false';
}

/**
 * Universal WAI-ARIA switch controller managing binary on/off states and keyboard toggles.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Controller options type
 */
export class SwitchAria<
  E extends BaseElement = HTMLElement,
  T extends SwitchProps = SwitchProps,
  A extends SwitchAttributes<E> = SwitchAttributes<E>,
  O extends SwitchOptions = SwitchOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
      role: 'switch',
      key: 'checked',
    });

    this.omittedAttrs.push('value', 'name', 'oninput', 'onchange', 'aria-checked');
    this.update();
  }

  /**
   * Whether the switch is currently toggled on.
   */
  public get checked(): boolean {
    return this.selected;
  }

  public set checked(value: boolean) {
    this.selected = value;
  }

  /**
   * Selects the switch, announcing the commit to custom hosts.
   */
  public override select(): void {
    if (this.disabled) return;
    const was = this.checked;
    super.select();
    this.notifyInput(was);
  }

  /**
   * Deselects the switch, announcing the commit to custom hosts.
   */
  public override deselect(): void {
    if (this.disabled || this.idempotent) return;
    const was = this.checked;
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
      const event: SwitchEvent = new CustomEvent('input', { bubbles: true, detail: this.checked });
      host.dispatchEvent(event);
      this.properties.oninput?.(event);
    }
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the switch.
   *
   * @returns Switch attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: 'switch',
      'aria-checked': this.checked ? 'true' : 'false',
    }) as A;
  }
}
