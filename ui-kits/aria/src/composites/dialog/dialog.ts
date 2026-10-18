import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
} from '../../types.js';
import { DialogCloseAria } from './close.js';
import { DialogDescriptionAria } from './description.js';
import { DialogPanelAria } from './panel.js';
import { DialogTitleAria } from './title.js';
import { DialogTriggerAria } from './trigger.js';

const DIALOG_SYMBOL = $symbol('dialog');

/**
 * Ambient instance context for the enclosing Dialog coordinator.
 */
export const dialogCtx = createContext<DialogAria>();

/**
 * Controller-dispatched dialog event for custom panel lifecycle notifications.
 */
export type DialogEvent = AriaEvent<void>;

/**
 * Reactive input properties for DialogAria.
 */
export interface DialogProps extends AriaProps {
  /**
   * Deterministic identifier and namespace for child part pair derivation.
   */
  id?: string;

  /**
   * Whether the dialog is currently open.
   */
  open?: boolean;

  /**
   * Interaction modality: modal (traps focus and blocks background) or nonmodal.
   */
  modality?: 'modal' | 'nonmodal';

  /**
   * Whether the dialog can be dismissed via Escape or outside interaction.
   */
  dismissable?: boolean;

  /**
   * Called after the dialog opens.
   */
  onopen?: AriaEventHandler<DialogEvent>;

  /**
   * Called after the dialog closes, through every dismissal path.
   */
  onclose?: AriaEventHandler<DialogEvent>;
}

/**
 * Configuration options for DialogAria.
 */
export interface DialogOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a Dialog coordinator.
 */
export interface DialogAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * Root coordinator controller for a dialog composite widget.
 * Coordinates ambient open, modality, and dismissable state across child parts.
 */
export class DialogAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  DialogProps,
  DialogAttributes<E>,
  DialogOptions
> {
  public id: string;

  public constructor(props: Partial<DialogProps> = {}, options: DialogOptions = {}) {
    super(props, options);
    this.omittedAttrs.push('id', 'open', 'modality', 'dismissable', 'onopen', 'onclose');
    this.id = $static(() => this.properties.id ?? `dialog-${uIndex(DIALOG_SYMBOL, true)}`);
    dialogCtx.set(this as never);
    this.update();
  }

  public get open(): boolean {
    return !!this.properties.open;
  }

  public set open(value: boolean) {
    this.properties.open = value;
  }

  public get modality(): 'modal' | 'nonmodal' {
    return this.properties.modality ?? 'modal';
  }

  public get dismissable(): boolean {
    return this.properties.dismissable ?? true;
  }

  /**
   * Opens the dialog.
   */
  public show(): void {
    this.open = true;
  }

  /**
   * Closes the dialog.
   */
  public close(): void {
    this.open = false;
  }

  /**
   * Toggles the dialog open state.
   */
  public toggle(): void {
    this.open = !this.open;
  }

  /**
   * Spawns a trigger button controller linked to this dialog.
   */
  public trigger<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): DialogTriggerAria<T> {
    return new DialogTriggerAria<T>(props, options);
  }

  /**
   * Spawns an overlay panel controller linked to this dialog.
   */
  public panel<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): DialogPanelAria<T> {
    return new DialogPanelAria<T>(props, options);
  }

  /**
   * Spawns a close button controller linked to this dialog.
   */
  public closeButton<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): DialogCloseAria<T> {
    return new DialogCloseAria<T>(props, options);
  }

  /**
   * Spawns a title element controller linked to this dialog.
   */
  public title<T extends HTMLElement = HTMLElement>(props?: AriaProps, options?: AriaOptions): DialogTitleAria<T> {
    return new DialogTitleAria<T>(props, options);
  }

  /**
   * Spawns a description element controller linked to this dialog.
   */
  public description<T extends HTMLElement = HTMLElement>(
    props?: AriaProps,
    options?: AriaOptions
  ): DialogDescriptionAria<T> {
    return new DialogDescriptionAria<T>(props, options);
  }

  protected createAttributes(): DialogAttributes<E> {
    return {
      id: this.id,
    };
  }
}
