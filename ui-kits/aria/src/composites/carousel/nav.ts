import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ButtonAria, type ButtonAttributes, type ButtonProps } from '../../widgets/button.js';

import { carouselCtx } from './shared.js';

export interface CarouselNavProps extends ButtonProps {
  /**
   * Label for the navigation button.
   */
  label?: string;

  /**
   * Stepping direction: 1 forward, -1 backward.
   */
  direction: 1 | -1;
}

/**
 * Compiled HTML and ARIA attributes for CarouselPrevious / CarouselNext buttons.
 *
 * @template E - Target Element type
 */
export interface CarouselNavAttributes<E extends BaseElement = HTMLButtonElement> extends ButtonAttributes<E> {
  type?: 'button';
  'aria-label': string;
}

/**
 * Previous / next slide button stepping the shared value in its direction
 * and disabling itself at the bound it has nowhere left to go. Matches slides
 * by value keys in DOM order against shared props.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template A - Compiled attributes dictionary type
 * @template O - Options configuration type
 */
export class CarouselNavAria<
  E extends BaseElement = HTMLButtonElement,
  A extends CarouselNavAttributes<E> = CarouselNavAttributes<E>,
> extends ButtonAria<E, CarouselNavProps, A> {
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
   * Whether the button is disabled.
   */
  public override get disabled() {
    return super.disabled || this.carousel?.disabled || (this.carousel?.state?.total ?? 0) < 2;
  }

  /**
   * Stepping direction carried by props: 1 forward, -1 backward.
   */
  private get direction(): 1 | -1 {
    return this.properties.direction ?? 1;
  }

  public constructor(props: Partial<AriaProps> = {}, options?: AriaOptions) {
    super(props, options);
    this.omittedAttrs.push('label', 'direction');
    this.on('click', this.activate);
    this.update();
  }

  /**
   * Compiles label, control association, and activation for the nav button.
   *
   * @returns Nav attributes dictionary
   */
  protected override createAttributes(): A {
    const attrs = super.createAttributes();
    const state = this.carousel?.state;
    const isNext = this.direction === 1;
    const canStep = !(isNext ? state?.current === state?.last : state?.current === 0);
    const disabled = this.disabled || (!state?.loop && !canStep);

    if (this.isNative) {
      Object.assign(attrs, {
        disabled,
      });
    } else {
      Object.assign(attrs, {
        'aria-disabled': disabled ? 'true' : 'false',
      });
    }

    Object.assign(attrs, {
      'aria-label': this.properties.label,
      'aria-controls': this.carousel?.viewportId,
      'aria-roledescription': isNext ? 'carousel-next' : 'carousel-prev',
    });

    return attrs;
  }

  /**
   * Activates the navigation direction on the shared value.
   */
  protected activate = (): void => {
    this.carousel?.step(this.direction);
  };
}
