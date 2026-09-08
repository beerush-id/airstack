import { createContext } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';

/**
 * Ambient instance context for the enclosing Toolbar orchestrator.
 */
export const toolbarCtx = createContext<ToolbarAria>();

/**
 * Reactive input properties for ToolbarAria.
 */
export interface ToolbarProps extends AriaProps {
  /**
   * Visual and keyboard navigation orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: Orientation;

  /**
   * Whether user interaction is disabled across the entire toolbar.
   */
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a toolbar container.
 *
 * @template E - Target Element type
 */
export interface ToolbarAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'toolbar';
  'aria-orientation'?: Orientation;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA Toolbar coordinator managing control grouping,
 * single-tab-stop roving focus, and ambient toolbar context.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class ToolbarAria<
  E extends BaseElement = HTMLElement,
  T extends ToolbarProps = ToolbarProps,
  A extends ToolbarAttributes<E> = ToolbarAttributes<E>,
> extends Aria<E, T, A> {
  private parentRover = roverCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);

    roverCtx.set(this as unknown as Aria<BaseElement>);
    toolbarCtx.set(this as unknown as ToolbarAria);

    this.omittedAttrs.push('role', 'aria-orientation', 'aria-disabled');
    this.update();
  }

  /**
   * Visual and keyboard navigation orientation of the toolbar.
   */
  public get orientation(): Orientation {
    return this.props.orientation ?? 'horizontal';
  }

  /**
   * Whether user interaction is disabled across the entire toolbar.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Computes HTML and ARIA attributes for the toolbar container.
   *
   * @returns Compiled toolbar attributes dictionary
   */
  protected override createAttributes(): A {
    const disabled = this.disabled;
    const orientation = this.orientation;

    return Object.assign(super.createAttributes(), {
      role: 'toolbar',
      'aria-orientation': orientation,
      'aria-disabled': disabled ? 'true' : 'false',
      onkeydown: (e: KeyboardEvent) => {
        if (disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: TOOLBAR_SELECTORS,
          orientation,
          manual: true,
        });
      },
    }) as A;
  }
}

const TOOLBAR_SELECTORS = [
  'button:not([disabled])',
  '[role="button"]:not([aria-disabled="true"]):not([disabled])',
  '[role="radio"]:not([aria-disabled="true"]):not([disabled])',
  '[role="checkbox"]:not([aria-disabled="true"]):not([disabled])',
  '[role="link"]:not([aria-disabled="true"]):not([disabled])',
  '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');
