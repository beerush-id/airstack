import {
  AccordionAria,
  AccordionButtonAria,
  type AccordionButtonOptions,
  type AccordionButtonProps,
  AccordionPanelAria,
  type AccordionPanelProps,
  type AccordionProps,
  CheckboxGroupAria,
  type CheckboxGroupProps,
  ComboboxAria,
  ComboboxInputAria,
  type ComboboxInputProps,
  ComboboxPanelAria,
  type ComboboxPanelProps,
  type ComboboxProps,
  ConfirmActionAria,
  ConfirmAria,
  ConfirmCancelAria,
  ConfirmDescriptionAria,
  ConfirmPanelAria,
  type ConfirmProps,
  ConfirmTitleAria,
  ConfirmTriggerAria,
  DialogAria,
  DialogCloseAria,
  DialogDescriptionAria,
  DialogPanelAria,
  type DialogProps,
  DialogTitleAria,
  DialogTriggerAria,
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
  SelectAria,
  SelectPanelAria,
  type SelectPanelProps,
  type SelectProps,
  SelectTriggerAria,
  type SelectTriggerOptions,
  type SelectTriggerProps,
  StepperAria,
  StepperButtonAria,
  type StepperButtonOptions,
  StepperInputAria,
  type StepperInputOptions,
  type StepperInputProps,
  type StepperProps,
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
import {
  FooterAria,
  type FooterOptions,
  type FooterProps,
  FormAria,
  type FormLandmarkOptions,
  type FormLandmarkProps,
  HeaderAria,
  type HeaderOptions,
  type HeaderProps,
  MainAria,
  type MainOptions,
  type MainProps,
  NavigationAria,
  type NavigationOptions,
  type NavigationProps,
  SearchAria,
  type SearchLandmarkOptions,
  type SearchLandmarkProps,
  SectionAria,
  type SectionOptions,
  type SectionProps,
  SidebarAria,
  type SidebarOptions,
  type SidebarProps,
} from './landmarks/index.js';
import { AnnouncerAria, type AnnouncerOptions, type AnnouncerProps } from './live/index.js';
import type { AriaOptions, AriaProps, BaseElement, Primitive } from './types.js';
import {
  ButtonAria,
  type ButtonOptions,
  type ButtonProps,
  CheckboxAria,
  type CheckboxOptions,
  type CheckboxProps,
  DisclosureAria,
  type DisclosureOptions,
  DisclosurePanelAria,
  type DisclosureProps,
  DisclosureTriggerAria,
  type DisclosureTriggerOptions,
  DividerAria,
  type DividerProps,
  FilePickerAria,
  type FilePickerOptions,
  type FilePickerProps,
  ImageAria,
  ImageContentAria,
  ImageFallbackAria,
  type ImageProps,
  LinkAria,
  type LinkOptions,
  type LinkProps,
  MeterAria,
  type MeterOptions,
  type MeterProps,
  NumberStepperAria,
  type NumberStepperOptions,
  type NumberStepperProps,
  OptionAria,
  type OptionOptions,
  type OptionProps,
  PopoverAria,
  type PopoverOptions,
  type PopoverProps,
  ProgressAria,
  type ProgressOptions,
  type ProgressProps,
  RadioAria,
  type RadioOptions,
  type RadioProps,
  SearchInputAria,
  type SearchInputOptions,
  type SearchInputProps,
  SliderAria,
  type SliderOptions,
  type SliderProps,
  SliderThumbAria,
  SplitterAria,
  type SplitterOptions,
  type SplitterProps,
  SwitchAria,
  type SwitchOptions,
  type SwitchProps,
  TextInputAria,
  type TextInputOptions,
  type TextInputProps,
  ToggleAria,
  type ToggleOptions,
  type ToggleProps,
  TooltipAria,
  type TooltipOptions,
  type TooltipProps,
} from './widgets/index.js';

export * from './composites/index.js';
export * from './context.js';
export * from './core.js';
export * from './landmarks/index.js';
export * from './live/index.js';
export * from './selection.js';
export * from './translators/jsx.js';
export * from './types.js';
export * from './utils/attributes.js';
export * from './utils/label.js';
export * from './utils/navigation.js';
export * from './utils/overlay.js';
export * from './utils/range.js';
export * from './widgets/index.js';

/**
 * Creates an ARIA behavioral controller for the specified entity.
 *
 * @template E - Target Element type
 * @param role - Target Aria entity name
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
  role: 'radio-group',
  props?: RadioGroupProps<T>
): RadioGroupAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'checkbox-group',
  props?: CheckboxGroupProps
): CheckboxGroupAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'listbox', props?: ListboxProps): ListboxAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'combobox', props?: ComboboxProps): ComboboxAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'combobox-input',
  props?: ComboboxInputProps,
  options?: AriaOptions
): ComboboxInputAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'combobox-panel',
  props?: ComboboxPanelProps
): ComboboxPanelAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'select', props?: SelectProps): SelectAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-trigger',
  props?: SelectTriggerProps,
  options?: SelectTriggerOptions
): SelectTriggerAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-panel',
  props?: SelectPanelProps
): SelectPanelAria<E>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'option',
  props?: OptionProps<T>,
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
  role: 'text-input',
  props?: TextInputProps,
  options?: TextInputOptions
): TextInputAria<E>;

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'search-input',
  props?: SearchInputProps,
  options?: SearchInputOptions
): SearchInputAria<E>;

export function aria<E extends BaseElement = HTMLAnchorElement>(
  role: 'link',
  props?: LinkProps,
  options?: LinkOptions
): LinkAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'image', props: ImageProps): ImageAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'image-content',
  props?: AriaProps
): ImageContentAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'image-fallback',
  props?: AriaProps
): ImageFallbackAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'progress',
  props?: ProgressProps,
  options?: ProgressOptions
): ProgressAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'meter',
  props: MeterProps,
  options?: MeterOptions
): MeterAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'divider', props?: DividerProps): DividerAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(role: 'dialog', props?: DialogProps): DialogAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'dialog-trigger',
  props?: AriaProps
): DialogTriggerAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(role: 'dialog-close', props?: AriaProps): DialogCloseAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(role: 'dialog-panel', props?: AriaProps): DialogPanelAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(role: 'dialog-title', props?: AriaProps): DialogTitleAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'dialog-description',
  props?: AriaProps
): DialogDescriptionAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(role: 'confirm', props?: ConfirmProps): ConfirmAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-trigger',
  props?: AriaProps
): ConfirmTriggerAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-panel',
  props?: AriaProps
): ConfirmPanelAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-title',
  props?: AriaProps
): ConfirmTitleAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-description',
  props?: AriaProps
): ConfirmDescriptionAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-action',
  props?: AriaProps
): ConfirmActionAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'confirm-cancel',
  props?: AriaProps
): ConfirmCancelAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'popover',
  props?: PopoverProps,
  options?: PopoverOptions
): PopoverAria<E>;

export function aria<E extends HTMLElement = HTMLElement>(
  role: 'tooltip',
  props?: TooltipProps,
  options?: TooltipOptions
): TooltipAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'disclosure',
  props?: DisclosureProps,
  options?: DisclosureOptions
): DisclosureAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'disclosure-trigger',
  props?: AriaProps,
  options?: DisclosureTriggerOptions
): DisclosureTriggerAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'disclosure-panel',
  props?: AriaProps
): DisclosurePanelAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'slider',
  props?: SliderProps,
  options?: SliderOptions
): SliderAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'slider-thumb', props?: AriaProps): SliderThumbAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'file-picker',
  props?: FilePickerProps,
  options?: FilePickerOptions
): FilePickerAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'splitter',
  props?: SplitterProps,
  options?: SplitterOptions
): SplitterAria<E>;

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'number-stepper',
  props?: NumberStepperProps,
  options?: NumberStepperOptions
): NumberStepperAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'stepper', props?: StepperProps): StepperAria<E>;

export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'stepper-input',
  props?: StepperInputProps,
  options?: StepperInputOptions
): StepperInputAria<E>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'stepper-inc' | 'stepper-dec',
  props?: AriaProps,
  options?: StepperButtonOptions
): StepperButtonAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'toolbar', props?: ToolbarProps): ToolbarAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menu', props?: MenuProps): MenuAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'menu-bar', props?: MenubarProps): MenubarAria<E>;

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

export function aria<E extends BaseElement = HTMLElement>(
  role: 'header',
  props?: HeaderProps,
  options?: HeaderOptions
): HeaderAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'main',
  props?: MainProps,
  options?: MainOptions
): MainAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'navigation',
  props?: NavigationProps,
  options?: NavigationOptions
): NavigationAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'sidebar',
  props?: SidebarProps,
  options?: SidebarOptions
): SidebarAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'footer',
  props?: FooterProps,
  options?: FooterOptions
): FooterAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'search',
  props?: SearchLandmarkProps,
  options?: SearchLandmarkOptions
): SearchAria<E>;

export function aria<E extends BaseElement = HTMLFormElement>(
  role: 'form',
  props?: FormLandmarkProps,
  options?: FormLandmarkOptions
): FormAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'section',
  props?: SectionProps,
  options?: SectionOptions
): SectionAria<E>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'announcer',
  props?: AnnouncerProps,
  options?: AnnouncerOptions
): AnnouncerAria<E>;

export function aria(role: string, init?: unknown, options?: unknown): unknown {
  switch (role) {
    case 'text-input':
      return new TextInputAria(init as never, { ...(options as object), role: 'text-input' } as never);
    case 'search-input':
      return new SearchInputAria(init as never, options as never);
    case 'link':
      return new LinkAria(init as never, options as never);
    case 'image':
      return new ImageAria(init as never, options as never);
    case 'image-content':
      return new ImageContentAria(init as never, options as never);
    case 'image-fallback':
      return new ImageFallbackAria(init as never, options as never);
    case 'progress':
      return new ProgressAria(init as never, options as never);
    case 'meter':
      return new MeterAria(init as never, options as never);
    case 'divider':
      return new DividerAria(init as never, options as never);
    case 'dialog':
      return new DialogAria(init as never, options as never);
    case 'dialog-trigger':
      return new DialogTriggerAria(init as never, options as never);
    case 'dialog-close':
      return new DialogCloseAria(init as never, options as never);
    case 'dialog-panel':
      return new DialogPanelAria(init as never, options as never);
    case 'dialog-title':
      return new DialogTitleAria(init as never, options as never);
    case 'dialog-description':
      return new DialogDescriptionAria(init as never, options as never);
    case 'confirm':
      return new ConfirmAria(init as never, options as never);
    case 'confirm-trigger':
      return new ConfirmTriggerAria(init as never, options as never);
    case 'confirm-panel':
      return new ConfirmPanelAria(init as never, options as never);
    case 'confirm-title':
      return new ConfirmTitleAria(init as never, options as never);
    case 'confirm-description':
      return new ConfirmDescriptionAria(init as never, options as never);
    case 'confirm-action':
      return new ConfirmActionAria(init as never, options as never);
    case 'confirm-cancel':
      return new ConfirmCancelAria(init as never, options as never);
    case 'popover':
      return new PopoverAria(init as never, options as never);
    case 'tooltip':
      return new TooltipAria(init as never, options as never);
    case 'disclosure':
      return new DisclosureAria(init as never, options as never);
    case 'disclosure-trigger':
      return new DisclosureTriggerAria(init as never, options as never);
    case 'disclosure-panel':
      return new DisclosurePanelAria(init as never);
    case 'slider':
      return new SliderAria(init as never, options as never);
    case 'slider-thumb':
      return new SliderThumbAria(init as never);
    case 'file-picker':
      return new FilePickerAria(init as never, options as never);
    case 'splitter':
      return new SplitterAria(init as never, options as never);
    case 'number-stepper':
      return new NumberStepperAria(init as never, options as never);
    case 'stepper':
      return new StepperAria(init as never);
    case 'stepper-input':
      return new StepperInputAria(init as never, options as never);
    case 'stepper-inc':
      return new StepperButtonAria(init as never, { ...(options as object), direction: 1 } as never);
    case 'stepper-dec':
      return new StepperButtonAria(init as never, { ...(options as object), direction: -1 } as never);
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
    case 'radio-group':
      return new RadioGroupAria(init as never);
    case 'checkbox-group':
      return new CheckboxGroupAria(init as never);
    case 'listbox':
      return new ListboxAria(init as never);
    case 'combobox':
      return new ComboboxAria(init as never);
    case 'combobox-input':
      return new ComboboxInputAria(init as never, options as never);
    case 'combobox-panel':
      return new ComboboxPanelAria(init as never);
    case 'select':
      return new SelectAria(init as never);
    case 'select-trigger':
      return new SelectTriggerAria(init as never, options as never);
    case 'select-panel':
      return new SelectPanelAria(init as never);
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
    case 'menu-bar':
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
    case 'header':
      return new HeaderAria(init as never, options as never);
    case 'main':
      return new MainAria(init as never, options as never);
    case 'navigation':
      return new NavigationAria(init as never, options as never);
    case 'sidebar':
      return new SidebarAria(init as never, options as never);
    case 'footer':
      return new FooterAria(init as never, options as never);
    case 'search':
      return new SearchAria(init as never, options as never);
    case 'form':
      return new FormAria(init as never, options as never);
    case 'section':
      return new SectionAria(init as never, options as never);
    case 'announcer':
      return new AnnouncerAria(init as never, options as never);
    default:
      throw new Error(`Unsupported aria role: ${role}`);
  }
}
