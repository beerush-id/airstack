import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { carouselCtx } from './carousel.js';

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
  private readonly group = carouselCtx.get();

  public constructor(props: Partial<AriaProps> = {}) {
    super(props);
    this.omittedAttrs.push('id', 'label', 'tabindex', 'aria-live', 'aria-atomic');
    this.update();
  }

  /**
   * Compiles focus, live-region, and keyboard attributes for the viewport element.
   *
   * @returns Viewport attributes dictionary
   */
  protected override createAttributes(): A {
    const group = this.group;

    return Object.assign(super.createAttributes(), {
      id: group?.viewportId,
      role: 'group',
      tabindex: 0,
      'aria-live': group?.autoplay ? 'off' : 'polite',
      'aria-label': this.properties.label,
      'aria-atomic': 'false',
      'aria-roledescription': 'slides',
    }) as A;
  }
}
