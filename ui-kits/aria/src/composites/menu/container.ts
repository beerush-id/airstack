import { createContext } from '@airlib/core';
import { roverCtx } from '../../context.js';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../../types.js';
import { handleRovingKey } from '../../utils/navigation.js';
import type { MenuAria } from './menu.js';

/**
 * Ambient instance context for the enclosing Menu root orchestrator.
 */
export const menuCtx = createContext<MenuAria>();

export const ROLE_MENU = 'menu';

const MENU_SELECTORS = [
  '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])',
  '[role="menuitemcheckbox"]:not([aria-disabled="true"]):not([disabled])',
  '[role="menuitemradio"]:not([aria-disabled="true"]):not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

/**
 * Shared roving-focus container foundation for menu panels and menubars.
 *
 * Owns the single tab stop, delegates arrow-key navigation at the container
 * level, and defers to an outer rover when nested inside another container.
 * Arrows move focus only and never activate items.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export abstract class MenuContainerAria<
  E extends BaseElement = HTMLElement,
  T extends AriaProps = AriaProps,
  A extends AriaAttributes<E> = AriaAttributes<E>,
> extends Aria<E, T, A> {
  private parentRover = roverCtx.get();

  /**
   * Container role projected onto the element.
   */
  protected abstract readonly containerRole: 'menu' | 'menubar';

  /**
   * Default orientation when no explicit prop is provided.
   */
  protected abstract readonly defaultOrientation: Orientation;

  /**
   * Visual and keyboard navigation orientation of the container.
   */
  protected abstract readonly orientation: Orientation;

  public constructor(props: Partial<T>) {
    super(props);

    roverCtx.set(this as unknown as Aria<BaseElement>);
  }

  /**
   * Whether the container is nested inside an outer roving container
   * and must defer keyboard delegation to it.
   */
  protected get nested(): boolean {
    return !!this.parentRover;
  }

  /**
   * Delegates a keydown event to the roving-focus navigator.
   *
   * @param event - Keyboard event bubbled from a menu item
   */
  protected handleKey(event: KeyboardEvent): void {
    handleRovingKey(this.element, event, {
      selector: MENU_SELECTORS,
      orientation: this.orientation,
      manual: true,
    });
  }

  /**
   * Computes HTML and ARIA attributes for the menu container.
   *
   * @returns Compiled container attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: this.containerRole,
      onkeydown: (e: KeyboardEvent) => {
        if (this.nested) return;
        this.handleKey(e);
      },
    }) as A;
  }
}
