import { $symbol, type AnyType, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import {
  SelectionAria,
  type SelectionAttributes,
  type SelectionGroupProps,
  type SelectionOptions,
  type SelectionProps,
  selectionGroup,
} from '../selection.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';

/**
 * Visual and keyboard orientation of the accordion group.
 */
export type AccordionOrientation = 'vertical' | 'horizontal';

/**
 * Ambient instance context for the enclosing AccordionGroup orchestrator.
 */
export const accordionCtx = createContext<AccordionGroupAria>();

const ROLE_ACCORDION = 'accordion';
const ROLE_REGION = 'region';
const DEFAULT_ORIENTATION: AccordionOrientation = 'vertical';
const ACCORDION_SELECTORS =
  'button:not([disabled]):not([aria-disabled="true"]), [role="button"]:not([disabled]):not([aria-disabled="true"])';

/**
 * Reactive input properties for the AccordionGroup container orchestrator.
 */
export interface AccordionGroupProps extends SelectionGroupProps {
  /**
   * Explicit DOM identifier and namespace of the group.
   */
  id?: string;

  /**
   * Active expanded item key, array of keys, or dictionary of boolean flags.
   */
  value?: AnyType;

  /**
   * Whether all member accordions in the group are disabled.
   */
  disabled?: boolean;

  /**
   * Whether member accordions can be collapsed back to an empty/undefined state.
   * Inside a group, defaults to false (one section must stay open, like Tabs).
   * @default false
   */
  toggle?: boolean;

  /**
   * Visual and keyboard roving navigation orientation ('vertical' | 'horizontal').
   * @default 'vertical'
   */
  orientation?: AccordionOrientation;
}

/**
 * Compiled HTML and ARIA attributes for the AccordionGroup container.
 */
export interface AccordionGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

/**
 * Reactive input properties for an Accordion trigger header.
 */
export interface AccordionProps extends SelectionProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity key or field name on the parent group.
   */
  name?: string;

  /**
   * Value payload for scalar or array collection membership.
   */
  value?: AnyType;

  /**
   * Whether the accordion section is currently expanded.
   */
  expanded?: boolean;

  /**
   * Whether the accordion trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Controller configuration options for Accordion.
 */
export interface AccordionOptions extends AriaOptions {
  /**
   * Whether this accordion trigger can be toggled/collapsed independently.
   */
  toggle?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Accordion trigger button.
 */
export interface AccordionAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  id: string;
  'aria-expanded': 'true' | 'false';
  'aria-controls'?: string;
}

/**
 * Reactive input properties for an AccordionPanel content container.
 */
export interface AccordionPanelProps extends AriaProps {
  /**
   * Explicit DOM identifier of the panel.
   */
  id?: string;

  /**
   * Semantic identity key or field name linking to the controlling accordion trigger.
   */
  name?: string;

  /**
   * Value payload matching the controlling accordion trigger.
   */
  value?: AnyType;

  /**
   * Explicit local expansion state when used outside an accordion group.
   */
  expanded?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the AccordionPanel container.
 */
export interface AccordionPanelAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: 'region';
  id: string;
  'aria-labelledby'?: string;
  hidden?: boolean;
}

/**
 * AccordionGroup container coordinating mutually-exclusive or multi-expand disclosure state.
 *
 * @template E - Target Element type
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class AccordionGroupAria<
  E extends BaseElement = HTMLElement,
  T extends AccordionGroupProps = AccordionGroupProps,
  A extends AccordionGroupAttributes<E> = AccordionGroupAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_ACCORDION}-${uIndex($symbol(ROLE_ACCORDION), true)}`;

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.props.id = this.props.id ?? this.id;
    this.props.orientation = this.props.orientation ?? DEFAULT_ORIENTATION;

    accordionCtx.set(this as unknown as AccordionGroupAria);
    selectionGroup.set(this.props);
    this.update();
  }

  /**
   * Visual and keyboard orientation inherited by roving navigation.
   */
  public get orientation(): AccordionOrientation {
    return this.props.orientation ?? DEFAULT_ORIENTATION;
  }

  /**
   * Spawns an Accordion trigger controller bound to this accordion group.
   *
   * @param props - Reactive trigger properties
   * @param options - Controller configuration options
   * @returns Configured AccordionAria instance
   */
  public item<TE extends BaseElement = HTMLButtonElement>(
    props?: Partial<AccordionProps>,
    options?: Partial<AccordionOptions>
  ): AccordionAria<TE> {
    return new AccordionAria<TE>(props, options);
  }

  /**
   * Spawns an AccordionPanel content controller bound to this accordion group.
   *
   * @param props - Reactive panel properties
   * @returns Configured AccordionPanelAria instance
   */
  public panel<PE extends BaseElement = HTMLElement>(props?: Partial<AccordionPanelProps>): AccordionPanelAria<PE> {
    return new AccordionPanelAria<PE>(props);
  }

  /**
   * Compiles HTML attributes and roving keyboard navigation handlers for the container.
   */
  protected override createAttributes(): A {
    return {
      id: this.props.id!,
      onkeydown: (e: KeyboardEvent) => {
        if (this.props.disabled) return;

        handleRovingKey(this.element, e, {
          selector: ACCORDION_SELECTORS,
          orientation: this.orientation,
        });
      },
    } as unknown as A;
  }
}

