import { $static, $symbol, createContext, effect, mutable, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';

/**
 * Ambient instance context for the enclosing TimePicker, read by its segments.
 */
export const timePickerCtx = createContext<TimePickerAria>();

const ROLE_TIMEPICKER = 'time-picker';
const SEGMENT_SELECTOR = '[role="spinbutton"]';

/** The parts a time is edited in, by index. */
export const TIME_PART = { HOUR: 0, MINUTE: 1, PERIOD: 2 } as const;

/** Names for the parts of a time, each read by the segment that edits it. */
export type TimePartLabels = { hour?: string; minute?: string; period?: string };

const PART_NAMES = ['hour', 'minute', 'period'] as const;

/**
 * Reactive input properties for TimePickerAria.
 */
export interface TimePickerProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * The time as `HH:MM` on a 24-hour clock, whatever clock the parts show.
   */
  value?: string;

  /**
   * Accessible name for the group of parts.
   */
  label?: string;

  /**
   * Accessible names for the parts; a segment's own `label` wins over its part's.
   */
  labels?: TimePartLabels;

  /**
   * Whether user interaction is disabled across all parts.
   */
  disabled?: boolean;

  /**
   * Called with the new value when a part changes it.
   */
  onchange?: AriaEventHandler<AriaEvent<string | undefined>>;
}

/**
 * Behavioral configuration options for TimePickerAria.
 */
export interface TimePickerOptions extends AriaOptions {
  /**
   * A 12-hour clock with a period part, or a 24-hour one. Defaults to the locale's.
   */
  hourCycle?: 12 | 24;

  /**
   * Locales that name the periods and format the time.
   */
  locales?: string[];

  /**
   * Minutes between the minute part's tokens. Defaults to 1.
   */
  step?: number;
}

/**
 * Compiled HTML and ARIA attributes for a time picker group.
 *
 * @template E - Target Element type
 */
export interface TimePickerAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-label'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless time-of-day coordinator. It owns the value and the parts it reads
 * as — hour, minute, and the period on a 12-hour clock — each a token from its
 * own list. The parts follow the value one way; a segment reads only its own
 * part and writes through `setPart`, so a change reaches only the segment
 * whose part moved.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class TimePickerAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  TimePickerProps,
  TimePickerAttributes<E>,
  TimePickerOptions
