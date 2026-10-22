import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ButtonAria, type ButtonAttributes } from '../../widgets/button.js';

import { carouselCtx } from './shared.js';

export interface CarouselPlayerProps {
  label?: string;
  playingLabel?: string;
}

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
> extends ButtonAria<E, CarouselPlayerProps, A> {
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
    return super.disabled || this.carousel?.disabled || (this.carousel?.state?.total ?? 0) < 2;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, { native: true, ...options, clickable: true });
    this.omittedAttrs.push('aria-label', 'aria-controls', 'label', 'playingLabel');
    this.on('click', this.handleToggle);
    this.update();
  }

  /**
   * Compiles label swap, control association, and autoplay toggle for the player.
   *
   * @returns Player attributes dictionary
   */
  protected override createAttributes(): A {
    const { label, playingLabel } = this.properties;
    return Object.assign(super.createAttributes(), {
      'aria-label': this.autoplay && playingLabel ? playingLabel : label,
      'aria-controls': this.carousel?.viewportId,
    }) as A;
  }

  /**
   * Flips autoplay on the enclosing carousel and announces the new state.
   */
  private readonly handleToggle = (event: MouseEvent): void => {
    const group = this.carousel;
    if (!group || this.disabled || event.defaultPrevented) return;
    group.autoplay = !group.autoplay;

    const toggle = new CustomEvent('toggle', { bubbles: true, detail: group.autoplay, cancelable: true });
    this.element?.dispatchEvent(toggle);
    this.dispatch(toggle);
  };
}
