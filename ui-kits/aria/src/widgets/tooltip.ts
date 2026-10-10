import { $symbol } from '@airlib/core';
import type { AriaEvent, AriaEventHandler } from '../types.js';
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
/**
 * Controller-dispatched tooltip visibility event carrying the open state in `detail`.
 */
export type TooltipEvent = AriaEvent<boolean>;

export interface TooltipProps extends PopoverProps {
  /**
   * Called with the open state after the tooltip toggles.
   */
  onchange?: AriaEventHandler<TooltipEvent>;
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
  public constructor(props: Partial<TooltipProps> = {}, options: PopoverOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('onchange');
  }

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

  protected override get autofocus(): boolean {
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
    const event: TooltipEvent = new CustomEvent('change', { bubbles: true, detail: isOpen });
    el.dispatchEvent(event);
    (this.properties as TooltipProps).onchange?.(event);
  }
}
