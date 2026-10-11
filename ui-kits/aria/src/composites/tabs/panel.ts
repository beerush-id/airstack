import { $symbol, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup, type SelectionGroupProps } from '../../selection.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { ROLE_TAB, ROLE_TABPANEL } from './tab.js';

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
   * Semantic identity key resolved with fallbacks: name -> id.
   */
  public get key(): string {
    return this.properties.name ?? this.properties.id ?? this.id;
  }

  /**
   * Whether this panel's paired tab button is currently active.
   */
  public get active() {
    return this.selected;
  }

  /**
   * Whether this panel's paired tab button is currently active.
   */
  public get selected(): boolean {
    return this.group?.value === this.key;
  }

  /**
   * Associated tab selection group props.
   */
  protected group?: SelectionGroupProps;

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.group = selectionGroup.get();
    this.omittedAttrs.push('id', 'aria-labelledby', 'name');
    this.update();
  }

  /**
   * Compiles HTML and ARIA attributes for the tab panel.
   *
   * @returns TabPanel attributes dictionary
   */
  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const key = this.key;
    const selfId = `${scope}${ROLE_TABPANEL}-${key}`;
    const buttonId = `${scope}${ROLE_TAB}-${key}`;

    return Object.assign(super.createAttributes(), {
      id: selfId,
      role: ROLE_TABPANEL,
      'aria-labelledby': buttonId,
      tabindex: this.selected ? 0 : -1,
      hidden: !this.selected,
    }) as A;
  }
}
