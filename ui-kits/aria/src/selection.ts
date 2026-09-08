import { $static, $symbol, type AnyType, createContext, effect, uIndex } from '@airlib/core';
import { Aria } from './core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn, Orientation } from './types.js';
import { bindLabel } from './utils/label.js';

/**
 * Shared state coordinated by an enclosing selection group.
 */
export interface SelectionGroupProps extends AriaProps {
  /**
   * Deterministic identity and namespace of the group.
   */
  id?: string;

  /**
   * Current active selection value (scalar for single-select, array for multiple).
   */
  value?: AnyType;

  /**
   * Whether multiple items may be selected simultaneously.
   */
  multiple?: boolean;

  /**
   * Whether a non-empty selection is required.
   */
  required?: boolean;

  /**
   * Whether all member items in the group are disabled.
   */
  disabled?: boolean;

  /**
   * Keyboard navigation axis and aria-orientation.
   */
  orientation?: Orientation;

  /**
   * Whether moving focus selects automatically or requires manual activation.
   */
  manual?: boolean;
}

/**
 * Ambient context for coordinated selection groups (button groups, checkbox groups, etc.).
 */
export const selectionGroup = createContext<SelectionGroupProps>();

/**
 * Reactive input properties for SelectionAria.
 */
export interface SelectionProps extends AriaProps {
  /**
   * Explicit DOM element identifier.
   */
  id?: string;

  /**
   * Semantic identity key of the item within the group.
   */
  name?: string;

  /**
   * Whether the item is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Value payload for collection membership or group coordination.
   */
  value?: AnyType;
}

/**
 * Configuration options for SelectionAria.
 */
export interface SelectionOptions extends AriaOptions {
  /**
   * Property name on props that holds the selection state (e.g. 'checked', 'pressed', 'selected').
   * @default 'selected'
   */
  key?: string;

  /**
   * Property name on props that holds the identity/value token ('value' | 'name').
   * @default 'value'
   */
  valueKey?: 'value' | 'name';

  /**
   * WAI-ARIA role identifier used for deterministic ID namespacing.
   */
  role?: string;

  /**
   * Whether selection is idempotent (cannot be toggled off once active).
   */
  idempotent?: boolean;

  /**
   * Keyboard keys that trigger selection activation on non-native elements.
   * @default [' ', 'Enter']
   */
  allowKeys?: string[];
}

/**
 * Compiled HTML and ARIA attributes for selectable items.
 *
 * @template E - Target Element type
 */
export interface SelectionAttributes<E extends BaseElement = BaseElement> extends AriaAttributes<E> {
  id?: string;
  disabled?: boolean;
  tabindex?: number;
}

