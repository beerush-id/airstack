import type { AriaEventHandler, AriaOptions, AriaProps, BaseElement, Primitive } from '../../types.js';
import { ButtonAria, type ButtonAttributes, type ButtonOptions } from '../../widgets/button.js';
import {
  CheckboxAria,
  type CheckboxAttributes,
  type CheckboxProps,
  RadioAria,
  type RadioAttributes,
  type RadioProps,
} from '../../widgets/index.js';
import { type MenuAria, type MenuCommandEvent, menuCtx } from './menu.js';

/**
 * Configuration options for menu item controllers.
 */
export interface MenuItemOptions extends AriaOptions {
  /**
   * Native `<button>` hosts activate on click alone; custom hosts get Space and Enter (default: true).
   */
  native?: boolean;
}

/**
 * Reactive input properties for the Menu command item.
 */
export interface MenuItemProps extends AriaProps {
  /**
   * Semantic identifier carried as the event detail.
   */
  name?: string;

  /**
   * Whether this item is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Item-level command listener invoked with the item's name.
   */
  oncommand?: AriaEventHandler<MenuCommandEvent>;
}

/**
 * Compiled HTML and ARIA attributes for a menu command item.
 *
 * @template E - Target Element type
 */
export interface MenuItemAttributes<E extends BaseElement = HTMLButtonElement> extends ButtonAttributes<E> {}

/**
 * Command action item compiling `role="menuitem"`.
 * Inherits action activation from the button controller; dispatches
 * `command` carrying its name, which bubbles to the root `oncommand`.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export class MenuItemAria<E extends BaseElement = HTMLButtonElement> extends ButtonAria<
  E,
  MenuItemProps,
  MenuItemAttributes<E>,
  MenuItemOptions
> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  protected declare host: MenuAria;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * @param props - User-provided item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemProps = {}, options: MenuItemOptions = { native: true }) {
    super(props, options as ButtonOptions);

    this.host = menuCtx.get();
    this.omittedAttrs.push('name', 'oncommand', 'role', 'tabindex', 'aria-disabled');

    this.on('click', () => this.invoke());
    this.on('focus', () => {
      const event = new CustomEvent('input', { bubbles: true, detail: this.properties.name, cancelable: true });
      this.element?.dispatchEvent(event);
      this.dispatch(event);
    });
    this.update();
  }

  /**
   * Invokes the item command unless effectively disabled.
   */
  protected invoke(): void {
    if (this.disabled || !this.element || !this.host) return;

    const event = new CustomEvent('command', { bubbles: true, detail: this.properties.name, cancelable: true });

    this.element.dispatchEvent(event);
    this.properties.oncommand?.(event as MenuCommandEvent);
    this.dispatch(event);
    this.host.open = false;
  }

  /**
   * Compiles the item attributes with the command-item role.
   */
  protected override createAttributes(): MenuItemAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitem',
      tabIndex: -1,
    }) as MenuItemAttributes<E>;
  }
}

/**
 * Reactive input properties for the Menu checkable item.
 */
export interface MenuItemCheckboxProps extends CheckboxProps {}

/**
 * Compiled HTML and ARIA attributes for a menu checkbox item.
 *
 * @template E - Target Element type
 */
export interface MenuItemCheckboxAttributes<E extends BaseElement = HTMLButtonElement> extends CheckboxAttributes<E> {}

/**
 * Checkable menu item compiling `role="menuitemcheckbox"`.
 * Inherits checkbox state projection over its own props; `aria-checked`
 * projects on both hosts and `change` carries the committed boolean.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export class MenuItemCheckboxAria<E extends BaseElement = HTMLButtonElement> extends CheckboxAria<
  E,
  MenuItemCheckboxProps,
  MenuItemCheckboxAttributes<E>,
  MenuItemOptions
> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  protected declare host: MenuAria;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * @param props - User-provided checkbox item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemCheckboxProps = {}, options: MenuItemOptions = { native: false }) {
    super(props, options);

    this.host = menuCtx.get();
    this.omittedAttrs.push('checked', 'name', 'value', 'onchange', 'aria-checked', 'role');
    this.update();
  }

  /**
   * Compiles the item attributes with the checkable-item role.
   */
  protected override createAttributes(): MenuItemCheckboxAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitemcheckbox',
    }) as MenuItemCheckboxAttributes<E>;
  }
}

/**
 * Reactive input properties for the Menu radio item.
 *
 * @template T - Choice candidate value type
 */
export interface MenuItemRadioProps<T extends Primitive = Primitive> extends RadioProps<T> {}

/**
 * Compiled HTML and ARIA attributes for a menu radio item.
 *
 * @template E - Target Element type
 */
export interface MenuItemRadioAttributes<E extends BaseElement = HTMLButtonElement> extends RadioAttributes<E> {}

/**
 * Radio menu item compiling `role="menuitemradio"`.
 * Inherits radio selection projection inside the enclosing group;
 * active when `group.value === props.value`, select-only on activation,
 * and `change` carries the committed group value.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Choice candidate value type
 */
export class MenuItemRadioAria<
  E extends BaseElement = HTMLButtonElement,
  P extends MenuItemRadioProps = MenuItemRadioProps,
> extends RadioAria<E, P, MenuItemRadioAttributes<E>, MenuItemOptions> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  protected declare host: MenuAria;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * @param props - User-provided radio item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemRadioProps, options: MenuItemOptions = { native: false }) {
    super(props as never, options);

    this.host = menuCtx.get();
    this.omittedAttrs.push('value', 'name', 'checked', 'onchange', 'aria-checked', 'role');
    this.update();
  }

  /**
   * Compiles the item attributes with the radio-item role.
   */
  protected override createAttributes(): MenuItemRadioAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitemradio',
    }) as MenuItemRadioAttributes<E>;
  }
}
