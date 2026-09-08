import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
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
 * Visual and keyboard orientation of the tablist.
 */
export type TabOrientation = Orientation;

/**
 * Ambient instance context for the enclosing Tab orchestrator.
 */
export const tabCtx = createContext<TabAria>();

/**
 * Global configuration options for Tab.
 */
export interface TabConfig {
  orientation: TabOrientation;
}

/**
 * Reactive input properties for the Tab root orchestrator.
 */
export interface TabProps extends AriaProps {
  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Currently active tab name.
   */
  value?: string;

  /**
   * Visual and keyboard orientation of the tablist.
   * @default 'horizontal'
   */
  orientation?: TabOrientation;

  /**
   * Whether tab activation requires manual Enter/Space press instead of automatic arrow key focus.
   * @default true
   */
  manual?: boolean;

  /**
   * Enforces a selection constraint requiring a non-empty value.
   * @default true
   */
  required?: boolean;

  /**
   * Whether all tabs within the group are disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Tab root element.
 *
 * @template E - Target Element type
 */
export interface TabAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

/**
 * Reactive input properties for the TabList focus manager.
 */
export interface TabListProps extends AriaProps {
  /**
   * Accessible label for the tablist.
   */
  label?: string;

  /**
   * Element ID providing the accessible label for the tablist.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for the TabList element.
 *
 * @template E - Target Element type
 */
export interface TabListAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: typeof ROLE_TABLIST;
  'aria-orientation': TabOrientation;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onkeydown?: (e: KeyboardEvent) => void;
}

/**
 * Reactive input properties for TabButton triggers.
 */
export interface TabButtonProps extends AriaProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity matching paired TabPanel name.
   */
  name: string;

  /**
   * Initial selection hint when parent is uncontrolled.
   */
  selected?: boolean;

  /**
   * Whether this tab button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for TabButton triggers.
 */
export interface TabButtonOptions extends AriaOptions {
  /**
   * Whether bound to a native button element.
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for TabButton triggers.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface TabButtonAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  id: string;
  role: typeof ROLE_TAB;
  type?: 'button';
  'aria-selected': 'true' | 'false';
  'aria-disabled': 'true' | 'false';
  'aria-controls': string;
  tabindex?: number;
}

/**
 * Reactive input properties for TabPanel content containers.
 */
export interface TabPanelProps extends AriaProps {
  /**
   * Semantic identity matching paired TabButton name.
   */
  name: string;

  /**
   * Explicit DOM identifier overriding automatic pair derivation.
   */
  id?: string;
}

/**
 * Compiled HTML and ARIA attributes for TabPanel containers.
 *
 * @template E - Target Element type
 */
export interface TabPanelAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: typeof ROLE_TABPANEL;
  id: string;
  'aria-labelledby': string;
  tabindex?: number;
  hidden?: boolean;
}

const ROLE_TAB = 'tab';
const ROLE_TABLIST = 'tablist';
const ROLE_TABPANEL = 'tabpanel';
const DEFAULT_ORIENTATION: TabOrientation = 'horizontal';
const TAB_SELECTORS = `[role="${ROLE_TAB}"]:not([aria-disabled="true"]):not([disabled])`;

/**
 * Root logical orchestrator managing tab selection state, axis orientation, and context publishing.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class TabAria<
  E extends BaseElement = HTMLElement,
  T extends TabProps = TabProps,
  A extends TabAttributes<E> = TabAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Global default configuration for Tab.
   */
  public static config: TabConfig = {
    orientation: DEFAULT_ORIENTATION,
  };

