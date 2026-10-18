import { $static, $symbol, type AnyType, createContext, effect, uIndex } from '@airlib/core';
import { Aria } from './core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
  Orientation,
} from './types.js';
import { bindLabel } from './utils/label.js';

/**
 * Capability-dispatched selection event carrying the committed state in `detail`.
 */
export type SelectionEvent = AriaEvent<boolean>;

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
   * Called with the committed state after the selection changes.
   */
  onchange?: AriaEventHandler<SelectionEvent>;
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

  /**
   * Whether the selection change should be deferred to keyup event.
   * @default false
   */
  deferredKey?: boolean;

  /**
   * Whether the item is enforced to be required to be selected.
   */
  required?: boolean;
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

  protected get required() {
    return this.options.required ?? this.group?.required ?? false;
  }

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, { clickable: options?.allowKeys ?? DEFAULT_ALLOW_KEYS, ...options });

    const role = this.options.role ?? 'item';
    this.id = `${role}-${uIndex($symbol(role), true)}`;

    this.omittedAttrs.push('id', 'disabled', 'onchange', this.stateKey);
    if (!this.isNative) {
      this.omittedAttrs.push('tabindex', 'aria-disabled');
    }

    if (this.group) {
      $static(() => {
        if (!this.coordinated) return;
        if (this.group!.multiple) {
          if (!Array.isArray(this.group!.value)) {
            console.warn(`[ARIA] Multi-select group initialized with non-array value.`);
            this.group!.value = [];
          }

          if (this.properties.selected && !this.group!.value.includes(this.value)) {
            this.group!.value.push(this.value);
          }
        } else if (this.properties.selected) {
          this.group!.value = this.value;
        } else if (this.group!.value === undefined && this.idempotent && this.required) {
          this.group!.value = this.value;
        }
      });

      effect(() => {
        const group = this.group;
        if (!group || !this.coordinated) return;
        const value = this.value;

        if (group.multiple) {
          this.stateProps[this.stateKey] = group.value.includes(value);
          return;
        }

        this.stateProps[this.stateKey] = group.value === value;
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
    return this.properties;
  }

  /**
   * Whether the item is currently selected, pressed, or checked.
   */
  protected get selected(): boolean {
    return !!this.properties[this.stateKey];
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
    return !!(this.properties.disabled ?? this.group?.disabled);
  }

  /**
   * Selection value resolved from the declared valueKey.
   */
  public get value(): AnyType {
    return this.properties[this.valueKey];
  }

  /**
   * Whether selection is idempotent (cannot be toggled off once active).
   */
  protected get idempotent(): boolean {
    if (this.options.idempotent !== undefined) return this.options.idempotent;
    if (this.required) return true;
    if (this.group?.multiple) return false;

    return false;
  }

  /**
   * Selects this item.
   */
  public select(): void {
    if (this.disabled) return;
    const was = this.selected;

    const group = this.group;
    if (this.coordinated && group) {
      const value = this.value;

      if (group.multiple) {
        if (!group.value.includes(value)) {
          group.value.push(value);
        }
      } else {
        group.value = value;
      }
    } else {
      this.stateProps[this.stateKey] = true;
    }

    this.notifyChange(was);
  }

  /**
   * Deselects this item.
   */
  public deselect(): void {
    if (this.disabled || this.idempotent) return;
    const was = this.selected;

    const group = this.group;
    if (this.coordinated && group) {
      const value = this.value;

      if (group.multiple) {
        const index = group.value.indexOf(value);
        if (index !== -1) {
          group.value.splice(index, 1);
        }
      } else if (group.value === value) {
        delete group.value;
      }
    } else {
      this.stateProps[this.stateKey] = false;
    }

    this.notifyChange(was);
  }

  private notifyChange(was: boolean): void {
    if (this.selected === was || !this.element) return;

    const detail = this.group ? this.group.value : this.selected;
    const event: SelectionEvent = new CustomEvent('change', {
      detail,
      bubbles: true,
    });

    this.dispatchChange(detail);
    this.element.dispatchEvent(event);
    this.dispatch(event);
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
   * Whether this member coordinates selection through the ambient group.
   * Only a member declaring a candidate value coordinates: a value-less member
   * behaves standalone for state (still inheriting the group's disabled cascade)
   * so it can never claim, adopt, or clear the shared slot.
   */
  protected get coordinated(): boolean {
    if (!this.group) return false;
    return this.value !== undefined;
  }

  /**
   * Computes base selection attributes, lockout state, and keyboard event handlers.
   *
   * @returns Base selection attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const role = this.options.role ? `${this.options.role}-` : '';
    const token = typeof this.value === 'string' ? this.value : this.id;
    const id = this.properties.id ?? (this.group?.id ? `${this.group.id}-${role}${token}` : this.id);

    const attrs: Record<string, unknown> = {
      id: !this.group ? this.properties.id : id,
      disabled: this.isNative ? isDisabled : undefined,
      onclick: this.handleClick,
    };

    if (!this.isNative) {
      Object.assign(attrs, {
        tabindex: isDisabled ? -1 : 0,
        'aria-disabled': isDisabled ? 'true' : 'false',
        onkeyup: this.handleKeyUp,
        onkeydown: this.handleKeyDown,
      });
    }

    return attrs as A;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    this.toggle();
  };

  private spaceArmed = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;
    if (this.disabled || event.defaultPrevented || !allowKeys.includes(event.key)) return;

    if (event.key === ' ') {
      event.preventDefault();
      this.spaceArmed = true;
    } else if (!this.options.deferredKey && event.key === 'Enter') {
      this.dispatchClick();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;
    const armed = this.spaceArmed;
    this.spaceArmed = false;
    if (this.disabled || event.defaultPrevented || !allowKeys.includes(event.key)) return;

    if (event.key === ' ' && armed) {
      this.dispatchClick();
    } else if (this.options.deferredKey && event.key === 'Enter') {
      this.dispatchClick();
    }
  };

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
