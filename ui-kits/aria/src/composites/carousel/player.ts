import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { ButtonAria, type ButtonAttributes } from '../../widgets/button.js';

import { carouselCtx } from './shared.js';

/**
 * Compiled HTML and ARIA attributes for CarouselPlayer buttons.
 *
 * @template E - Target Element type
 */
export interface CarouselPlayerAttributes<E extends BaseElement = HTMLButtonElement> extends ButtonAttributes<E> {
  type?: 'button';
  'aria-label': string;
  'aria-controls': string;
}

/**
 * Play/pause autoplay button toggling rotation through label swap.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export class CarouselPlayerAria<
  E extends BaseElement = HTMLButtonElement,
  A extends CarouselPlayerAttributes<E> = CarouselPlayerAttributes<E>,
> extends ButtonAria<E, AriaProps, A> {
  protected readonly carousel = carouselCtx.get();

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

  /**
   * Whether rotation control is available: several slides present.
   */
  public override get disabled(): boolean {
    return !!(super.disabled || this.carousel?.disabled);
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, { native: true, ...options });
    this.omittedAttrs.push('aria-label', 'aria-controls', 'data-playing');
    this.on('click', this.handleToggle);
    this.update();
  }

  /**
   * Compiles label swap, control association, and autoplay toggle for the player.
   *
   * @returns Player attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      'aria-label': this.properties.label,
      'aria-controls': this.carousel?.viewportId,
      'data-playing': ariaBoolean(this.playing),
    }) as A;
  }

  /**
   * Flips autoplay on the enclosing carousel and announces the new state.
   */
  private readonly handleToggle = (event: MouseEvent): void => {
    const group = this.carousel;
    if (!group || this.disabled || event.defaultPrevented) return;
    group.autoplay = !group.autoplay;
  };
}
