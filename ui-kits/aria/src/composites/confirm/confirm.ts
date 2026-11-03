import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps } from '../../types.js';
import { DialogAria, type DialogOptions, type DialogProps } from '../dialog/dialog.js';
import type { DialogPanelAttributes } from '../dialog/panel.js';
import { ConfirmActionAria } from './action.js';
import { ConfirmCancelAria } from './cancel.js';
import { ConfirmDescriptionAria } from './description.js';
import { ConfirmPanelAria } from './panel.js';
import { ConfirmTitleAria } from './title.js';
import { ConfirmTriggerAria } from './trigger.js';

const CONFIRM_SYMBOL = $symbol('confirm');

/**
 * Controller-dispatched confirmation event.
 */
export type ConfirmEvent = AriaEvent<void>;

/**
 * Controller-dispatched cancellation event.
 */
export type CancelEvent = AriaEvent<void>;

/**
 * Ambient instance context for the enclosing Confirm coordinator.
 */
export const confirmCtx = createContext<ConfirmAria>();

/**
 * Reactive input properties for ConfirmAria.
 */
export interface ConfirmProps extends DialogProps {
  onconfirm?: AriaEventHandler<ConfirmEvent>;
  oncancel?: AriaEventHandler<CancelEvent>;
}

/**
 * Configuration options for ConfirmAria.
 */
export interface ConfirmOptions extends DialogOptions {}

/**
 * Compiled HTML and ARIA attributes for a Confirm coordinator.
 */
export interface ConfirmAttributes<E extends HTMLElement = HTMLElement> extends DialogPanelAttributes<E> {}

/**
 * Root coordinator controller for a confirmation alertdialog composite widget.
 * Inherits modal and focus orchestration from DialogAria while enforcing alertdialog semantics.
 */
export class ConfirmAria<E extends HTMLElement = HTMLElement> extends DialogAria<E> {
  public constructor(props: Partial<ConfirmProps> = {}, options: ConfirmOptions = {}) {
    super(props, options);
    this.id = $static(() => this.properties.id ?? `confirm-${uIndex(CONFIRM_SYMBOL, true)}`);
    confirmCtx.set(this as never);
    this.omittedAttrs.push('onconfirm', 'oncancel');
    this.update();
  }

  public override get modality(): 'modal' {
    return 'modal';
  }

  public override get dismissable(): boolean {
    return false;
  }

  public override trigger<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): ConfirmTriggerAria<T> {
    return new ConfirmTriggerAria<T>(props, options);
  }

  public override panel<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): ConfirmPanelAria<T> {
    return new ConfirmPanelAria<T>(props, options);
  }

  public override title<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): ConfirmTitleAria<T> {
    return new ConfirmTitleAria<T>(props, options);
  }

  public override description<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): ConfirmDescriptionAria<T> {
    return new ConfirmDescriptionAria<T>(props, options);
  }

  /**
   * Spawns a confirmation action button controller linked to this confirm coordinator.
   */
  public action<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): ConfirmActionAria<T> {
    return new ConfirmActionAria<T>(props, options);
  }

  /**
   * Spawns a safe cancel button controller linked to this confirm coordinator.
   */
  public cancel<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): ConfirmCancelAria<T> {
    return new ConfirmCancelAria<T>(props, options);
  }
}
/**
 * Creates a reactive confirmation alertdialog composite coordinator.
 *
 * @param props - Initial confirm properties
 * @param options - Controller configuration options
 * @returns A new ConfirmAria controller instance
 */
export function confirm<E extends HTMLElement = HTMLElement>(
  props?: ConfirmProps,
  options?: ConfirmOptions
): ConfirmAria<E> {
  return new ConfirmAria<E>(props, options);
}
