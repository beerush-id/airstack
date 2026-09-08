import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import {
  SelectionAria,
  type SelectionAttributes,
  type SelectionGroupProps,
  type SelectionOptions,
  type SelectionProps,
  selectionGroup,
} from '../selection.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Orientation } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';

/**
 * Visual and keyboard orientation of the accordion group.
 */
export type AccordionOrientation = Orientation;

/**
 * Ambient instance context for the enclosing Accordion orchestrator.
 */
export const accordionCtx = createContext<AccordionAria>();

/**
 * Reactive input properties for single-expansion Accordion container.
 */
export interface SingleAccordionProps extends AriaProps {
  /**
   * Explicit DOM identifier and namespace of the group.
   */
  id?: string;

  /**
   * Multiple expansion flag. Must be false for single selection.
   */
  multiple?: false;

  /**
   * Active expanded item key.
   */
  value?: string;

  /**
   * Whether at least one section must remain expanded in single-expand mode.
   * @default true
   */
  required?: boolean;

  /**
   * Whether all member accordions in the group are disabled.
   */
  disabled?: boolean;

  /**
   * Visual and keyboard roving navigation orientation.
   * @default 'vertical'
   */
  orientation?: AccordionOrientation;

  /**
   * Whether moving focus automatically expands or requires manual activation.
   * @default true
   */
  manual?: boolean;
}

/**
 * Reactive input properties for multiple-expansion Accordion container.
 */
export interface MultipleAccordionProps extends AriaProps {
  /**
   * Explicit DOM identifier and namespace of the group.
   */
  id?: string;

  /**
   * Multiple expansion flag.
   */
  multiple: true;

  /**
   * Array of active expanded item keys.
   */
  value?: string[];

  /**
   * Whether all member accordions in the group are disabled.
   */
  disabled?: boolean;

  /**
   * Visual and keyboard roving navigation orientation.
   * @default 'vertical'
   */
  orientation?: AccordionOrientation;

  /**
   * Whether moving focus automatically expands or requires manual activation.
   * @default true
   */
  manual?: boolean;
}

/**
 * Discriminated union of Accordion container properties.
 */
export type AccordionProps = SingleAccordionProps | MultipleAccordionProps;

/**
 * Compiled HTML and ARIA attributes for the Accordion container.
 *
 * @template E - Target Element type
 */
export interface AccordionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  onkeydown?: (e: KeyboardEvent) => void;
}

/**
 * Reactive input properties for an AccordionButton trigger header.
 */
export interface AccordionButtonProps extends AriaProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity key matching paired AccordionPanel.
   */
  name?: string;

  /**
   * Whether the accordion section is initially expanded when parent is uncontrolled.
   */
  expanded?: boolean;

  /**
   * Whether the accordion trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Controller configuration options for AccordionButton.
 */
export interface AccordionButtonOptions extends AriaOptions {
  /**
   * Whether bound to a native button element.
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Accordion trigger button.
 *
 * @template E - Target Element type
 */
export interface AccordionButtonAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  id: string;
  type?: 'button';
  role?: 'button';
  'aria-expanded': 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-controls': string;
  tabindex?: number;
}

/**
 * Reactive input properties for an AccordionPanel content container.
 */
export interface AccordionPanelProps extends AriaProps {
  /**
   * Semantic identity key matching paired AccordionButton.
   */
  name?: string;

  /**
   * Explicit DOM identifier overriding automatic pair derivation.
   */
  id?: string;
}

/**
 * Compiled HTML and ARIA attributes for the AccordionPanel content container.
 *
 * @template E - Target Element type
 */
export interface AccordionPanelAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  role: typeof ROLE_REGION;
  'aria-labelledby': string;
  hidden?: boolean;
}

const ROLE_ACCORDION = 'accordion';
const ROLE_REGION = 'region';
const DEFAULT_ORIENTATION: AccordionOrientation = 'vertical';
const ACCORDION_SELECTORS =
  'button:not([disabled]):not([aria-disabled="true"]), [role="button"]:not([disabled]):not([aria-disabled="true"])';

