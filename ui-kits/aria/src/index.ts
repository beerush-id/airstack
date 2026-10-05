import {
  AccordionAria,
  AccordionButtonAria,
  type AccordionButtonOptions,
  type AccordionButtonProps,
  AccordionPanelAria,
  type AccordionPanelProps,
  type AccordionProps,
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
  type SelectProps,
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
import type { AriaProps, BaseElement, Primitive } from './types.js';
import {
  ButtonAria,
  type ButtonOptions,
  type ButtonProps,
  CheckboxAria,
  type CheckboxOptions,
  type CheckboxProps,
  DividerAria,
  type DividerOptions,
  type DividerProps,
  FilePickerAria,
  type FilePickerOptions,
  type FilePickerProps,
  ImageAria,
  type ImageAttributes,
  ImageContentAria,
  type ImageContentAttributes,
  ImageFallbackAria,
  type ImageFallbackAttributes,
  type ImageProps,
  type ImageStatus,
  LinkAria,
  type LinkOptions,
  type LinkProps,
  NumberStepperAria,
  type NumberStepperOptions,
  type NumberStepperProps,
  OptionAria,
  type OptionOptions,
  type OptionProps,
  ProgressbarAria,
  type ProgressbarOptions,
  type ProgressbarProps,
  RadioAria,
  type RadioOptions,
  type RadioProps,
  SearchInputAria,
  type SearchInputOptions,
  type SearchInputProps,
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

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'select',
  props?: SelectProps<T>
): SelectAria<E>;

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
  role: 'progressbar',
  props?: ProgressbarProps,
  options?: ProgressbarOptions
): ProgressbarAria<E>;

export function aria<E extends BaseElement = HTMLElement>(role: 'divider', props?: DividerProps): DividerAria<E>;

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
    case 'progressbar':
      return new ProgressbarAria(init as never, options as never);
    case 'divider':
      return new DividerAria(init as never, options as never);
    case 'file-picker':
      return new FilePickerAria(init as never, options as never);
    case 'splitter':
      return new SplitterAria(init as never, options as never);
    case 'number-stepper':
      return new NumberStepperAria(init as never, options as never);
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
    case 'select':
      return new SelectAria(init as never);
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
