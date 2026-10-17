import type { BaseElement, Orientation } from '../types.js';

/**
 * CSS selector matching keyboard-focusable controls inside a container.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Collects keyboard-focusable controls inside a container in document order.
 *
 * @param container - The element to search within
 * @returns Focusable descendant elements in document order
 */
export function queryFocusable(container: BaseElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Configuration options for roving keyboard navigation across composite items.
 */
export interface RovingNavigationOptions {
  /**
   * CSS selector matching interactive target items within the container.
   */
  selector: string;

  /**
   * CSS selector matching active target items within the container.
   */
  activeSelector?: string;

  /**
   * Layout orientation determining which arrow keys navigate forward and backward.
   * Defaults to 'vertical'.
   */
  orientation?: Orientation;

  /**
   * Whether both axes navigate: ArrowRight/ArrowDown forward, ArrowLeft/ArrowUp backward.
   * Takes precedence over `orientation` for composites that travel in every direction.
   */
  bothAxes?: boolean;

  /**
   * Whether navigation only moves focus without activating selection.
   * When true, only focus shifts; when false (default), click() is invoked.
   */
  manual?: boolean;
}

/**
 * Handles roving tabindex keyboard navigation across child items within a composite container.
 *
 * Inspects live DOM elements at invocation time to support dynamic items, conforms
 * navigation to the specified orientation, and wraps across boundaries.
 *
 * @param container - The composite container element
 * @param event - The incoming keyboard event
 * @param options - Navigation configuration options
 * @returns Whether a navigation key was handled
 */
export function handleRovingKey<E extends BaseElement = BaseElement>(
  container: E | null | undefined,
  event: KeyboardEvent,
  options: RovingNavigationOptions
): boolean {
  if (!container) return false;

  const isHorizontal = options.orientation === 'horizontal';
  const isNext = options.bothAxes
    ? event.key === 'ArrowRight' || event.key === 'ArrowDown'
    : event.key === (isHorizontal ? 'ArrowRight' : 'ArrowDown');
  const isPrev = options.bothAxes
    ? event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    : event.key === (isHorizontal ? 'ArrowLeft' : 'ArrowUp');
  const isHome = event.key === 'Home';
  const isEnd = event.key === 'End';

  if (!isNext && !isPrev && !isHome && !isEnd) return false;

  const items = Array.from(container.querySelectorAll<HTMLElement>(options.selector));
  if (items.length === 0) return false;

  const root = (container.getRootNode?.() as Document | ShadowRoot) ?? document;
  const activeElement = options.activeSelector
    ? items.find((el) => el.matches(options.activeSelector!))
    : root.activeElement;
  const currentIndex = activeElement ? items.indexOf(activeElement as HTMLElement) : -1;

  let targetIndex: number;

  if (isNext) {
    targetIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  } else if (isPrev) {
    targetIndex = currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
  } else if (isHome) {
    targetIndex = 0;
  } else {
    targetIndex = items.length - 1;
  }

  event.preventDefault();
  const target = items[targetIndex];
  target.focus();

  if (!options.manual) {
    target.click();
  }

  return true;
}