  /**
   * Configures global default settings for all Tab instances.
   *
   * @param config - Partial global tab configuration
   */
  public static configure(config: Partial<TabConfig>): void {
    Object.assign(TabAria.config, config);
  }

  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_TAB}-${uIndex($symbol(ROLE_TAB), true)}`;

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.props.id = this.props.id ?? this.id;
      this.props.orientation = this.props.orientation ?? TabAria.config.orientation;
      this.props.required = this.props.required ?? true;
      this.props.manual = this.props.manual ?? true;
    });
    tabCtx.set(this as unknown as TabAria);
    selectionGroup.set(this.props);
    this.update();
  }

  /**
   * Spawns a TabListAria focus manager controller bound to this tab instance.
   *
   * @template TE - Target Element type (defaults to HTMLElement)
   * @param props - TabList reactive properties
   * @returns Configured TabListAria instance
   */
  public list<TE extends BaseElement = HTMLElement>(props?: TabListProps): TabListAria<TE> {
    return new TabListAria<TE>(props);
  }

  /**
   * Spawns a TabButtonAria trigger controller bound to this tab instance.
   *
   * @template TE - Target Element type (defaults to HTMLButtonElement)
   * @param props - TabButton reactive properties
   * @param options - TabButton configuration options
   * @returns Configured TabButtonAria instance
   */
  public button<TE extends BaseElement = HTMLButtonElement>(
    props: TabButtonProps,
    options?: Partial<TabButtonOptions>
  ): TabButtonAria<TE> {
    return new TabButtonAria<TE>(props, options);
  }

  /**
   * Spawns a TabPanelAria container controller bound to this tab instance.
   *
   * @template PE - Target Element type (defaults to HTMLElement)
   * @param props - TabPanel reactive properties
   * @returns Configured TabPanelAria instance
   */
  public panel<PE extends BaseElement = HTMLElement>(props: TabPanelProps): TabPanelAria<PE> {
    return new TabPanelAria<PE>(props);
  }

  /**
   * Compiles base attributes for the tab root element.
   *
   * @returns Tab attributes dictionary
   */
  protected override createAttributes(): A {
    return {
      id: this.props.id!,
    } as A;
  }
}

/**
 * TabList controller managing keyboard roving focus and orientation for a set of tabs.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class TabListAria<
  E extends BaseElement = HTMLElement,
  A extends TabListAttributes<E> = TabListAttributes<E>,
> extends Aria<E, TabListProps, A> {
  private parentRover = roverCtx.get();

  /**
   * Enclosing Tab orchestrator controller.
   */
  protected tab?: TabAria;

  public constructor(props: Partial<TabListProps> = {}) {
    super(props);
    this.tab = tabCtx.get();
    roverCtx.set(this as unknown as Aria<BaseElement>);
    this.update();
  }

  /**
   * Visual and keyboard orientation inherited from the parent tab orchestrator.
   */
  public get orientation(): TabOrientation {
    return this.tab?.props.orientation ?? TabAria.config.orientation;
  }

  /**
   * Compiles HTML and ARIA attributes for the tablist container.
   *
   * @returns TabList attributes dictionary
   */
  protected override createAttributes(): A {
    return {
      role: ROLE_TABLIST,
      'aria-orientation': this.orientation,
      'aria-label': this.props.label,
      'aria-labelledby': this.props.labelledby,
      onkeydown: (e: KeyboardEvent) => {
        if (this.tab?.props.disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: TAB_SELECTORS,
          orientation: this.orientation,
          manual: this.tab?.props.manual ?? true,
        });
      },
    } as A;
  }
}

/**
 * Interactive tab header trigger that activates an associated panel.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Options dictionary type
 */
export class TabButtonAria<
  E extends BaseElement = HTMLButtonElement,
  T extends TabButtonProps = TabButtonProps,
  A extends TabButtonAttributes<E> = TabButtonAttributes<E>,
  O extends TabButtonOptions = TabButtonOptions,
> extends SelectionAria<E, SelectionProps, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props as SelectionProps, {
      native: true,
      ...options,
      role: ROLE_TAB,
      valueKey: 'name',
    });
    this.omittedAttrs.push('id', 'aria-controls');
    this.update();
  }

  /**
   * Compiles HTML and ARIA attributes for the tab trigger button.
   *
   * @returns TabButton attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const value = this.value;
    const isSelected = this.selected;

    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? `${scope}${ROLE_TAB}-${value}`,
      role: ROLE_TAB,
      type: this.isNative ? 'button' : undefined,
      'aria-selected': isSelected ? 'true' : 'false',
      'aria-disabled': this.disabled ? 'true' : 'false',
      'aria-controls': `${scope}${ROLE_TABPANEL}-${value}`,
      tabindex: this.isNative ? (isSelected ? undefined : -1) : this.disabled ? -1 : isSelected ? 0 : -1,
    }) as A;
  }
}

/**
 * Tab panel content container associated with a specific tab button.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class TabPanelAria<
  E extends BaseElement = HTMLElement,
  T extends TabPanelProps = TabPanelProps,
  A extends TabPanelAttributes<E> = TabPanelAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_TABPANEL}-${uIndex($symbol(ROLE_TABPANEL), true)}`;

  /**
   * Associated tab selection group props.
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
   * Whether this panel's paired tab button is currently active.
   */
  public get selected(): boolean {
    return this.group?.value === this.key;
  }

  /**
   * Compiles HTML and ARIA attributes for the tab panel.
   *
   * @returns TabPanel attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;

    return {
      role: ROLE_TABPANEL,
      id: this.props.id ?? `${scope}${ROLE_TABPANEL}-${key}`,
      'aria-labelledby': `${scope}${ROLE_TAB}-${key}`,
      tabindex: this.selected ? 0 : undefined,
      hidden: !this.selected,
    } as A;
  }
}
