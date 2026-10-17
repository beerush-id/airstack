import { $static, $symbol, derived, effect, isBrowser, mutable, uIndex, untrack } from '@airlib/core';
import { Aria } from '../../core.js';
import { selectionGroup, type SelectionGroupProps } from '../../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, BaseElement, DetachFn } from '../../types.js';
import { CURRENT_QUERY } from '../../utils/attributes.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { CAROUSEL_INDICATOR, CAROUSEL_INTERVAL, CAROUSEL_NAME, CAROUSEL_VIEWPORT, carouselCtx } from './shared.js';

/**
 * Controller-dispatched carousel event carrying the committed slide value in `detail`.
 */
export type CarouselChangeEvent = AriaEvent<string | null>;

/**
 * Reactive input properties for the Carousel root coordinator.
 *
 * The root publishes this object as-is through {@link carouselCtx}: parts
 * coordinate through these shared props plus deterministic key matching against
 * slide values, never through cross-instance references.
 */
export interface CarouselProps extends SelectionGroupProps {
  /**
   * Deterministic identity and namespace for viewport derivation.
   */
  id?: string;

  /**
   * List of slide keys.
   */
  keys?: string[];

  /**
   * Current slide identifier.
   */
  value?: string;

  /**
   * Accessible name.
   */
  label: string;

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
   * Enable arrow key navigation.
   */
  arrowNav?: boolean;

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

export interface CarouselState {
  last: number;
  loop: boolean;
  total: number;
  current: number;
}

/**
 * Root sequential-slide coordinator owning the shared props, autoplay timer,
 * and container-level event dispatch. Parts discover these props through
 * {@link carouselCtx} and match slides by value keys in DOM order.
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
  protected timer = mutable<ReturnType<typeof setTimeout> | undefined>(undefined);

  public state: CarouselState;

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
   * Whether automatic advancement is active.
   */
  public get autoplay(): boolean {
    return !!this.properties.autoplay;
  }

  /**
   * Set automatic advancement flag.
   * @param {boolean} value
   */
  public set autoplay(value: boolean) {
    this.properties.autoplay = value;
  }

  /**
   * Whether the carousel is disabled.
   */
  public get disabled() {
    return !!this.properties.disabled;
  }

  /**
   * Currently selected slide key.
   */
  public get value() {
    return this.properties.value;
  }

  /**
   * Set currently selected slide key.
   * @param {string | undefined} value
   */
  public set value(value: string | undefined) {
    this.properties.value = value;
  }

  /**
   * Whether the carousel is currently playing.
   */
  public get playing() {
    return !!this.timer.value;
  }

  /**
   * Get the list of picker elements.
   */
  public get pickers(): Array<HTMLElement> {
    if (!this.element) return [];
    return Array.from(this.element.querySelectorAll(CAROUSEL_INDICATOR));
  }

  /**
   * @param {Partial<CarouselProps>} props
   */
  public constructor(props: Partial<T> = {}) {
    super(props);

    $static(() => {
      this.properties.id = this.properties.id ?? `${CAROUSEL_NAME}-${uIndex($symbol(CAROUSEL_NAME), true)}`;
      this.properties.orientation = this.properties.orientation ?? 'horizontal';
      if (!Array.isArray(this.properties.keys)) this.properties.keys = [];
    });

    carouselCtx.set(this as never);
    selectionGroup.set(this.properties as CarouselProps);

    this.omittedAttrs.push(
      'id',
      'keys',
      'loop',
      'label',
      'value',
      'autoplay',
      'interval',
      'onchange',
      'ontoggle',
      'slideCount'
    );

    this.state = derived.as(() => ({
      last: this.properties.keys!.length - 1,
      loop: !!this.properties.loop,
      total: this.properties.keys!.length,
      current: this.properties.keys!.indexOf(this.value!) ?? 0,
    }));

    this.on('pointerenter', () => this.pause());
    this.on('pointerleave', () => this.play());

    this.on('keydown', (e) => {
      if (this.properties.arrowNav === false) return;
      this.step(1, e);
    });

    this.update();
  }

  /**
   * Step to the next or previous slide.
   * @param {number} direction - The direction to step
   * @param {KeyboardEvent} e - The keyboard event
   */
  public step(direction = 1, e?: KeyboardEvent) {
    if (!isBrowser()) return;

    const event = e ?? new KeyboardEvent('keydown', { key: direction === 1 ? 'ArrowRight' : 'ArrowLeft' });
    handleRovingKey(this.element!, event, {
      loop: this.state.loop,
      focus: false,
      selector: CAROUSEL_INDICATOR,
      activeSelector: CURRENT_QUERY,
      orientation: 'horizontal',
    });
  }

  /**
   * Start automatic advancement.
   */
  public play() {
    this.pause();

    if (!isBrowser() || !this.autoplay) return;

    untrack(() => {
      if (!this.state.loop && this.state.current === this.state.last) {
        this.autoplay = false;
        return;
      }

      this.timer.value = setTimeout(() => {
        this.step();
        this.play();
      }, this.properties.interval ?? CAROUSEL_INTERVAL);

      return () => {
        this.pause();
      };
    });
  }

  /**
   * Stop automatic advancement.
   */
  public pause() {
    if (!isBrowser()) return;

    untrack(() => {
      clearTimeout(this.timer.value);
      this.timer.value = undefined;
    });
  }

  /**
   * Destroy the Carousel.
   */
  public override destroy() {
    this.pause();
    super.destroy();
  }

  /**
   * Attach the Carousel.
   */
  protected override attach(): DetachFn | void {
    return effect.client(() => {
      void this.value;
      this.play();
    });
  }

  /**
   * Create the Carousel attributes.
   */
  protected override createAttributes(): A {
    return {
      ...super.createAttributes(),
      role: 'region',
      'aria-label': this.properties.label,
      'aria-roledescription': 'carousel',
    };
  }
}