/**
 * Abstract WAI-ARIA controller managing single and multi-selection, ambient group coordination,
 * cascaded lockout, and non-native Space key activation.
 *
 * Serves as the shared foundation for Button, Checkbox, Switch, Radio, Tab, and MenuItem widgets.
 *
 * @template E - Target Element type
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export abstract class SelectionAria<
  E extends BaseElement = BaseElement,
  T extends SelectionProps = SelectionProps,
  A extends SelectionAttributes<E> = SelectionAttributes<E>,
  O extends SelectionOptions = SelectionOptions,
> extends Aria<E, T, A, O> {
  /**
   * Unique controller instance identifier generated at instantiation.
   */
  public id: string;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    const role = this.options.role ?? 'item';
    this.id = `${role}-${uIndex($symbol(role), true)}`;

    this.omittedAttrs.push('id', 'disabled', this.stateKey);
    if (!this.isNative) {
      this.omittedAttrs.push('tabindex', 'aria-disabled');
    }

    if (this.group) {
      $static(() => {
        if (this.group!.multiple) {
          if (!Array.isArray(this.group!.value)) {
            console.warn(`[ARIA] Multi-select group initialized with non-array value.`);
            this.group!.value = [];
          }

          if (this.props.selected && !this.group!.value.includes(this.value)) {
            this.group!.value.push(this.value);
          }
        } else if (
          (this.idempotent && (!('value' in this.group!) || this.props.selected)) ||
          (!('value' in this.group!) && this.props.selected)
        ) {
          // Claims initial selection when uncontrolled: required groups claim
          // via idempotency, while an explicit `selected` hint claims regardless.
          this.group!.value = this.value;
        }
      });

      effect(() => {
        if (!this.group) return;
        const value = this.value;

        if (this.group.multiple) {
          this.stateProps[this.stateKey] = this.group.value.includes(value);
          return;
        }

        this.stateProps[this.stateKey] = this.group.value === value;
      });
    }
  }

  /**
   * Target state property key on props.
   */
  protected get stateKey(): string {
    return this.options.key ?? 'selected';
  }

  /**
   * Property name on props that holds the identity/value token ('value' | 'name').
   */
  protected get valueKey(): 'value' | 'name' {
    return this.options.valueKey ?? 'value';
  }

  /**
   * Non-generic props reference to permit index-writing.
   */
  protected get stateProps(): AriaProps {
    return this.props;
  }

  /**
   * Whether the item is currently selected, pressed, or checked.
   */
  protected get selected(): boolean {
    return !!this.props[this.stateKey];
  }

  protected set selected(value: boolean | undefined) {
    if (this.disabled) return;

    if (value) {
      this.select();
    } else {
      this.deselect();
    }
  }

  /**
   * Whether the item is disabled from user interaction,
   * factoring in group-level disablement.
   */
  public get disabled(): boolean {
    return !!(this.props.disabled ?? this.group?.disabled);
  }

  /**
   * Selection value resolved from the declared valueKey.
   */
  public get value(): AnyType {
    return this.props[this.valueKey];
  }

  /**
   * Whether selection is idempotent (cannot be toggled off once active).
   */
  protected get idempotent(): boolean {
    if (this.options.idempotent !== undefined) return this.options.idempotent;

    if (this.group) {
      if (this.group.multiple) return false;
      return !!this.group.required;
    }

    return false;
  }

  /**
   * Selects this item.
   */
  public select(): void {
    if (this.disabled) return;

    if (this.group) {
      const value = this.value;

      if (this.group.multiple) {
        if (!this.group.value.includes(value)) {
          this.group.value.push(value);
        }
        return;
      }

      this.group.value = value;
      return;
    }

    this.stateProps[this.stateKey] = true;
  }

  /**
   * Deselects this item.
   */
  public deselect(): void {
    if (this.disabled || this.idempotent) return;

    if (this.group) {
      const value = this.value;

      if (this.group.multiple) {
        const index = this.group.value.indexOf(value);
        if (index !== -1) {
          this.group.value.splice(index, 1);
        }
        return;
      }

      if (this.group.value === value) {
        delete this.group.value;
      }
      return;
    }

    this.stateProps[this.stateKey] = false;
  }

  /**
   * Toggles this item between selected and deselected.
   */
  public toggle(): void {
    if (this.disabled) return;

    if (this.selected) {
      this.deselect();
    } else {
      this.select();
    }
  }

  /**
   * Ambient selection group coordinator discovered from component hierarchy.
   */
  protected group = selectionGroup.get();

  /**
   * Computes base selection attributes, lockout state, and keyboard event handlers.
   *
   * @returns Base selection attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const role = this.options.role ? `${this.options.role}-` : '';
    const token = typeof this.value === 'string' ? this.value : this.id;
    const id = this.props.id ?? (this.group?.id ? `${this.group.id}-${role}${token}` : this.id);
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;

    const attrs: Record<string, unknown> = {
      id,
      disabled: this.isNative ? isDisabled : undefined,
      onclick: () => {
        if (isDisabled) return;
        this.toggle();
      },
    };

    if (!this.isNative) {
      Object.assign(attrs, {
        tabindex: isDisabled ? -1 : 0,
        'aria-disabled': isDisabled ? 'true' : 'false',
        onkeydown: (e: KeyboardEvent) => {
          if (isDisabled || !allowKeys.includes(e.key)) return;

          if (e.key === ' ') {
            e.preventDefault();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLElement)?.click?.();
          }
        },
        onkeyup: (e: KeyboardEvent) => {
          if (isDisabled || !allowKeys.includes(e.key)) return;

          if (e.key === ' ') {
            (e.currentTarget as HTMLElement)?.click?.();
          }
        },
      });
    }

    return attrs as A;
  }

  /**
   * Polyfills enclosing `<label>` click activation for non-native selection widgets.
   *
   * @returns Teardown callback to unbind the label listener, or void if native or unbound
   */
  protected override attach(): DetachFn | void {
    if (!this.isNative) {
      return bindLabel(this.element!);
    }
  }
}

const DEFAULT_ALLOW_KEYS = [' ', 'Enter'];
