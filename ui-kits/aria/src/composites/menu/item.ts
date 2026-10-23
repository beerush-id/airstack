import type { AriaEventHandler, AriaOptions, AriaProps, BaseElement, DetachFn, Primitive } from '../../types.js';
import { createShortcut, type ShortcutBinding } from '../../utils/shortcut.js';
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
   * Keyboard shortcut that runs the item from anywhere on the page, e.g. `mod+d`.
   */
  shortcut?: string;

  /**
   * Item-level command listener invoked with the item's name.
   */
  oncommand?: AriaEventHandler<MenuCommandEvent>;
}

/**
 * A shortcut prop shared by every kind of menu row.
 */
export interface MenuItemShortcutProps {
  /**
   * Keyboard shortcut that activates the row from anywhere on the page, e.g. `mod+shift+e`.
   * `mod` is `⌘` on Apple platforms and `Ctrl` elsewhere.
   */
  shortcut?: string;
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
   * The item's keyboard shortcut; it runs the item the same way a click does.
   */
  protected shortcut?: ShortcutBinding;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * The shortcut as people read it, e.g. `⌘D`.
   */
  public get shortcutLabel(): string | undefined {
    return this.shortcut?.label;
  }

  /**
   * @param props - User-provided item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemProps = {}, options: MenuItemOptions = { native: true }) {
    super(props, { ...options, clickable: true } as ButtonOptions);

    this.host = menuCtx.get();
    this.shortcut = createShortcut(() => this.properties.shortcut);
    this.omittedAttrs.push('name', 'oncommand', 'shortcut', 'role', 'tabindex', 'aria-disabled');

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
    // Its own `oncommand`, the menu's, and every scope's above them hear it as it bubbles.
    this.dispatch(event);
    this.host.open = false;
  }

  /**
   * Runs the item when its shortcut is pressed anywhere on the page.
   *
   * @returns Teardown callback unbinding the shortcut
   */
  protected override attach(): DetachFn | void {
    const detach = super.attach();
    const unbind = this.shortcut?.attach(this.element!, () => {
      if (this.disabled) return false;
      this.invoke();
      return true;
    });

    return () => {
      detach?.();
      unbind?.();
    };
  }

  /**
   * Compiles the item attributes with the command-item role.
   */
  protected override createAttributes(): MenuItemAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitem',
      tabIndex: -1,
      'aria-keyshortcuts': this.shortcut?.aria,
    }) as MenuItemAttributes<E>;
  }
}

/**
 * Reactive input properties for the Menu checkable item.
 */
export interface MenuItemCheckboxProps extends CheckboxProps, MenuItemShortcutProps {}

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
   * The item's keyboard shortcut; it flips the item the same way a click does.
   */
  protected shortcut?: ShortcutBinding;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * The shortcut as people read it, e.g. `⌥Z`.
   */
  public get shortcutLabel(): string | undefined {
    return this.shortcut?.label;
  }

  /**
   * @param props - User-provided checkbox item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemCheckboxProps = {}, options: MenuItemOptions = { native: false }) {
    super(props, { ...options, clickable: true });

    this.host = menuCtx.get();
    this.shortcut = createShortcut(() => this.properties.shortcut);
    this.omittedAttrs.push('checked', 'name', 'value', 'onchange', 'shortcut', 'aria-checked', 'role');
    this.update();
  }

  /**
   * Flips the item when its shortcut is pressed anywhere on the page.
   *
   * @returns Teardown callback unbinding the shortcut and the label polyfill
   */
  protected override attach(): DetachFn | void {
    const detach = super.attach();
    const unbind = this.shortcut?.attach(this.element!, () => {
      if (this.disabled) return false;
      this.toggle();
      return true;
    });

    return () => {
      detach?.();
      unbind?.();
    };
  }

  /**
   * Compiles the item attributes with the checkable-item role.
   */
  protected override createAttributes(): MenuItemCheckboxAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitemcheckbox',
      'aria-keyshortcuts': this.shortcut?.aria,
    }) as MenuItemCheckboxAttributes<E>;
  }
}

/**
 * Reactive input properties for the Menu radio item.
 *
 * @template T - Choice candidate value type
 */
export interface MenuItemRadioProps<T extends Primitive = Primitive> extends RadioProps<T>, MenuItemShortcutProps {}

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
   * The item's keyboard shortcut; it chooses the item the same way a click does.
   */
  protected shortcut?: ShortcutBinding;

  /**
   * Whether this item is disabled, factoring in menu-level disablement.
   */
  public override get disabled() {
    return super.disabled || this.host?.disabled;
  }

  /**
   * The shortcut as people read it, e.g. `⌘L`.
   */
  public get shortcutLabel(): string | undefined {
    return this.shortcut?.label;
  }

  /**
   * @param props - User-provided radio item properties.
   * @param options - User-provided item options.
   */
  public constructor(props: MenuItemRadioProps, options: MenuItemOptions = { native: false }) {
    super(props as never, { ...options, clickable: true });

    this.host = menuCtx.get();
    this.shortcut = createShortcut(() => (this.properties as MenuItemRadioProps).shortcut);
    this.omittedAttrs.push('value', 'name', 'checked', 'onchange', 'shortcut', 'aria-checked', 'role');
    this.update();
  }

  /**
   * Chooses the item when its shortcut is pressed anywhere on the page.
   *
   * @returns Teardown callback unbinding the shortcut and the label polyfill
   */
  protected override attach(): DetachFn | void {
    const detach = super.attach();
    const unbind = this.shortcut?.attach(this.element!, () => {
      if (this.disabled) return false;
      this.select();
      return true;
    });

    return () => {
      detach?.();
      unbind?.();
    };
  }

  /**
   * Compiles the item attributes with the radio-item role.
   */
  protected override createAttributes(): MenuItemRadioAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: 'menuitemradio',
      'aria-keyshortcuts': this.shortcut?.aria,
    }) as MenuItemRadioAttributes<E>;
  }
}
