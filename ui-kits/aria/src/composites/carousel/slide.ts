import { $symbol, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { type SelectionAttributes, selectionGroup, type SelectionProps } from '../../selection.js';
import type { BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { CAROUSEL_PICKER, CAROUSEL_SLIDE, carouselCtx } from './shared.js';

/**
 * Reactive input properties for CarouselSlide members.
 */
export interface CarouselSlideProps extends SelectionProps {
  /**
   * Explicit DOM identifier overriding automatic pair derivation.
   */
  id?: string;

  /**
   * Semantic identity matching paired TabButton name.
   */
  name: string;
}

/**
 * Compiled HTML and ARIA attributes for CarouselSlide elements.
 *
 * @template E - Target Element type
 */
export interface CarouselSlideAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  id: string;
  role: 'group';
  hidden: boolean;
  tabindex: number;
  'aria-current': string;
  'aria-labelledby': string;
  'aria-roledescription': 'slide';
}

/**
 * Slide member coordinating through the shared selection value: selected while
 * the shared value matches its own key, hidden otherwise. Position and total
 * come from DOM order, so no cross-instance registry is involved.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class CarouselSlideAria<
  E extends BaseElement = HTMLElement,
  T extends CarouselSlideProps = CarouselSlideProps,
  A extends CarouselSlideAttributes<E> = CarouselSlideAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Associated carousel selection group props.
   */
  protected group = selectionGroup.get();
  protected carousel = carouselCtx.get();

  /**
   * Guaranteed unique controller instance identifier generated at instantiation.
   */
  public id: string = `${CAROUSEL_SLIDE}-${uIndex($symbol(CAROUSEL_SLIDE), true)}`;

  /**
   * Semantic identity key resolved with fallbacks: name -> id.
   */
  public get key(): string {
    return this.properties.name ?? this.properties.id ?? this.id;
  }

  /**
   * Whether this slide's paired carousel button is currently active.
   */
  public get active() {
    return this.selected;
  }

  /**
   * Whether this slide's paired carousel button is currently active.
   */
  public get selected(): boolean {
    return this.group?.value === this.key;
  }

  /**
   * Whether the carousel is currently playing.
   */
  public get playing() {
    return !!this.carousel?.playing;
  }

  /**
   * Whether automatic advancement is active.
   */
  public get autoplay() {
    return !!this.carousel?.autoplay;
  }

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.omittedAttrs.push('id', 'label', 'name', 'data-playing');
    this.update();
  }

  /**
   * Compiles group semantics, visibility, and naming for the slide element.
   *
   * @returns Slide attributes dictionary
   */
  protected override createAttributes(): A {
    const key = this.key;
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const selfId = `${scope}${CAROUSEL_SLIDE}-${key}`;
    const buttonId = `${scope}${CAROUSEL_PICKER}-${key}`;

    return Object.assign(super.createAttributes(), {
      id: selfId,
      role: 'group',
      hidden: !this.selected,
      tabindex: -1,
      'data-playing': ariaBoolean(this.playing),
      'aria-current': ariaBoolean(this.selected),
      'aria-labelledby': buttonId,
      'aria-roledescription': 'slide',
    }) as A;
  }
}
