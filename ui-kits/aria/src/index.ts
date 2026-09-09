import {
  AccordionAria,
  AccordionButtonAria,
  type AccordionButtonOptions,
  type AccordionButtonProps,
  AccordionPanelAria,
  type AccordionPanelProps,
  type AccordionProps,
  ListboxAria,
  type ListboxProps,
  MenuAria,
  MenuButtonAria,
  type MenuButtonProps,
  MenubarAria,
  type MenubarProps,
  MenuGroupAria,
  type MenuGroupProps,
  MenuItemAria,
  MenuItemCheckboxAria,
  type MenuItemCheckboxProps,
  type MenuItemOptions,
  type MenuItemProps,
  MenuItemRadioAria,
  type MenuItemRadioProps,
  MenuPanelAria,
  type MenuPanelProps,
  type MenuProps,
  RadioGroupAria,
  type RadioGroupProps,
  TabAria,
  TabButtonAria,
  type TabButtonOptions,
  type TabButtonProps,
  TabListAria,
  type TabListProps,
  TabPanelAria,
  type TabPanelProps,
  type TabProps,
  ToggleGroupAria,
  type ToggleGroupProps,
  ToolbarAria,
  type ToolbarProps,
} from './composites/index.js';
import type { BaseElement, Primitive } from './types.js';
import {
  ButtonAria,
  type ButtonOptions,
  type ButtonProps,
  CheckboxAria,
  type CheckboxOptions,
  type CheckboxProps,
  OptionAria,
  type OptionOptions,
  type OptionProps,
  RadioAria,
  type RadioOptions,
  type RadioProps,
  SwitchAria,
  type SwitchOptions,
  type SwitchProps,
  SearchboxAria,
  type SearchboxOptions,
  type SearchboxProps,
  TextboxAria,
  type TextboxOptions,
  type TextboxProps,
  ToggleAria,
  type ToggleOptions,
  type ToggleProps,
} from './widgets/index.js';

export * from './composites/index.js';
export * from './context.js';
export * from './core.js';
export * from './selection.js';
export * from './translators/jsx.js';
export * from './types.js';
export * from './utils/attributes.js';
export * from './utils/label.js';
export * from './utils/navigation.js';
export * from './widgets/index.js';

/**
 * Creates an ARIA behavioral controller for the specified role.
 *
 * @template E - Target Element type
 * @param role - Target WAI-ARIA role
 * @param props - Reactive props dictionary
 * @param options - Static controller configuration
 */
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'button',
  props?: ButtonProps,
  options?: ButtonOptions
): ButtonAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement, T extends Primitive = Primitive>(
  role: 'toggle',
  props?: ToggleProps<T>,
  options?: ToggleOptions
): ToggleAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'toggle-group',
  props?: ToggleGroupProps<T>
): ToggleGroupAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'switch',
  props?: SwitchProps<T>,
  options?: SwitchOptions
): SwitchAria<E>;

export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'checkbox',
  props?: CheckboxProps<T>,
  options?: CheckboxOptions
): CheckboxAria<E, CheckboxProps<T>>;

export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'radio',
  props?: RadioProps<T>,
  options?: RadioOptions
): RadioAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'radiogroup',
  props?: RadioGroupProps<T>
): RadioGroupAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'listbox',
  props?: ListboxProps<T>
): ListboxAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'option',
  props: OptionProps<T>,
  options?: OptionOptions
): OptionAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'accordion', props?: AccordionProps): AccordionAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'accordion-button',
  props?: AccordionButtonProps,
  options?: AccordionButtonOptions
): AccordionButtonAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-panel',
  props?: AccordionPanelProps
): AccordionPanelAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'tab', props?: TabProps): TabAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'tab-list', props?: TabListProps): TabListAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'tab-button',
  props: TabButtonProps,
  options?: TabButtonOptions
): TabButtonAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'tab-panel', props: TabPanelProps): TabPanelAria<E>;

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'textbox',
  props?: TextboxProps,
  options?: TextboxOptions
): TextboxAria<E>;

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'searchbox',
  props?: SearchboxProps,
  options?: SearchboxOptions
): SearchboxAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'toolbar', props?: ToolbarProps): ToolbarAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menu', props?: MenuProps): MenuAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menubar', props?: MenubarProps): MenubarAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menu-panel', props?: MenuPanelProps): MenuPanelAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item',
  props?: MenuItemProps,
  options?: MenuItemOptions
): MenuItemAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-button',
  props?: MenuButtonProps,
  options?: MenuItemOptions
): MenuButtonAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menu-group', props?: MenuGroupProps): MenuGroupAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'menu-item-checkbox',
  props?: MenuItemCheckboxProps,
  options?: MenuItemOptions
): MenuItemCheckboxAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement, T extends Primitive = Primitive>(
  role: 'menu-item-radio',
  props?: MenuItemRadioProps<T>,
  options?: MenuItemOptions
): MenuItemRadioAria<E>;

export function aria(role: string, init?: unknown, options?: unknown): unknown {
  switch (role) {
    case 'textbox':
      return new TextboxAria(init as never, { ...(options as object), role: 'textbox' } as never);
    case 'searchbox':
      return new SearchboxAria(init as never, options as never);
    case 'button':
      return new ButtonAria(init as never, options as never);
    case 'toggle':
      return new ToggleAria(init as never, options as never);
    case 'toggle-group':
      return new ToggleGroupAria(init as never);
    case 'switch':
      return new SwitchAria(init as never, options as never);
    case 'checkbox':
      return new CheckboxAria(init as never, options as never);
    case 'radio':
      return new RadioAria(init as never, options as never);
    case 'radiogroup':
      return new RadioGroupAria(init as never);
    case 'listbox':
      return new ListboxAria(init as never);
    case 'option':
      return new OptionAria(init as never, options as never);
    case 'accordion':
      return new AccordionAria(init as never);
    case 'accordion-button':
      return new AccordionButtonAria(init as never, options as never);
    case 'accordion-panel':
      return new AccordionPanelAria(init as never);
    case 'tab':
      return new TabAria(init as never);
    case 'tab-list':
      return new TabListAria(init as never);
    case 'tab-button':
      return new TabButtonAria(init as never, options as never);
    case 'tab-panel':
      return new TabPanelAria(init as never);
    case 'toolbar':
      return new ToolbarAria(init as never);
    case 'menu':
      return new MenuAria(init as never);
    case 'menubar':
      return new MenubarAria(init as never);
    case 'menu-panel':
      return new MenuPanelAria(init as never);
    case 'menu-item':
      return new MenuItemAria(init as never, options as never);
    case 'menu-button':
      return new MenuButtonAria(init as never, options as never);
    case 'menu-group':
      return new MenuGroupAria(init as never);
    case 'menu-item-checkbox':
      return new MenuItemCheckboxAria(init as never, options as never);
    case 'menu-item-radio':
      return new MenuItemRadioAria(init as never, options as never);
    default:
      throw new Error(`Unsupported aria role: ${role}`);
  }
}
