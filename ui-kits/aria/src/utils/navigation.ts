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
 * Keeps Tab inside a container, or a group of containers taken as one in the
 * order given: past the last rendered control it wraps to the first, and
 * Shift+Tab past the first wraps to the last, moving from one container to
 * the next on the way. Controls that are not rendered (hidden, collapsed) are
 * skipped. With nothing to focus, focus stays on the first container.
 *
 * @param container - The element, or elements, focus must not leave
 * @param event - The Tab keydown event
 * @returns Whether the event was handled by moving focus
 */
export function trapTab(container: HTMLElement | HTMLElement[], event: KeyboardEvent): boolean {
  const containers = Array.isArray(container) ? container : [container];
  const focusables = containers
    .flatMap((element) => queryFocusable(element))
    .filter((node) => node.getClientRects().length > 0);
  const current = containers[0].ownerDocument.activeElement as HTMLElement | null;

  if (!focusables.length) {
    event.preventDefault();
    containers[0].focus();
    return true;
  }

  const index = current ? focusables.indexOf(current) : -1;
  const step = event.shiftKey ? -1 : 1;
  const target = index + step;
  const next =
    index === -1
      ? focusables[event.shiftKey ? focusables.length - 1 : 0]
      : focusables[(target + focusables.length) % focusables.length];

  // Within one container and short of either end, the browser's own order already lands on the next control.
  const owner = (node: HTMLElement | null) => containers.find((element) => element.contains(node));
  if (index !== -1 && target >= 0 && target < focusables.length && owner(next) === owner(current)) return false;

  event.preventDefault();
  next.focus();
  return true;
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
   * Whether items wrap into visual rows, like a responsive grid of tiles with no row elements.
   * ArrowLeft/ArrowRight move through items in reading order (mirrored in right-to-left),
   * ArrowUp/ArrowDown move to the closest item in the row above or below.
   * Takes precedence over `orientation` and `bothAxes`.
   */
  flow?: boolean;

  /**
   * Whether navigation only moves focus without activating selection.
   * When true, only focus shifts; when false (default), click() is invoked.
   */
  manual?: boolean;

  /**
   * Whether navigation wraps from last to first and vice versa.
   * Defaults to true.
   */
  loop?: boolean;

  /**
   * Whether to focus to the target element on navigation.
   * Defaults to true.
   */
  focus?: boolean;
}

/**
 * Handles roving tabindex keyboard navigation across child items within a composite container.
 *
 * Inspects live DOM elements at invocation time to support dynamic items, conforms
 * navigation to the specified orientation, and optionally wraps across boundaries.
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
  if (options.flow) return handleFlowKey(container, event, options);

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
  const loop = options.loop ?? true;

  let targetIndex: number;

  if (isNext) {
    targetIndex =
      currentIndex >= 0 ? (loop ? (currentIndex + 1) % items.length : Math.min(currentIndex + 1, items.length - 1)) : 0;
  } else if (isPrev) {
    targetIndex =
      currentIndex >= 0
        ? loop
          ? (currentIndex - 1 + items.length) % items.length
          : Math.max(currentIndex - 1, 0)
        : items.length - 1;
  } else if (isHome) {
    targetIndex = 0;
  } else {
    targetIndex = items.length - 1;
  }

  event.preventDefault();
  const target = items[targetIndex];

  if (options.focus !== false) target.focus();
  if (!options.manual && targetIndex !== currentIndex) {
    target.click();
  }

  return true;
}

const FLOW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * Moves focus across items that wrap into visual rows. Rows exist only in
 * layout, so the row above or below is found from the items' positions.
 *
 * @param container - The container holding the items
 * @param event - The incoming keyboard event
 * @param options - Navigation configuration options
 * @returns Whether a navigation key was handled
 */
function handleFlowKey(container: BaseElement, event: KeyboardEvent, options: RovingNavigationOptions): boolean {
  const { key } = event;
  if (!FLOW_KEYS.has(key)) return false;

  const items = Array.from(container.querySelectorAll<HTMLElement>(options.selector));
  if (items.length === 0) return false;

  const root = (container.getRootNode?.() as Document | ShadowRoot) ?? document;
  const active = options.activeSelector ? items.find((el) => el.matches(options.activeSelector!)) : root.activeElement;
  const current = active ? items.indexOf(active as HTMLElement) : -1;
  const last = items.length - 1;
  let targetIndex: number;

  if (key === 'Home' || current < 0) {
    targetIndex = key === 'End' ? last : 0;
  } else if (key === 'End') {
    targetIndex = last;
  } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const rtl = getComputedStyle(container as unknown as Element).direction === 'rtl';
    const step = (key === 'ArrowRight') !== rtl ? 1 : -1;
    const next = current + step;
    targetIndex = (options.loop ?? true) ? (next + items.length) % items.length : Math.min(Math.max(next, 0), last);
  } else {
    targetIndex = closestInNextRow(items, current, key === 'ArrowDown');
    if (targetIndex < 0) return false;
  }

  event.preventDefault();
  const target = items[targetIndex];

  if (options.focus !== false) target.focus();
  if (!options.manual && targetIndex !== current) {
    target.click();
  }

  return true;
}

/**
 * Finds the item in the visual row below (or above) the current one whose
 * center lines up best with the current item's.
 *
 * @param items - Items in document order
 * @param current - Index of the item focus moves from
 * @param down - Whether to look in the row below; otherwise the row above
 * @returns The index of the closest item, or -1 at the first or last row
 */
function closestInNextRow(items: HTMLElement[], current: number, down: boolean): number {
  const centers = items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, half: rect.height / 2 };
  });
  const from = centers[current];
  let rowY: number | undefined;

  for (const center of centers) {
    const ahead = down ? center.y > from.y + from.half : center.y < from.y - from.half;
    if (ahead && (rowY === undefined || (down ? center.y < rowY : center.y > rowY))) rowY = center.y;
  }
  if (rowY === undefined) return -1;

  let closest = -1;
  let distance = Number.POSITIVE_INFINITY;

  centers.forEach((center, index) => {
    if (Math.abs(center.y - (rowY as number)) >= from.half) return;
    const gap = Math.abs(center.x - from.x);
    if (gap < distance) {
      distance = gap;
      closest = index;
    }
  });

  return closest;
}
