import { SelectionAria, type SelectionOptions, type SelectionProps } from '../../selection.js';
import type { AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean, ariaPresent } from '../../utils/attributes.js';
import type { ButtonAttributes } from '../../widgets/button.js';
import { CAROUSEL_PICKER, CAROUSEL_SLIDE, carouselCtx } from './shared.js';

/**
 * Reactive input properties for CarouselPicker indicator buttons.
 */
export interface CarouselPickerProps extends AriaProps {
  /**
   * Explicit DOM identifier of the trigger.
   */
  id?: string;

  /**
   * Semantic identity matching paired TabPanel name.
   */
  name: string;

  /**
   * Text label for the slide.
   */
  label: string;

  /**
   * Initial selection hint when parent is uncontrolled.
   */
  selected?: boolean;

  /**
   * Whether this tab button is disabled from user interaction.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for CarouselPicker buttons.
 *
 * @template E - Target Element type
 */
export interface CarouselPickerAttributes<E extends BaseElement = HTMLButtonElement> extends ButtonAttributes<E> {
  id: string;
  role?: 'button';
  type?: 'button';
  disabled?: boolean;
  tabindex?: number;
  'aria-label': string;
  'aria-current': 'true' | 'false';
  'aria-disabled': 'true' | 'false';
  'aria-controls': string;
  'aria-roledescription': 'indicator';
}

/**
 * Slide indicator button selecting its target slide by value key.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class CarouselPickerAria<
  E extends BaseElement = HTMLButtonElement,
  T extends CarouselPickerProps = CarouselPickerProps,
  A extends CarouselPickerAttributes<E> = CarouselPickerAttributes<E>,
> extends SelectionAria<E, CarouselPickerProps, A> {
  protected carousel = carouselCtx.get();

  /**
   * Whether the slide is currently selected.
   */
  public get active() {
    return this.selected;
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

  public constructor(props: Partial<T> = {}, options?: SelectionOptions) {
    super(props as SelectionProps, {
      native: true,
      ...options,
      role: 'radio',
      valueKey: 'name',
      required: true,
      clickable: true,
    });

    this.omittedAttrs.push('label', 'aria-controls');
    this.update();
  }

  protected override createAttributes(): A {
    const scope = this.group?.id ? `${this.group.id}-` : '';
    const value = this.value;
    const isSelected = this.active;

    const selfId = `${scope}${CAROUSEL_PICKER}-${value}`;
    const panelId = `${scope}${CAROUSEL_SLIDE}-${value}`;

    return Object.assign(super.createAttributes(), {
      id: selfId,
      role: this.isNative ? undefined : 'button',
      type: this.isNative ? 'button' : undefined,
      disabled: this.isNative ? this.disabled : undefined,
      tabindex: -1,
      'aria-label': this.properties.label,
      'aria-current': ariaPresent(isSelected),
      'aria-disabled': this.isNative ? undefined : ariaBoolean(this.disabled),
      'aria-controls': panelId,
      'aria-roledescription': 'carousel-indicator',
    }) as A;
  }
}
