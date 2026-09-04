import { $static, $symbol, type AnyType, createContext, effect, uIndex } from '@airlib/core';
import { Aria } from './core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from './types.js';

/**
 * Shared state coordinated by an enclosing selection group.
 */
export interface SelectionGroupProps extends AriaProps {
  /**
   * Deterministic identity and namespace of the group.
   */
  id?: string;

  /**
   * Active collection of selected values, single scalar value, or record of boolean flags.
   */
  value?: AnyType;

  /**
   * Whether all member items in the group are disabled.
   */
  disabled?: boolean;

  /**
   * Whether member items can be deselected back to an empty/undefined state.
   */
  toggle?: boolean;
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
   * Value payload for collection membership or group coordination (fallback for name).
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
   * WAI-ARIA role identifier used for deterministic ID namespacing.
   */
  role?: string;

  /**
   * Whether the item can be toggled off back to an unselected state.
   */
  toggle?: boolean;

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

    this.omittedAttrs.push('id', 'disabled', 'tabindex', 'aria-disabled');

    if (this.group) {
      if (!this.isToggle) {
        $static(() => {
          if (!('value' in this.group!) || this.props.selected) {
            this.group!.value = this.key;
          }
        });
      }

      effect(() => {
        if (!this.group) return;

        const key = this.key;

        if (this.group.value === undefined) {
          this.stateProps[this.stateKey] = false;
          return;
        }

        if (Array.isArray(this.group.value)) {
          this.stateProps[this.stateKey] = key !== undefined && this.group.value.includes(key);
          return;
        }

        if (typeof this.group.value === 'object' && this.group.value !== null) {
          if (this.groupKey) {
            const target = this.group.value[this.groupKey];
            this.stateProps[this.stateKey] = Array.isArray(target)
              ? target.includes(this.props.value)
              : target === this.props.value;
            return;
          }

          if (this.props.name) {
            this.stateProps[this.stateKey] = !!this.group.value[this.props.name];
            return;
          }
        }

        this.stateProps[this.stateKey] = this.group.value === key;
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

  public set disabled(value: boolean) {
    this.props.disabled = value;
  }

  /**
   * Semantic identity key resolved with fallbacks: name -> value -> id.
   */
  public get key(): string {
    return this.props.name ?? this.props.value ?? this.props.id ?? this.id;
  }

  /**
   * Semantic identity key or field name on the parent group.
   */
  public get name(): string | undefined {
    return this.props.name;
  }

  public set name(name: string | undefined) {
    this.props.name = name;
  }

  /**
   * Value payload for group collection membership or form submission.
   */
  public get value(): AnyType {
    return this.props.value;
  }

  public set value(value: AnyType) {
    this.props.value = value;
  }

  /**
   * Whether the item can be toggled between selected and unselected.
   */
  public get isToggle(): boolean {
    if (this.group) {
      if (Array.isArray(this.group.value)) return true;
      if (typeof this.group.value === 'object' && this.group.value !== null) {
        if (this.groupKey && Array.isArray(this.group.value[this.groupKey])) return true;
        if (this.props.name) return true;
      }
    }
    return !!(this.options.toggle ?? this.group?.toggle);
  }

  /**
   * Selects this item.
   */
  public select(): void {
    if (this.disabled) return;

    if (this.group) {
      const key = this.key;

      if (this.group.value !== undefined) {
        if (Array.isArray(this.group.value)) {
          if (key !== undefined && !this.group.value.includes(key)) {
            this.group.value = [...this.group.value, key];
          }
          return;
        }

        if (typeof this.group.value === 'object' && this.group.value !== null) {
          if (this.groupKey) {
            const target = this.group.value[this.groupKey];
            if (Array.isArray(target)) {
              if (!target.includes(this.props.value)) {
                this.group.value[this.groupKey] = [...target, this.props.value];
              }
              return;
            }

            this.group.value[this.groupKey] = this.props.value;
            return;
          }

          if (this.props.name) {
            this.group.value[this.props.name] = true;
            return;
          }
        }

        this.group.value = key;
        return;
      }

      this.group.value = key;
      return;
    }

    this.stateProps[this.stateKey] = true;
  }

  /**
   * Deselects this item.
   */
  public deselect(): void {
    if (this.disabled) return;

    if (this.group) {
      const key = this.key;

      if (this.group.value !== undefined) {
        if (Array.isArray(this.group.value)) {
          if (this.group.value.includes(key)) {
            this.group.value = this.group.value.filter((val: unknown) => val !== key);
          }
          return;
        }

        if (typeof this.group.value === 'object' && this.group.value !== null) {
          if (this.groupKey) {
            const target = this.group.value[this.groupKey];
            if (Array.isArray(target)) {
              this.group.value[this.groupKey] = target.filter((val: unknown) => val !== this.props.value);
              return;
            }

            if (target === this.props.value) {
              this.group.value[this.groupKey] = undefined;
            }
            return;
          }

          if (this.props.name) {
            this.group.value[this.props.name] = false;
            return;
          }
        }

        if (this.group.value === key) {
          this.group.value = undefined;
        }
        return;
      }
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
   * Resolves the target property key on the group coordinator.
   */
  protected get groupKey(): string | undefined {
    if ('name' in this.props && 'value' in this.props) return this.props.name;
    if ('value' in this.props) return 'value';
    return undefined;
  }

  /**
   * Computes base selection attributes, lockout state, and keyboard event handlers.
   *
   * @returns Base selection attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const role = this.options.role ? `${this.options.role}-` : '';
    const id = this.props.id ?? (this.group?.id ? `${this.group.id}-${role}${this.key}` : `${role}${this.key}`);
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;

    const attrs: Record<string, unknown> = {
      id,
      tabindex: isDisabled ? -1 : 0,
      disabled: isDisabled,
      'aria-disabled': isDisabled ? 'true' : 'false',
      onclick: () => {
        if (this.disabled) return;
        if (this.isToggle) {
          this.toggle();
        } else {
          this.select();
        }
      },
      onkeydown: (e: KeyboardEvent) => {
        if (this.disabled || this.isNative) return;
        if (allowKeys.includes(e.key)) {
          e.preventDefault();
          if (e.key !== ' ') {
            (e.currentTarget as HTMLElement)?.click?.();
          }
        }
      },
      onkeyup: (e: KeyboardEvent) => {
        if (this.disabled || this.isNative) return;
        if (e.key === ' ' && allowKeys.includes(' ')) {
          (e.currentTarget as HTMLElement)?.click?.();
        }
      },
    };

    return attrs as A;
  }
}

const DEFAULT_ALLOW_KEYS = [' ', 'Enter'];
