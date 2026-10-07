import { $symbol } from '@airlib/core';
import {
  type OverlayTriggerMode,
  PopoverAria,
  type PopoverAttributes,
  type PopoverOptions,
  type PopoverProps,
} from './popover.js';

const TOOLTIP_SYMBOL = $symbol('tooltip');

/**
 * Reactive input properties for TooltipAria.
 */
export interface TooltipProps extends PopoverProps {
  /**
   * Activation trigger modes for opening and closing the tooltip.
   * @default ['hover', 'focus']
   */
  mode?: OverlayTriggerMode[];

  /**
   * Hover delay in milliseconds before showing the tooltip.
   * @default 300
   */
  delay?: number;
}

/**
 * Controller configuration options for TooltipAria.
 */
export interface TooltipOptions extends PopoverOptions {}

/**
 * Compiled HTML and ARIA attributes for a Tooltip overlay.
 */
export interface TooltipAttributes<E extends HTMLElement = HTMLElement> extends PopoverAttributes<E> {
  role?: 'tooltip';
}

/**
 * Creates a reactive advisory tooltip overlay controller.
 *
 * @param props - Initial tooltip properties
 * @param options - Controller configuration options
 * @returns A new TooltipAria overlay controller instance
 */
export function tooltip<E extends HTMLElement = HTMLElement>(
  props?: TooltipProps,
  options?: TooltipOptions
): TooltipAria<E> {
  return new TooltipAria<E>(props, options);
}

/**
 * Non-interactive advisory tooltip overlay widget extending PopoverAria,
 * configured for hover/focus activation modes, 300ms hover delay, and
 * WCAG aria-describedby relationship with host trigger.
 */
export class TooltipAria<E extends HTMLElement = HTMLElement> extends PopoverAria<E> {
  public override get mode(): OverlayTriggerMode[] {
    return this.properties.mode ?? ['hover', 'focus'];
  }

  public override get delay(): number {
    return this.properties.delay ?? 300;
  }

  public override set delay(value: number) {
    this.properties.delay = value;
  }

  public override get popupRole(): 'dialog' | 'menu' | 'tooltip' {
    return 'tooltip';
  }

  protected override get anchorPrefix(): string {
    return 'tooltip';
  }

  protected override get instanceSymbol(): symbol {
    return TOOLTIP_SYMBOL;
  }

  protected override get managesFocus(): boolean {
    return false;
  }

  protected override createTriggerAttributes(): Record<string, unknown> {
    return {
      'aria-describedby': this.open ? this.id : undefined,
    };
  }

  protected override applyFallbackTrigger(hostEl: HTMLElement, isOpen: boolean): void {
    if (isOpen) {
      hostEl.setAttribute('aria-describedby', this.id);
    } else {
      hostEl.removeAttribute('aria-describedby');
    }
  }

  protected override removeFallbackTrigger(hostEl: HTMLElement): void {
    hostEl.removeAttribute('aria-describedby');
  }

  protected override dispatchVisibilityEvent(el: HTMLElement, isOpen: boolean): void {
    el.dispatchEvent(new CustomEvent<boolean>('change', { bubbles: true, detail: isOpen }));
  }
}
