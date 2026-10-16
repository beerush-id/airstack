import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ButtonAria, type ButtonAttributes } from '../../widgets/button.js';
import { carouselCtx } from './carousel.js';

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
  protected readonly group = carouselCtx.get();

  public get playing() {
    return !!this.group?.autoplay;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, { native: true, ...options });
    this.omittedAttrs.push('aria-label', 'aria-controls');
    this.update();
  }

  /**
   * Whether rotation control is available: several slides present.
   */
  public override get disabled(): boolean {
    return !!(super.disabled || this.group?.disabled);
  }

  /**
   * Compiles label swap, control association, and autoplay toggle for the player.
   *
   * @returns Player attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      'aria-label': this.properties.label,
      onclick: this.handleToggle,
    }) as A;
  }

  /**
   * Flips autoplay on the enclosing carousel and announces the new state.
   */
  private readonly handleToggle = (event: MouseEvent): void => {
    const group = this.group;
    if (!group || this.disabled || event.defaultPrevented) return;
    group.autoplay = !group.autoplay;
  };
}
