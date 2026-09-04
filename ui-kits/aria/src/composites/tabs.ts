import { $symbol, createContext, uIndex } from '@airlib/core';
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
 * Visual and keyboard orientation of the tablist.
 */
export type TabOrientation = 'horizontal' | 'vertical';

/**
 * Ambient instance context for the enclosing Tabs orchestrator.
 */
export const tabCtx = createContext<TabsAria>();

/**
 * Global configuration options for Tabs.
 */
export interface TabsConfig {
  orientation: TabOrientation;
}

const ROLE_TABS = 'tabs';
const ROLE_TABLIST = 'tablist';
const ROLE_TAB = 'tab';
const ROLE_TABPANEL = 'tabpanel';
const DEFAULT_ORIENTATION: TabOrientation = 'horizontal';
const TAB_SELECTORS = `[role="${ROLE_TAB}"]:not([aria-disabled="true"]):not([disabled])`;

/**
 * Reactive input properties for the Tabs root orchestrator.
 */
export interface TabsProps extends SelectionGroupProps {
  /**
   * Explicit DOM identifier and group namespace.
   */
  id?: string;

  /**
   * Currently active tab name/key.
   */
  value?: string;

  /**
   * Visual and keyboard orientation of the tablist ('horizontal' | 'vertical').
   * @default 'horizontal'
   */
  orientation?: TabOrientation;

  /**
   * Whether tab activation requires manual Enter/Space press instead of automatic arrow key focus.
   * @default false
   */
  manual?: boolean;

  /**
   * Whether all tabs within the group are disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for the Tabs root element.
 *
 * @template E - Target Element type
 */
export interface TabsAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
}

/**
 * Compiled HTML and ARIA attributes for the Tablist element.
 *
 * @template E - Target Element type
 */
export interface TablistAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: typeof ROLE_TABLIST;
  'aria-orientation': TabOrientation;
  onkeydown?: (e: KeyboardEvent) => void;
}

/**
 * Reactive input properties for Tab trigger buttons.
 */
export interface TabProps extends SelectionProps {
  /**
   * Semantic option name identifying the tab and matching its paired panel.
   */
  name?: string;

  /**
   * Explicit DOM identifier overriding automatic pair derivation.
   */
  id?: string;

  /**
   * Whether this tab is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Behavioral configuration options for Tab trigger elements.
 */
export interface TabOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for Tab triggers.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export interface TabAttributes<E extends BaseElement = HTMLButtonElement> extends SelectionAttributes<E> {
  role: typeof ROLE_TAB;
  type?: 'button';
  'aria-selected': 'true' | 'false';
  'aria-controls'?: string;
  tabindex?: number;
}

/**
 * Reactive input properties for TabPanel content containers.
 */
export interface TabPanelProps extends AriaProps {
  /**
   * Semantic option name matching the paired Tab trigger.
   */
  name?: string;

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
  'aria-labelledby'?: string;
  tabindex?: number;
  hidden?: boolean;
}

/**
 * Root logical orchestrator managing shared tab state, orientation, and context publishing.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class TabsAria<
  E extends BaseElement = HTMLElement,
  T extends TabsProps = TabsProps,
  A extends TabsAttributes<E> = TabsAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Global default configuration for Tabs.
   */
  public static config: TabsConfig = {
    orientation: DEFAULT_ORIENTATION,
  };

  /**
   * Configures global default settings for all Tabs instances.
   */
  public static configure(config: Partial<TabsConfig>): void {
    Object.assign(TabsAria.config, config);
  }

  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${ROLE_TABS}-${uIndex($symbol(ROLE_TABS), true)}`;

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.props.id = this.props.id ?? this.id;
    this.props.orientation = this.props.orientation ?? TabsAria.config.orientation;
    tabCtx.set(this as unknown as TabsAria);
    selectionGroup.set(this.props);
    this.update();
  }

  public list<TE extends BaseElement = HTMLElement>(): TablistAria<TE> {
    return new TablistAria<TE>(this.props);
  }

  /**
   * Spawns a TabAria trigger controller bound to this tabs instance.
   */
  public tab<TE extends BaseElement = HTMLButtonElement>(props?: TabProps, options?: Partial<TabOptions>): TabAria<TE> {
    return new TabAria<TE>(props, options);
  }

  /**
   * Spawns a TabPanelAria container controller bound to this tabs instance.
   */
  public panel<PE extends BaseElement = HTMLElement>(props?: TabPanelProps): TabPanelAria<PE> {
    return new TabPanelAria<PE>(props);
  }

  /**
   * Compiles base attributes for the tabs root element.
   */
  protected override createAttributes(): A {
    return {
      id: this.props.id!,
    } as A;
  }
}

/**
 * Tablist controller managing keyboard roving focus and orientation for a set of tabs.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class TablistAria<
  E extends BaseElement = HTMLElement,
  A extends TablistAttributes<E> = TablistAttributes<E>,
> extends Aria<E, AriaProps, A> {
  /**
   * Associated tabs selection group props.
   */
  protected group?: TabsProps;

  public constructor(group?: TabsProps) {
    super();
    this.group = group ?? (selectionGroup.get() as TabsProps | undefined);
    this.update();
  }

  /**
   * Visual and keyboard orientation inherited from the parent tabs orchestrator.
   */
  public get orientation(): TabOrientation {
    return this.group?.orientation ?? TabsAria.config.orientation;
  }

  /**
   * Compiles HTML and ARIA attributes for the tablist container.
   */
  protected override createAttributes(): A {
    return {
      role: ROLE_TABLIST,
      'aria-orientation': this.orientation,
      onkeydown: (e: KeyboardEvent) => {
        if (this.group?.disabled) return;

        handleRovingKey(this.element, e, {
          selector: TAB_SELECTORS,
          orientation: this.orientation,
          manual: this.group?.manual,
        });
      },
    } as A;
  }
}

/**
 * Interactive tab header trigger that activates an associated panel.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class TabAria<
  E extends BaseElement = HTMLButtonElement,
  T extends TabProps = TabProps,
  A extends TabAttributes<E> = TabAttributes<E>,
  O extends TabOptions = TabOptions,
> extends SelectionAria<E, T, A, SelectionOptions> {
  public constructor(props: Partial<T> = {}, options: Partial<O> = {}) {
    super(props, {
      native: true,
      ...options,
      role: ROLE_TAB,
    });
    this.omittedAttrs.push('id', 'aria-controls');
    this.update();
  }

  /**
   * Compiles HTML and ARIA attributes for the tab trigger.
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;
    const isSelected = this.selected;

    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? `${scope}${ROLE_TAB}-${key}`,
      role: ROLE_TAB,
      type: this.isNative ? 'button' : undefined,
      'aria-selected': isSelected ? 'true' : 'false',
      'aria-controls': `${scope}${ROLE_TABPANEL}-${key}`,
      tabindex: this.isNative ? (isSelected ? undefined : -1) : this.disabled ? -1 : isSelected ? 0 : -1,
    }) as A;
  }
}

/**
 * Tab panel content container associated with a specific tab.
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
   * Associated tabs selection group props.
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
   * Whether this panel's paired tab is currently active.
   */
  public get selected(): boolean {
    return this.group?.value === this.key;
  }

  /**
   * Compiles HTML and ARIA attributes for the tab panel.
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