/**
 * Interactive accordion trigger button that toggles an associated content panel.
 * Standalone: acts as an independent disclosure toggle.
 * Inside group: coordinates mutually-exclusive section expansion (like Tabs).
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class AccordionAria<
  E extends BaseElement = HTMLButtonElement,
  T extends AccordionProps = AccordionProps,
  A extends AccordionAttributes<E> = AccordionAttributes<E>,
  O extends AccordionOptions = AccordionOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props, {
      native: true,
      ...options,
      role: ROLE_ACCORDION,
      key: 'expanded',
    });

    this.omittedAttrs.push('id', 'aria-controls');
    this.update();
  }

  /**
   * Whether the accordion item toggles on click.
   * Standalone disclosure widgets default to true (independent collapse).
   * Inside a group, defaults to false (one section must stay open, like Tabs).
   */
  public override get isToggle(): boolean {
    if (!this.group) return this.options.toggle ?? true;
    return super.isToggle;
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
   * Compiles HTML and WAI-ARIA attributes for the accordion trigger button.
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;
    const isExpanded = this.expanded;

    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? `${scope}${ROLE_ACCORDION}-${key}`,
      role: this.isNative ? undefined : 'button',
      type: this.isNative ? 'button' : undefined,
      'aria-expanded': isExpanded ? 'true' : 'false',
      'aria-controls': `${scope}${ROLE_REGION}-${key}`,
      tabindex: this.isNative ? undefined : this.disabled ? -1 : 0,
    }) as unknown as A;
  }
}

/**
 * Collapsible content region associated with a specific accordion trigger.
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
   * Semantic identity key resolved with fallbacks: name -> value -> id.
   */
  public get key(): string {
    return this.props.name ?? this.props.value ?? this.props.id ?? this.id;
  }

  /**
   * Whether this panel's paired accordion trigger is currently expanded.
   */
  public get expanded(): boolean {
    if (this.group) {
      const value = this.group.value;
      if (value === undefined) return false;
      if (Array.isArray(value)) return value.includes(this.key);
      if (typeof value === 'object' && value !== null) return !!(value as Record<string, unknown>)[this.key];
      return value === this.key;
    }
    return !!this.props.expanded;
  }

  /**
   * Compiles HTML and WAI-ARIA attributes for the collapsible accordion panel.
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;
    const isExpanded = this.expanded;

    return {
      role: ROLE_REGION,
      id: this.props.id ?? `${scope}${ROLE_REGION}-${key}`,
      'aria-labelledby': `${scope}${ROLE_ACCORDION}-${key}`,
      hidden: !isExpanded,
    } as unknown as A;
  }
}
