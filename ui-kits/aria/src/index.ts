import {
  AccordionAria,
  AccordionGroupAria,
  type AccordionGroupProps,
  type AccordionOptions,
  AccordionPanelAria,
  type AccordionPanelProps,
  type AccordionProps,
} from './composites/accordion.js';
import { ListboxAria, type ListboxProps } from './composites/listbox.js';
import { RadioGroupAria, type RadioGroupProps } from './composites/radiogroup.js';
import {
  TabAria,
  TablistAria,
  type TabOptions,
  TabPanelAria,
  type TabPanelProps,
  type TabProps,
  TabsAria,
  type TabsProps,
} from './composites/tabs.js';
import { ToolbarAria, type ToolbarProps } from './composites/toolbar.js';
import type { BaseElement } from './types.js';
import { ButtonAria, type ButtonOptions, type ButtonProps } from './widgets/button.js';
import { CheckboxAria, type CheckboxOptions, type CheckboxProps } from './widgets/checkbox.js';
import { OptionAria, type OptionOptions, type OptionProps } from './widgets/option.js';
import { RadioAria, type RadioOptions, type RadioProps } from './widgets/radio.js';
import { SwitchAria, type SwitchProps } from './widgets/switch.js';

export * from './composites/accordion.js';
export * from './composites/listbox.js';
export * from './composites/radiogroup.js';
export * from './composites/tabs.js';
export * from './composites/toolbar.js';
export * from './context.js';
export * from './core.js';
export * from './selection.js';
export * from './translators/jsx.js';
export * from './types.js';
export * from './utils/attributes.js';
export * from './utils/navigation.js';
export * from './widgets/button.js';
export * from './widgets/checkbox.js';
export * from './widgets/option.js';
export * from './widgets/radio.js';
export * from './widgets/switch.js';

/**
 * Creates an ARIA behavioral controller for the specified role.
 *
 * @template E - Target Element type
 * @param role - Target WAI-ARIA role
 * @param props - Reactive props dictionary
 * @param options - Static controller configuration
 */
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'button' | 'togglebutton',
  props?: Partial<ButtonProps>,
  options?: ButtonOptions
): ButtonAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'switch',
  props?: Partial<SwitchProps>
): SwitchAria<E>;
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'checkbox',
  props?: Partial<CheckboxProps>,
  options?: CheckboxOptions
): CheckboxAria<E>;
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'radio',
  props?: Partial<RadioProps>,
  options?: RadioOptions
): RadioAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'tabs', props?: Partial<TabsProps>): TabsAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'tablist', props?: Partial<TabsProps>): TablistAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'tab',
  props?: Partial<TabProps>,
  options?: Partial<TabOptions>
): TabAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tabpanel',
  props?: Partial<TabPanelProps>
): TabPanelAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'radiogroup',
  props?: Partial<RadioGroupProps>
): RadioGroupAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'listbox',
  props?: Partial<ListboxProps>
): ListboxAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'option',
  props?: Partial<OptionProps>,
  options?: Partial<OptionOptions>
): OptionAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-group',
  props?: Partial<AccordionGroupProps>
): AccordionGroupAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'accordion',
  props?: Partial<AccordionProps>,
  options?: Partial<AccordionOptions>
): AccordionAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-panel',
  props?: Partial<AccordionPanelProps>
): AccordionPanelAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'toolbar',
  props?: Partial<ToolbarProps>
): ToolbarAria<E>;
export function aria(role: string, init?: unknown, options?: unknown): unknown {
  switch (role) {
    case 'button':
    case 'togglebutton':
      return new ButtonAria(init as never, options as never);
    case 'switch':
      return new SwitchAria(init as never);
    case 'checkbox':
      return new CheckboxAria(init as never, options as never);
    case 'radio':
      return new RadioAria(init as never, options as never);
    case 'tabs':
      return new TabsAria(init as never);
    case 'tablist':
      return new TablistAria(init as never);
    case 'tab':
      return new TabAria(init as never, options as never);
    case 'tabpanel':
      return new TabPanelAria(init as never);
    case 'radiogroup':
      return new RadioGroupAria(init as never);
    case 'listbox':
      return new ListboxAria(init as never);
    case 'option':
      return new OptionAria(init as never, options as never);
    case 'accordion-group':
      return new AccordionGroupAria(init as never);
    case 'accordion':
      return new AccordionAria(init as never, options as never);
    case 'accordion-panel':
      return new AccordionPanelAria(init as never);
    case 'toolbar':
      return new ToolbarAria(init as never);
    default:
      throw new Error(`Unsupported aria role: ${role}`);
  }
}