/**
 * Root logical orchestrator managing accordion expansion state and roving keyboard navigation.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class AccordionAria<
  E extends BaseElement = HTMLElement,
  T extends AccordionProps = AccordionProps,
  A extends AccordionAttributes<E> = AccordionAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `accordion-${uIndex($symbol('accordion'), true)}`;

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.props.id = this.props.id ?? this.id;
      this.props.orientation = this.props.orientation ?? DEFAULT_ORIENTATION;
      if (!this.props.multiple) {
        this.props.required = this.props.required ?? true;
        this.props.manual = this.props.manual ?? true;
      }
    });
    accordionCtx.set(this as unknown as AccordionAria);
    selectionGroup.set(this.props);
    this.update();
  }

  /**
   * Spawns an AccordionButtonAria trigger controller bound to this accordion instance.
   *
   * @template BE - Target Element type (defaults to HTMLButtonElement)
   * @param props - AccordionButton reactive properties
   * @param options - AccordionButton configuration options
   * @returns Configured AccordionButtonAria instance
   */
  public button<BE extends BaseElement = HTMLButtonElement>(
    props?: AccordionButtonProps,
    options?: Partial<AccordionButtonOptions>
  ): AccordionButtonAria<BE> {
    return new AccordionButtonAria<BE>(props, options);
  }

  /**
   * Spawns an AccordionPanelAria container controller bound to this accordion instance.
   *
   * @template PE - Target Element type (defaults to HTMLElement)
   * @param props - AccordionPanel reactive properties
   * @returns Configured AccordionPanelAria instance
   */
  public panel<PE extends BaseElement = HTMLElement>(props?: AccordionPanelProps): AccordionPanelAria<PE> {
    return new AccordionPanelAria<PE>(props);
  }

  /**
   * Compiles base attributes and roving key event handlers for the accordion root element.
   *
   * @returns Accordion attributes dictionary
   */
  protected override createAttributes(): A {
    return {
      id: this.props.id!,
      onkeydown: (e: KeyboardEvent) => {
        if (this.props.disabled) return;

        handleRovingKey(this.element, e, {
          selector: ACCORDION_SELECTORS,
          orientation: this.props.orientation ?? DEFAULT_ORIENTATION,
          manual: this.props.manual ?? true,
        });
      },
    } as A;
  }
}

/**
 * Interactive accordion trigger button that toggles paired panel visibility.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Options dictionary type
 */
export class AccordionButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends AccordionButtonProps = AccordionButtonProps,
  A extends AccordionButtonAttributes<E> = AccordionButtonAttributes<E>,
  O extends AccordionButtonOptions = AccordionButtonOptions,
> extends SelectionAria<E, SelectionProps, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props as SelectionProps, {
      native: true,
      ...options,
      role: 'button',
      valueKey: 'name',
    });
    this.omittedAttrs.push('id', 'aria-controls');
    this.update();
  }

  /**
   * Whether the accordion section is currently expanded.
   */
  public get expanded(): boolean {
    return this.selected;
  }

  public set expanded(value: boolean) {
    this.selected = value;
  }

  /**
   * Compiles HTML and ARIA attributes for the accordion trigger button.
   *
   * @returns AccordionButton attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const value = this.value;
    const isExpanded = this.expanded;

    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? `${scope}${ROLE_ACCORDION}-${value}`,
      type: this.isNative ? 'button' : undefined,
      role: this.isNative ? undefined : 'button',
      'aria-expanded': isExpanded ? 'true' : 'false',
      'aria-disabled': this.disabled ? 'true' : 'false',
      'aria-controls': `${scope}${ROLE_REGION}-${value}`,
      tabindex: this.isNative ? undefined : this.disabled ? -1 : 0,
    }) as A;
  }
}

/**
 * Accordion content section revealed or collapsed by its paired trigger button.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class AccordionPanelAria<
  E extends BaseElement = HTMLElement,
  T extends AccordionPanelProps = AccordionPanelProps,
  A extends AccordionPanelAttributes<E> = AccordionPanelAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_REGION}-${uIndex($symbol(ROLE_REGION), true)}`;

  /**
   * Associated accordion selection group props.
   */
  protected group?: SelectionGroupProps;

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.group = selectionGroup.get();
    this.omittedAttrs.push('id', 'aria-labelledby');
    this.update();
  }

  /**
   * Semantic identity key resolved with fallbacks: name -> id.
   */
  public get key(): string {
    return this.props.name ?? this.props.id ?? this.id;
  }

  /**
   * Whether this panel's paired accordion button is currently active.
   */
  public get expanded(): boolean {
    if (this.group?.multiple) {
      return Array.isArray(this.group.value) && this.group.value.includes(this.key);
    }
    return this.group?.value === this.key;
  }

  /**
   * Compiles HTML and ARIA attributes for the accordion content section.
   *
   * @returns AccordionPanel attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;

    return {
      id: this.props.id ?? `${scope}${ROLE_REGION}-${key}`,
      role: ROLE_REGION,
      'aria-labelledby': `${scope}${ROLE_ACCORDION}-${key}`,
      hidden: !this.expanded,
    } as A;
  }
}
