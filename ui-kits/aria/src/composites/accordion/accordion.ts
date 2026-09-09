import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../../types.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { AccordionButtonAria, type AccordionButtonOptions, type AccordionButtonProps } from './button.js';
import { AccordionPanelAria, type AccordionPanelProps } from './panel.js';

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
   * @default false
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
  orientation?: Orientation;

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
  orientation?: Orientation;

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

export const ROLE_ACCORDION = 'accordion';
export const ROLE_REGION = 'region';
const DEFAULT_ORIENTATION: Orientation = 'vertical';
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
        this.props.required = this.props.required ?? false;
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
    return Object.assign(super.createAttributes(), {
      id: this.props.id!,
      onkeydown: (e: KeyboardEvent) => {
        if (this.props.disabled) return;

        handleRovingKey(this.element, e, {
          selector: ACCORDION_SELECTORS,
          orientation: this.props.orientation ?? DEFAULT_ORIENTATION,
          manual: this.props.manual ?? true,
        });
      },
    }) as A;
  }
}
