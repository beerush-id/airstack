import type { BaseElement, Orientation } from '../types.js';

/**
 * Configuration options for roving keyboard navigation across composite items.
 */
export interface RovingNavigationOptions {
  /**
   * CSS selector matching interactive target items within the container.
   */
  selector: string;

  /**
   * Layout orientation determining which arrow keys navigate forward and backward.
   * Defaults to 'vertical'.
   */
  orientation?: Orientation;

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
  const isNext = isHorizontal ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
  const isPrev = isHorizontal ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
  const isHome = event.key === 'Home';
  const isEnd = event.key === 'End';

  if (!isNext && !isPrev && !isHome && !isEnd) return false;

  const items = Array.from(container.querySelectorAll<HTMLElement>(options.selector));
  if (items.length === 0) return false;

  const root = (container.getRootNode?.() as Document | ShadowRoot) ?? document;
  const currentIndex = root.activeElement ? items.indexOf(root.activeElement as HTMLElement) : -1;

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
