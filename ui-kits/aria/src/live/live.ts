import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

/**
 * Announcement politeness levels a live region can compile.
 */
export type Politeness = 'polite' | 'assertive' | 'off';

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
  role?: 'status' | 'alert';
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
   * Role compiled onto a custom host when the host element does not already imply it.
   */
  protected abstract get resolvedRole(): 'status' | 'alert';

  /**
   * Politeness the role announces with when the author sets none.
   */
  protected abstract readonly defaultPoliteness: Politeness;

  /**
   * Whether the role announces its whole subtree when the author sets no preference.
   */
  protected readonly defaultAtomic: boolean = false;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);

    this.omittedAttrs.push(
      'politeness',
      'atomic',
      'busy',
      'relevant',
      'aria-live',
      'aria-atomic',
      'aria-busy',
      'aria-relevant',
    );
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
    return this.props.atomic ?? this.defaultAtomic;
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
      role: this.isNative ? undefined : this.resolvedRole,
      'aria-live': this.politeness,
      'aria-atomic': this.declaresAtomic ? ariaBoolean(this.atomic) : undefined,
      'aria-busy': this.declaresBusy ? ariaBoolean(this.busy) : undefined,
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

  /**
   * Whether busyness must be written explicitly: the author stated a value,
   * so `false` is a deliberate idle signal rather than an absent attribute.
   */
  protected get declaresBusy(): boolean {
    return this.props.busy !== undefined;
  }
}

/**
 * Reactive input properties for AnnouncerAria.
 */
export interface AnnouncerProps extends LiveRegionProps {}

/**
 * Behavioral configuration options for AnnouncerAria.
 */
export interface AnnouncerOptions extends LiveRegionOptions {}

/**
 * Headless announcer live region owning polite, atomic announcements for advisory
 * results, assertive interruptions, and append-only streams alike. Urgency is carried
 * by the `politeness` prop rather than by a separate entity: the default stays polite
 * and atomic, `politeness: 'assertive'` interrupts, and `politeness: 'off'` keeps a
 * rapidly changing region identified but silent.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class AnnouncerAria<
  E extends BaseElement = HTMLElement,
  T extends AnnouncerProps = AnnouncerProps,
  A extends LiveRegionAttributes<E> = LiveRegionAttributes<E>,
  O extends AnnouncerOptions = AnnouncerOptions,
> extends LiveRegionAria<E, T, A, O> {
  protected override readonly defaultPoliteness: Politeness = 'polite';
  protected override readonly defaultAtomic = true;

  /**
   * Assertive announcers interrupt as `alert`; every other tuning waits as `status`.
   */
  protected override get resolvedRole(): 'status' | 'alert' {
    return this.politeness === 'assertive' ? 'alert' : 'status';
  }
}
