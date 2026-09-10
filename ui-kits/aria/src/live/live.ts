import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

/**
 * Announcement politeness levels a live region can compile.
 */
export type Politeness = 'polite' | 'assertive' | 'off';

/**
 * WAI-ARIA live region roles compiled by this family.
 */
export type LiveRole = 'alert' | 'status' | 'log' | 'timer' | 'marquee';

/**
 * Reactive input properties shared by every live region.
 */
export interface LiveRegionProps extends AriaProps {
  /**
   * Politeness level for announcements, defaulting to the value the role implies.
   */
  politeness?: Politeness;

  /**
   * Whether the whole region is announced as one unit rather than per mutation.
   */
  atomic?: boolean;

  /**
   * Whether the region is currently loading or updating, suppressing announcements.
   */
  busy?: boolean;

  /**
   * Relevant change kinds to monitor, compiled to aria-relevant.
   */
  relevant?: string;
}

/**
 * Behavioral configuration options for live regions bound to a native host.
 */
export interface LiveRegionOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a live region element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface LiveRegionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: LiveRole;
  'aria-live'?: Politeness;
  'aria-atomic'?: 'true' | 'false';
  'aria-busy'?: 'true' | 'false';
  'aria-relevant'?: string;
}

/**
 * Headless WAI-ARIA live region base compiling the announcement tuning a role implies,
 * so an author can override politeness or atomicity without restating the rest. Live
 * regions take no focus and own no keyboard behavior: the container must already be in
 * the DOM before content is inserted, or assistive technologies never register it.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export abstract class LiveRegionAria<
  E extends BaseElement = HTMLElement,
  T extends LiveRegionProps = LiveRegionProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
  O extends LiveRegionOptions = LiveRegionOptions,
> extends Aria<E, T, A, O> {
  /**
   * WAI-ARIA role compiled when the host element does not already imply it.
   */
  protected abstract readonly liveRole: LiveRole;

  /**
   * Politeness the role announces with when the author sets none.
   */
  protected abstract readonly defaultPoliteness: Politeness;

  /**
   * Whether the role announces its whole subtree when the author sets no preference.
   */
  protected readonly defaultAtomic?: boolean;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    this.omittedAttrs.push('aria-live', 'aria-atomic', 'aria-busy', 'aria-relevant');
    this.update();
  }

  /**
   * Politeness level announcements are compiled with.
   */
  public get politeness(): Politeness {
    return this.props.politeness ?? this.defaultPoliteness;
  }

  /**
   * Whether the whole region is announced as one unit.
   */
  public get atomic(): boolean {
    return this.props.atomic ?? this.defaultAtomic ?? false;
  }

  /**
   * Whether the region is currently loading or updating.
   */
  public get busy(): boolean {
    return !!this.props.busy;
  }

  /**
   * Computes the HTML and ARIA attributes for the live region.
   *
   * @returns Live region attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: this.isNative ? undefined : this.liveRole,
      'aria-live': this.politeness,
      'aria-atomic': this.declaresAtomic ? ariaBoolean(this.atomic) : undefined,
      'aria-busy': this.busy ? 'true' : undefined,
      'aria-relevant': this.props.relevant,
    }) as A;
  }

  /**
   * Whether atomicity must be written explicitly: either it is on, or the author
   * overrode the value the role already implies.
   */
  protected get declaresAtomic(): boolean {
    return this.props.atomic !== undefined || this.atomic;
  }
}

/**
 * Reactive input properties for AlertAria.
 */
export interface AlertProps extends LiveRegionProps {}

/**
 * Headless WAI-ARIA alert live region announcing time-sensitive messages assertively
 * and atomically, without taking focus.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class AlertAria<
  E extends BaseElement = HTMLElement,
  T extends AlertProps = AlertProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
> extends LiveRegionAria<E, T, A> {
  protected override readonly liveRole: LiveRole = 'alert';
  protected override readonly defaultPoliteness: Politeness = 'assertive';
  protected override readonly defaultAtomic = true;

  public constructor(props: Partial<T> = {}) {
    super(props);
  }
}

/**
 * Reactive input properties for StatusAria.
 */
export interface StatusProps extends LiveRegionProps {}

/**
 * Behavioral configuration options for StatusAria.
 */
export interface StatusOptions extends LiveRegionOptions {}

/**
 * Headless WAI-ARIA status live region announcing advisory messages politely and
 * atomically, bound to a native `<output>` element by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class StatusAria<
  E extends BaseElement = HTMLElement,
  T extends StatusProps = StatusProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
  O extends StatusOptions = StatusOptions,
> extends LiveRegionAria<E, T, A, O> {
  protected override readonly liveRole: LiveRole = 'status';
  protected override readonly defaultPoliteness: Politeness = 'polite';
  protected override readonly defaultAtomic = true;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });
  }
}

/**
 * Reactive input properties for LogAria.
 */
export interface LogProps extends LiveRegionProps {}

/**
 * Headless WAI-ARIA log live region announcing an append-only stream politely, entry by
 * entry rather than as a whole, so history updates never interrupt each other.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class LogAria<
  E extends BaseElement = HTMLElement,
  T extends LogProps = LogProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
> extends LiveRegionAria<E, T, A> {
  protected override readonly liveRole: LiveRole = 'log';
  protected override readonly defaultPoliteness: Politeness = 'polite';
  protected override readonly defaultAtomic = false;

  public constructor(props: Partial<T> = {}) {
    super(props);
  }
}

/**
 * Reactive input properties for TimerAria.
 */
export interface TimerProps extends LiveRegionProps {
  /**
   * Current elapsed or remaining time.
   */
  value?: number | string;
}

/**
 * Headless WAI-ARIA timer live region holding a counter with announcements off by
 * default, so a ticking second never interrupts the user. The elapsed value is held as
 * reactive state for the consumer to render and to announce at meaningful milestones.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class TimerAria<
  E extends BaseElement = HTMLElement,
  T extends TimerProps = TimerProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
> extends LiveRegionAria<E, T, A> {
  protected override readonly liveRole: LiveRole = 'timer';
  protected override readonly defaultPoliteness: Politeness = 'off';

  public constructor(props: Partial<T> = {}) {
    super(props);
  }

  /**
   * Current elapsed or remaining time.
   */
  public get value(): number | string | undefined {
    return this.props.value;
  }

  public set value(next: number | string | undefined) {
    this.props.value = next;
  }
}

/**
 * Reactive input properties for MarqueeAria.
 */
export interface MarqueeProps extends LiveRegionProps {
  /**
   * Whether the ticker stream is currently paused.
   */
  paused?: boolean;
}

/**
 * Headless WAI-ARIA marquee live region holding a rapidly changing ticker with
 * announcements off by default. The pause state is held as reactive state; suspending
 * the animation itself belongs to the consumer.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class MarqueeAria<
  E extends BaseElement = HTMLElement,
  T extends MarqueeProps = MarqueeProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
> extends LiveRegionAria<E, T, A> {
  protected override readonly liveRole: LiveRole = 'marquee';
  protected override readonly defaultPoliteness: Politeness = 'off';

  public constructor(props: Partial<T> = {}) {
    super(props);
  }

  /**
   * Whether the ticker stream is currently paused.
   */
  public get paused(): boolean {
    return !!this.props.paused;
  }

  public set paused(next: boolean) {
    this.props.paused = next;
  }
}
