import type { AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ButtonAria, type ButtonAttributes, type ButtonProps } from '../../widgets/button.js';
import { carouselCtx } from './carousel.js';

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
  protected readonly group = carouselCtx.get();

  public override get disabled() {
    return !!(super.disabled || this.group?.disabled);
  }

  /**
   * Stepping direction carried by the role options.
   */
  private get direction(): 1 | -1 {
    return this.properties.direction ?? 1;
  }

  public constructor(props: Partial<AriaProps> = {}, options?: AriaOptions) {
    super(props, { native: true, ...options });
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
    return Object.assign(super.createAttributes(), {
      'aria-label': this.properties.label,
      'aria-controls': this.group?.viewportId,
      'aria-roledescription': this.direction === 1 ? 'next' : 'prev',
    }) as A;
  }

  /**
   * Activates the navigation direction on the shared value.
   */
  protected activate = (): void => {
    if (!this.group || this.disabled || this.group.disabled) return;
    this.group?.step(this.direction);
  };
}
