import { createContext } from '@airlib/core';
import type { AriaEvent } from '../../types.js';
import type { CarouselProps } from './carousel.js';

export const CAROUSEL_NAME = 'carousel';
export const CAROUSEL_SLIDE = 'slide';
export const CAROUSEL_PICKER = 'picker';
export const CAROUSEL_VIEWPORT = 'viewport';
export const CAROUSEL_BTN_SELECTOR = '[aria-roledescription="indicator"]:not(:disabled, [aria-disabled="true"])';

/**
 * Controller-dispatched carousel event carrying the committed slide value in `detail`.
 */
export type CarouselChangeEvent = AriaEvent<string | null>;

/**
 * Controller-dispatched carousel event carrying the committed autoplay state in `detail`.
 */
export type CarouselToggleEvent = AriaEvent<boolean>;

export const ROLE_CAROUSEL_VIEWPORT = 'carousel-viewport';

/**
 * Slide value transport attribute rendered on every slide element. Slide order
 * is read from the DOM in document order through this key, so coordination
 * stays deterministic without any cross-instance registry.
 */
export const SLIDE_VALUE_ATTRIBUTE = 'data-carousel-value';

/**
 * Ambient context publishing the enclosing carousel's reactive props.
 * Parts match by slide-value keys against these shared props, the same shape
 * as {@link selectionGroup} coordination in tabs.
 */
export const carouselGroup = createContext<CarouselProps>();

/**
 * Slide identifiers in DOM order, the single source of truth for membership.
 *
 * @param group - Enclosing carousel shared props
 * @returns Slide values in document order, or empty when unmounted
 */
export function querySlideValues(group: CarouselProps | null | undefined): string[] {
  if (!group?.id || typeof document === 'undefined') {
    return [];
  }

  const viewport = document.getElementById(`${group.id}-viewport`);
  if (!viewport) {
    return [];
  }

  const nodes = Array.from(viewport.querySelectorAll(`[${SLIDE_VALUE_ATTRIBUTE}]`));
  const values = nodes.map((node) => node.getAttribute(SLIDE_VALUE_ATTRIBUTE));

  return values.filter((value): value is string => value != null);
}

/**
 * Rendered accessible name of a slide element matched by value key.
 *
 * @param group - Enclosing carousel shared props
 * @param value - Target slide identifier
 * @returns Rendered slide name, or null when the slide is not mounted
 */
export function querySlideLabel(group: CarouselProps | null | undefined, value: string): string | null {
  if (!group?.id || typeof document === 'undefined') {
    return null;
  }

  const viewport = document.getElementById(`${group.id}-viewport`);
  if (!viewport) {
    return null;
  }

  const nodes = Array.from(viewport.querySelectorAll(`[${SLIDE_VALUE_ATTRIBUTE}]`));
  const match = nodes.find((node) => node.getAttribute(SLIDE_VALUE_ATTRIBUTE) === value);

  return match?.getAttribute('aria-label') ?? null;
}

/**
 * Resolved current slide identifier from shared props and DOM order.
 *
 * @param group - Enclosing carousel shared props
 * @param members - Slide identifiers in DOM order
 * @returns Matched value, first member fallback, or null when empty
 */
export function carouselCurrent(group: CarouselProps | null | undefined, members: string[]): string | null {
  if (members.length === 0) {
    return null;
  }

  const value = group?.value;
  if (value != null && members.includes(value)) {
    return value;
  }

  return members[0];
}

/**
 * Steps one position with loop rules applied.
 *
 * @param members - Slide identifiers in DOM order
 * @param loop - Wrap configuration from shared props
 * @param index - Current member position
 * @param direction - Step direction (1 forward, -1 backward)
 * @returns Target member position, or null when the edge holds
 */
export function stepMember(
  members: string[],
  loop: boolean | undefined,
  index: number,
  direction: 1 | -1
): number | null {
  const last = members.length - 1;

  if (direction === 1) {
    if (index >= last) {
      // Forward wraps by default; loop: false parks at the last slide.
      return loop === false ? null : 0;
    }

    return index + 1;
  }

  if (index <= 0) {
    // Backward wraps only with loop: true.
    return loop === true ? last : null;
  }

  return index - 1;
}
