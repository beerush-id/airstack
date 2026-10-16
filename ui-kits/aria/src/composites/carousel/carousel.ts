import { $static, $symbol, createContext, effect, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup, type SelectionGroupProps } from '../../selection.js';
import type { AriaAttributes, AriaEventHandler, BaseElement } from '../../types.js';
import {
  CAROUSEL_BTN_SELECTOR,
  CAROUSEL_NAME,
  CAROUSEL_VIEWPORT,
  type CarouselChangeEvent,
  carouselGroup,
} from './shared.js';
import { handleRovingKey } from '../../utils/navigation.js';

export const carouselCtx = createContext<CarouselAria>();

/**
 * Reactive input properties for the Carousel root coordinator.
 *
 * The root publishes this object as-is through {@link carouselGroup}: parts
 * coordinate through these shared props plus deterministic key matching against
 * slide values, never through cross-instance references.
 */
export interface CarouselProps extends SelectionGroupProps {
  /**
   * Deterministic identity and namespace for viewport derivation.
   */
  id?: string;

  /**
   * Current slide identifier.
   */
  value?: string;

  /**
   * Wrap navigation between first and last slide.
   */
  loop?: boolean;

  /**
   * Auto-advance flag.
   */
  autoplay?: boolean;

  /**
   * Delay in milliseconds between advances (default: 5000).
   */
  interval?: number;

  /**
   * Accessible name.
   */
  label: string;

  /**
   * Called with the committed slide value after the slide advances.
   */
  onchange?: AriaEventHandler<CarouselChangeEvent>;
}

/**
 * Compiled HTML and ARIA attributes for the Carousel container element.
 *
 * @template E - Target Element type
 */
export interface CarouselAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: 'region';
  'aria-label': string;
  'aria-roledescription': 'carousel';
}

/**
 * Root sequential-slide coordinator owning the shared props, autoplay timer,
 * and container-level event dispatch. Parts discover these props through
 * {@link carouselGroup} and match slides by value keys in DOM order.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class CarouselAria<
  E extends BaseElement = HTMLElement,
  T extends CarouselProps = CarouselProps,
  A extends CarouselAttributes<E> = CarouselAttributes<E>,
> extends Aria<E, T, A> {
  /**
   * Deterministic identity and namespace for viewport derivation.
   */
  public get id(): string {
    return this.properties.id as string;
  }

  public get viewportId() {
    return `${this.id}-${CAROUSEL_VIEWPORT}`;
  }

  /**
   * Delay in milliseconds between advances.
   */
  public get interval(): number {
    return this.properties.interval ?? 5000;
  }

  /**
   * Whether automatic advancement is active.
   */
  public get autoplay(): boolean {
    return !!this.properties.autoplay;
  }

  public set autoplay(value: boolean) {
    this.properties.autoplay = value;
  }

  public get disabled() {
    return !!this.properties.disabled;
  }

  public get value() {
    return this.properties.value;
  }

  public set value(value: string | undefined) {
    this.properties.value = value;
  }

  public get pickers(): Array<HTMLElement> {
    if (!this.element) return [];
    return Array.from(this.element.querySelectorAll(CAROUSEL_BTN_SELECTOR));
  }

  public constructor(props: Partial<T> = {}) {
    super(props);

    $static(() => {
      this.properties.id = this.properties.id ?? `${CAROUSEL_NAME}-${uIndex($symbol(CAROUSEL_NAME), true)}`;
      this.properties.orientation = this.properties.orientation ?? 'horizontal';
    });

    carouselCtx.set(this as never);
    selectionGroup.set(this.properties as CarouselProps);
    carouselGroup.set(this.properties as CarouselProps);

    this.omittedAttrs.push(
      'id',
      'value',
      'loop',
      'autoplay',
      'interval',
      'label',
      'onchange',
      'ontoggle',
      'slideCount'
    );

    effect.client(() => this.play());

    this.on('pointerleave', () => this.play());
    this.on('pointerenter', () => this.pause());
    this.on('keydown', (e) => {
      handleRovingKey(this.element!, e, {
        selector: CAROUSEL_BTN_SELECTOR,
        orientation: 'horizontal',
      });
    });

    this.update();
  }

  public step(direction = 1) {
    const pickers = this.pickers;
    const current = pickers.findIndex((picker) => picker.getAttribute('aria-current') === 'true');

    if (direction === 1) {
      const last = this.properties.loop ? 0 : pickers.length - 1;
      const next = current === pickers.length - 1 ? last : current + 1;
      pickers[next].click();
    } else {
      const first = this.properties.loop ? pickers.length - 1 : 0;
      const prev = current === 0 ? first : current - 1;
      pickers[prev]?.click();
    }
  }

  protected timer: ReturnType<typeof setTimeout> | undefined;

  public play() {
    void this.value;

    if (!this.autoplay) return;

    this.pause();
    this.timer = setTimeout(() => {
      this.step();
      this.play();
    }, this.interval);

    return () => {
      this.pause();
    };
  }

  public pause() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  protected override createAttributes(): A {
    return {
      ...super.createAttributes(),
      role: 'region',
      'aria-label': this.properties.label,
      'aria-roledescription': 'carousel',
    };
  }
}
