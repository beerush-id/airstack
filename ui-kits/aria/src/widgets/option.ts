import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../selection.js';
import type { AriaEvent, AriaEventHandler, AriaProps, BaseElement, Primitive } from '../types.js';

/**
 * Reactive input properties for an individual Option widget.
 *
 * @template T - Candidate value type
 */
export interface OptionProps<T extends Primitive = Primitive> extends AriaProps {
  /**
   * Called with the committed state when the selection changes.
   */
  onchange?: AriaEventHandler<AriaEvent<boolean>>;
  /**
   * Choice candidate value matching select active value.
   */
  value: T;

  /**
   * Initial or controlled selection state.
   */
  selected?: boolean;

  /**
   * Whether this individual option is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Controller configuration options for OptionAria.
 */
export interface OptionOptions extends SelectionOptions {
  /**
   * Whether bound to native <option>.
   * @default false
   */
  native?: boolean;

  /**
   * Whether pointer activation inverts a standalone selection.
   * Without opt-in, standalone activation is select-only; grouped members
   * always follow group rules regardless of this flag.
   * @default false
   */
  toggle?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for an option element.
 *
 * @template E - Target Element type
 */
export interface OptionAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'option';
  tabindex?: number;
  'aria-selected'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}

const ROLE_OPTION = 'option';

/**
 * Headless WAI-ARIA Option item used in select and combobox popups.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class OptionAria<
  E extends BaseElement = HTMLElement,
  T extends OptionProps = OptionProps,
  A extends OptionAttributes<E> = OptionAttributes<E>,
  O extends OptionOptions = OptionOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  /**
   * Standalone inversion opt-in snapshotted from engine options at construction.
   */
  private readonly standaloneToggle: boolean;

  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props, { native: false, ...options, role: ROLE_OPTION, allowKeys: [] });
    this.standaloneToggle = !!options.toggle;
    this.omittedAttrs.push('value', 'onchange', 'aria-selected');
    this.update();
  }

  /**
   * Whether this option is selected within its group.
   */
  public override get selected(): boolean {
    return super.selected;
  }

  /**
   * Selects or deselects this option through the group's coordination rules.
   */
  public override set selected(value: boolean) {
    super.selected = value;
  }

  /**
   * Toggles this option. Grouped members always follow group rules; standalone
   * members invert only with the toggle opt-in, otherwise activation selects.
   */
  public override toggle(): void {
    if (this.disabled) return;
    if (!this.group && !this.standaloneToggle && this.selected) {
      return;
    }
    super.toggle();
  }

  /**
   * Computes HTML and ARIA attributes for the option.
   */
  protected override createAttributes(): A {
    const attrs = super.createAttributes();
    const isDisabled = this.disabled;
    const isSelected = this.selected;

    if (this.isNative) {
      return Object.assign(attrs, {
        selected: isSelected,
      }) as A;
    }

    return Object.assign(attrs, {
      role: ROLE_OPTION,
      tabindex: isDisabled ? -1 : isSelected ? 0 : -1,
      'aria-selected': isSelected ? 'true' : 'false',
    }) as A;
  }
}
