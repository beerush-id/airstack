import {
  AccordionAria,
  AccordionButtonAria,
  type AccordionButtonOptions,
  type AccordionButtonProps,
  AccordionPanelAria,
  type AccordionPanelProps,
  type AccordionProps,
} from './composites/accordion.js';
import { ListboxAria, type ListboxProps } from './composites/listbox.js';
import { RadioGroupAria, type RadioGroupProps } from './composites/radiogroup.js';
import {
  TabAria,
  TabButtonAria,
  type TabButtonOptions,
  type TabButtonProps,
  TabListAria,
  type TabListProps,
  TabPanelAria,
  type TabPanelProps,
  type TabProps,
} from './composites/tabs.js';
import { ToggleGroupAria, type ToggleGroupProps } from './composites/togglegroup.js';
import { ToolbarAria, type ToolbarProps } from './composites/toolbar.js';
import type { BaseElement, Primitive } from './types.js';
import { ButtonAria, type ButtonOptions, type ButtonProps } from './widgets/button.js';
import { CheckboxAria, type CheckboxOptions, type CheckboxProps } from './widgets/checkbox.js';
import { OptionAria, type OptionOptions, type OptionProps } from './widgets/option.js';
import { RadioAria, type RadioOptions, type RadioProps } from './widgets/radio.js';
import { SwitchAria, type SwitchOptions, type SwitchProps } from './widgets/switch.js';
import { ToggleAria, type ToggleOptions, type ToggleProps } from './widgets/toggle.js';

export * from './composites/accordion.js';
export * from './composites/listbox.js';
export * from './composites/radiogroup.js';
export * from './composites/tabs.js';
export * from './composites/togglegroup.js';
export * from './composites/toolbar.js';
export * from './context.js';
export * from './core.js';
export * from './selection.js';
export * from './translators/jsx.js';
export * from './types.js';
export * from './utils/attributes.js';
export * from './utils/label.js';
export * from './utils/navigation.js';
export * from './widgets/button.js';
export * from './widgets/checkbox.js';
export * from './widgets/option.js';
export * from './widgets/radio.js';
export * from './widgets/switch.js';
export * from './widgets/toggle.js';

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

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'checkbox',
  props?: CheckboxProps,
  options?: CheckboxOptions
): CheckboxAria<E>;

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

export function aria<E extends BaseElement = HTMLElement>(role: 'toolbar', props?: ToolbarProps): ToolbarAria<E>;

export function aria(role: string, init?: unknown, options?: unknown): unknown {
  switch (role) {
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
    default:
      throw new Error(`Unsupported aria role: ${role}`);
  }
}
