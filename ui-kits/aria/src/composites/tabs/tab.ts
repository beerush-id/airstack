import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../../types.js';
import { TabButtonAria, type TabButtonOptions, type TabButtonProps } from './button.js';
import { TabListAria, type TabListProps } from './list.js';
import { TabPanelAria, type TabPanelProps } from './panel.js';

/**
 * Ambient instance context for the enclosing Tab orchestrator.
 */
export const tabCtx = createContext<TabAria>();

/**
 * Global configuration options for Tab.
 */
export interface TabConfig {
  orientation: Orientation;
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
  orientation?: Orientation;

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

export const ROLE_TAB = 'tab';
export const ROLE_TABLIST = 'tablist';
export const ROLE_TABPANEL = 'tabpanel';
const DEFAULT_ORIENTATION: Orientation = 'horizontal';
export const TAB_SELECTORS = `[role="${ROLE_TAB}"]:not([aria-disabled="true"]):not([disabled])`;

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
      this.properties.id = this.properties.id ?? this.id;
      this.properties.orientation = this.properties.orientation ?? TabAria.config.orientation;
      this.properties.required = this.properties.required ?? true;
      this.properties.manual = this.properties.manual ?? true;
    });
    tabCtx.set(this as unknown as TabAria);
    selectionGroup.set(this.properties);
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
    return Object.assign(super.createAttributes(), {
      id: this.properties.id!,
    }) as A;
  }
}
