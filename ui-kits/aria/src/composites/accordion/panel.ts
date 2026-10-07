import { $symbol, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { type SelectionGroupProps, selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { ROLE_ACCORDION, ROLE_REGION } from './accordion.js';

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
    return this.properties.name ?? this.properties.id ?? this.id;
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

    return Object.assign(super.createAttributes(), {
      id: this.properties.id ?? `${scope}${ROLE_REGION}-${key}`,
      role: ROLE_REGION,
      'aria-labelledby': `${scope}${ROLE_ACCORDION}-${key}`,
      hidden: !this.expanded,
    }) as A;
  }
}
