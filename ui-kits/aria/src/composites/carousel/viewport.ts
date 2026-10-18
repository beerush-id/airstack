import { $static } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { carouselCtx } from './shared.js';

export interface CarouselViewportProps extends AriaProps {
  label: string;
}

/**
 * Compiled HTML and ARIA attributes for the CarouselViewport element.
 *
 * @template E - Target Element type
 */
export interface CarouselViewportAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id: string;
  role: 'group';
  tabindex: number;
  'aria-live': 'off' | 'polite';
  'aria-atomic': 'false';
  'aria-roledescription': 'slides';
}

/**
 * Focusable scroll viewport owning arrow-key traversal, live-region politeness,
 * and the stable identifier addressed by navigation, picker, and player controls.
 * Travels DOM order by value keys against shared props.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class CarouselViewportAria<
  E extends BaseElement = HTMLElement,
  A extends CarouselViewportAttributes<E> = CarouselViewportAttributes<E>,
> extends Aria<E, CarouselViewportProps, A> {
  private readonly carousel = carouselCtx.get();

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

  public constructor(props: Partial<AriaProps> = {}) {
    super(props);
    this.omittedAttrs.push('id', 'label', 'tabindex', 'aria-live', 'aria-atomic');
    this.initialize();
    this.update();
  }

  /**
   * Compiles focus, live-region, and keyboard attributes for the viewport element.
   *
   * @returns Viewport attributes dictionary
   */
  protected override createAttributes(): A {
    const carousel = this.carousel;

    return Object.assign(super.createAttributes(), {
      id: carousel?.viewportId,
      role: 'group',
      tabindex: 0,
      'aria-live': carousel?.playing ? 'off' : 'polite',
      'aria-label': this.properties.label,
      'aria-atomic': 'false',
      'aria-roledescription': 'carousel-slides',
    }) as A;
  }

  protected initialize() {
    let prevAutoplay = $static(() => this.autoplay);

    const pause = () => {
      if (!this.carousel) return;
      prevAutoplay = this.autoplay;
      this.carousel.autoplay = false;
      announce();
    };

    const resume = () => {
      if (!this.carousel) return;
      this.carousel.autoplay = prevAutoplay;
      announce();
    };

    const announce = () => {
      const toggle = new CustomEvent('toggle', { bubbles: true, detail: this.autoplay, cancelable: true });
      this.element?.dispatchEvent(toggle);
      this.dispatch(toggle);
    };

    this.on('focusin', pause);
    this.on('focusout', resume);

    this.on('pointerenter', pause);
    this.on('pointerleave', resume);
  }
}