> {
  /**
   * Whether the parts show a 12-hour clock with a period part.
   */
  public readonly twelve: boolean;

  /**
   * The locale's names for the periods, keyed by token.
   */
  public readonly periodNames: Record<string, string>;

  /**
   * The value read as part tokens, e.g. `['09', '30', 'pm']`; every part is
   * undefined while no time is set. Read a part by its index; write through
   * `setPart`.
   */
  public readonly parts: (string | undefined)[];

  private readonly lists: string[][];

  public constructor(props: Partial<TimePickerProps> = {}, options: TimePickerOptions = {}) {
    super(props, { native: false, ...options });

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_TIMEPICKER}-${uIndex($symbol(ROLE_TIMEPICKER), true)}`;
    });

    const { hourCycle, locales, step = 1 } = this.options;
    this.twelve = hourCycle ? hourCycle === 12 : localeIsTwelveHour(locales);
    this.periodNames = { am: periodName(locales, 9), pm: periodName(locales, 21) };

    // A 12-hour list starts at 12, so an hour's position is its hour within the period.
    const hours = this.twelve ? [12, ...range(1, 12, 1)] : range(0, 24, 1);
    this.lists = [hours.map(pad), range(0, 60, Math.max(1, step)).map(pad)];
    if (this.twelve) this.lists.push(['am', 'pm']);

    this.parts = mutable(this.lists.map(() => undefined as string | undefined));

    // The parts follow the value, one way: each index is written on its own, so only a part that moved notifies.
    effect(() => {
      const next = this.read(this.properties.value);
      next.forEach((token, index) => {
        this.parts[index] = token;
      });
    });

    timePickerCtx.set(this as unknown as TimePickerAria);
    this.omittedAttrs.push('id', 'value', 'label', 'labels', 'onchange', 'aria-label', 'aria-disabled');

    this.update();
  }

  /**
   * Whether a time is set.
   */
  public get set(): boolean {
    return !!readTime(this.properties.value);
  }

  /**
   * The time formatted for the locale and clock, or an empty string while none is set.
   */
  public get text(): string {
    const time = readTime(this.properties.value);
    if (!time) return '';

    return new Intl.DateTimeFormat(this.options.locales, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: this.twelve,
    }).format(new Date(2000, 0, 1, time.hour, time.minute));
  }

  /**
   * Whether user interaction is disabled across all parts.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * The tokens a part steps through, in order.
   *
   * @param index - The part's index.
   * @returns Its token list.
   */
  public tokens(index: number): string[] {
    return this.lists[index] ?? [];
  }

  /**
   * The numbers a part can hold, whatever its step: the hours of the clock, every
   * minute of the hour, or the period's two positions.
   *
   * @param index - The part's index.
   * @returns Its lowest and highest number.
   */
  public bounds(index: number): [number, number] {
    if (index === TIME_PART.HOUR) return this.twelve ? [1, 12] : [0, 23];
    if (index === TIME_PART.MINUTE) return [0, 59];
    return [0, 1];
  }

  /**
   * A part's name, from the picker's `labels`.
   *
   * @param index - The part's index.
   * @returns Its name, or undefined when none is given.
   */
  public partLabel(index: number): string | undefined {
    return this.properties.labels?.[PART_NAMES[index]];
  }

  /**
   * What a token reads as: a period's locale name, or the token itself.
   *
   * @param index - The part's index.
   * @param token - The token.
   * @returns Its text.
   */
  public textOf(index: number, token: string): string {
    return index === TIME_PART.PERIOD ? (this.periodNames[token] ?? token) : token;
  }

  /**
   * Writes one part by composing the value from all of them; parts not yet set
   * take their list's first token. The parts then follow the new value. Fires
   * `change` with it.
   *
   * @param index - The part's index.
   * @param token - The token to write.
   */
  public setPart(index: number, token: string): void {
    if (this.parts[index] === token) return;

    const parts = this.parts.map((part, i) => part ?? this.lists[i][0]);
    parts[index] = token;

    const offset = this.twelve && parts[TIME_PART.PERIOD] === 'pm' ? 12 : 0;
    const hour = this.lists[TIME_PART.HOUR].indexOf(parts[TIME_PART.HOUR]) + offset;
    const next = `${pad(hour)}:${parts[TIME_PART.MINUTE]}`;

    this.properties.value = next;

    const event = new CustomEvent('change', { bubbles: true, detail: next, cancelable: true });
    this.element?.dispatchEvent(event);
    this.properties.onchange?.(event);
  }

  /**
   * Moves focus to a part's segment, when one is rendered for it.
   *
   * @param index - The part's index.
   */
  public focusPart(index: number): void {
    const element = this.element as unknown as HTMLElement | undefined;
    element?.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)[index]?.focus();
  }

  /**
   * Computes HTML and ARIA attributes for the time picker group.
   */
  protected override createAttributes(): TimePickerAttributes<E> {
    return Object.assign(super.createAttributes(), {
      id: this.properties.id,
      role: 'group',
      'aria-label': this.properties.label,
      'aria-disabled': ariaBoolean(this.disabled),
    }) as TimePickerAttributes<E>;
  }

  /**
   * A value read as part tokens on this picker's clock.
   *
   * @param value - The value, e.g. `14:30`.
   * @returns One token per part, all undefined when it is not a time.
   */
  private read(value?: string): (string | undefined)[] {
    const time = readTime(value);
    if (!time) return this.lists.map(() => undefined);

    const { hour, minute } = time;
    const parts = [this.lists[TIME_PART.HOUR][this.twelve ? hour % 12 : hour], pad(minute)];
    if (this.twelve) parts.push(hour >= 12 ? 'pm' : 'am');
    return parts;
  }
}

/**
 * The hour and minute of an `HH:MM` value.
 *
 * @param value - The value, e.g. `14:30`.
 * @returns Its hour on a 24-hour clock and its minute, or undefined when it is not a time.
 */
function readTime(value?: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  if (!match) return;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return;
  return { hour, minute };
}

/**
 * Whether the locale reads time on a 12-hour clock.
 *
 * @param locales - The locales to ask.
 * @returns True for a 12-hour clock.
 */
function localeIsTwelveHour(locales?: string[]): boolean {
  const cycle = new Intl.DateTimeFormat(locales, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h11' || cycle === 'h12';
}

/**
 * The locale's own name for the half of the day an hour falls in, e.g. "AM".
 *
 * @param locales - The locales to ask.
 * @param hour - An hour in that half.
 * @returns The name.
 */
function periodName(locales: string[] | undefined, hour: number): string {
  const parts = new Intl.DateTimeFormat(locales, { hour: 'numeric', hour12: true }).formatToParts(
    new Date(2000, 0, 1, hour)
  );
  return parts.find((part) => part.type === 'dayPeriod')?.value ?? '';
}

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value < end; value += step) values.push(value);
  return values;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
