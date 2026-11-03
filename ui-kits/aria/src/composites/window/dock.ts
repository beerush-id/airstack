import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { trapTab } from '../../utils/navigation.js';

/** The variable a dock publishes its height in, on its parent. */
const DOCK_BLOCK_SIZE = '--aui-dock-block-size';

/**
 * Reactive input properties for a dock.
 */
export interface DockProps extends AriaProps {
  /**
   * Accessible name for the dock, e.g. "Dock". None is built in.
   */
  label?: string;
}

/**
 * Compiled attributes for a dock.
 */
export interface DockAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group';
  'aria-label'?: string;
  'data-dock'?: 'true';
  'data-snap-target'?: 'true';
}

/**
 * The bar of launchers and running apps along an edge of a desktop. It
 * groups its controls under one name, keeps `Tab` among them the way a
 * window does, and claims its edge: windows snap against it, and their
 * maximize and half layouts stop short of it. It publishes its height on its
 * parent as `--aui-dock-block-size`, so what stands beside it — the answers
 * above it — keeps clear of it as it grows.
 */
export class DockAria<E extends BaseElement = HTMLElement> extends Aria<E, DockProps, DockAttributes<E>, AriaOptions> {
  public constructor(props: Partial<DockProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('label', 'role', 'aria-label', 'data-dock', 'data-snap-target');
    this.update();
  }

  protected attach() {
    return publishBlockSize(this.element as unknown as HTMLElement, DOCK_BLOCK_SIZE);
  }

  protected createAttributes(): DockAttributes<E> {
    return {
      role: 'group',
      'aria-label': this.properties.label,
      'data-dock': 'true',
      'data-snap-target': 'true',
      onkeydown: this.handleKeyDown,
    };
  }

  // Leaving the dock is a deliberate press elsewhere. A popup it opens elsewhere in the page keeps Tab itself.
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    trapDockTab(this.element as HTMLElement | null, event);
  };
}

/**
 * Reactive input properties for a dock region.
 */
export interface DockRegionProps extends AriaProps {
  /**
   * Accessible name for the region, e.g. "Assistant". With it the region is a landmark; none is built in.
   */
  label?: string;
  /**
   * A variable to publish the region's height in, on its parent, so what else stands beside the
   * dock — the answers above it — keeps clear of it too, e.g. `--aui-dock-float-block-size`.
   */
  publish?: string;
}

/**
 * Compiled attributes for a dock region.
 */
export interface DockRegionAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'region';
  'aria-label'?: string;
  'data-dock-region'?: 'true';
}

/**
 * An area that belongs to the dock without sitting inside it, such as the
 * answers stacked above it. Placed beside the dock, it shares the dock's
 * `Tab` loop: focus moves between the dock and its regions and never leaves
 * them. Named, it is a landmark people can jump to.
 */
export class DockRegionAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  DockRegionProps,
  DockRegionAttributes<E>
> {
  public constructor(props: Partial<DockRegionProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('label', 'publish', 'role', 'aria-label', 'data-dock-region');
    this.update();
  }

  protected attach() {
    const name = this.properties.publish;
    if (!name) return;
    return publishBlockSize(this.element as unknown as HTMLElement, name);
  }

  protected createAttributes(): DockRegionAttributes<E> {
    const label = this.properties.label;
    return {
      role: label ? 'region' : undefined,
      'aria-label': label,
      'data-dock-region': 'true',
      onkeydown: this.handleKeyDown,
    };
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    trapDockTab(this.element as HTMLElement | null, event);
  };
}

/**
 * Publishes an element's height on its parent as a CSS variable, kept current as it grows and
 * shrinks, so what stands beside it can keep clear of it. Removed when the element goes.
 *
 * @param element - The element to measure.
 * @param name - The variable to publish it in, e.g. `--aui-dock-block-size`.
 * @returns A teardown that stops measuring and removes the variable.
 */
function publishBlockSize(element: HTMLElement | null, name: string): (() => void) | undefined {
  const parent = element?.parentElement;
  if (!element || !parent || typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(([entry]) => {
    const size = entry?.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight;
    parent.style.setProperty(name, `${size}px`);
  });

  observer.observe(element);
  return () => {
    observer.disconnect();
    parent.style.removeProperty(name);
  };
}

/**
 * Keeps `Tab` within a dock and the regions beside it, in page order.
 *
 * @param element - The dock or region the key was pressed in
 * @param event - The keydown event
 */
function trapDockTab(element: HTMLElement | null, event: KeyboardEvent): void {
  if (event.key !== 'Tab' || event.defaultPrevented || !element?.contains(event.target as Node)) return;
  const group = element.parentElement
    ? Array.from(element.parentElement.querySelectorAll<HTMLElement>(':scope > :is([data-dock], [data-dock-region])'))
    : [element];
  trapTab(group, event);
}
