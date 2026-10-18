import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps, DetachFn } from '../types.js';
import {
  DialogAria,
  DialogCloseAria,
  type DialogCloseAttributes,
  DialogDescriptionAria,
  type DialogDescriptionAttributes,
  type DialogOptions,
  DialogPanelAria,
  type DialogPanelAttributes,
  type DialogProps,
  DialogTitleAria,
  type DialogTitleAttributes,
  DialogTriggerAria,
  type DialogTriggerAttributes,
} from './dialog.js';

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
 * Compiled HTML and ARIA attributes for a Confirm panel.
 */
export interface ConfirmPanelAttributes<E extends HTMLElement = HTMLElement> extends DialogPanelAttributes<E> {}

/**
 * Compiled HTML and ARIA attributes for a Confirm trigger.
 */
export interface ConfirmTriggerAttributes<E extends HTMLElement = HTMLElement> extends DialogTriggerAttributes<E> {}

/**
 * Compiled HTML and ARIA attributes for a Confirm action button.
 */
export interface ConfirmActionAttributes<E extends HTMLElement = HTMLElement> extends DialogCloseAttributes<E> {}

/**
 * Compiled HTML and ARIA attributes for a Confirm cancel button.
 */
export interface ConfirmCancelAttributes<E extends HTMLElement = HTMLElement> extends DialogCloseAttributes<E> {}

/**
 * Compiled HTML and ARIA attributes for a Confirm title.
 */
export interface ConfirmTitleAttributes<E extends HTMLElement = HTMLElement> extends DialogTitleAttributes<E> {}

/**
 * Compiled HTML and ARIA attributes for a Confirm description.
 */
export interface ConfirmDescriptionAttributes<E extends HTMLElement = HTMLElement>
  extends DialogDescriptionAttributes<E> {}

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
 * Confirm overlay panel controller carrying role="alertdialog", modal locking, and accessibility linkages.
 */
export class ConfirmPanelAria<E extends HTMLElement = HTMLElement> extends DialogPanelAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    if (props && 'native' in props && options.native === undefined) {
      options.native = props.native as boolean;
    }
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmPanelAttributes<E> {
    const confirm = this.confirm;
    const parentId = confirm?.id ?? 'confirm';

    const attrs = super.createAttributes() as ConfirmPanelAttributes<E>;
    attrs.id = `${parentId}-panel`;
    attrs.role = 'alertdialog';
    attrs['aria-modal'] = 'true';
    attrs['aria-labelledby'] = `${parentId}-title`;
    attrs['aria-describedby'] = `${parentId}-description`;

    if (!this.isNative) {
      attrs.hidden = !this.open;
    }

    return attrs;
  }
}

/**
 * Interactive trigger button for opening a confirmation alertdialog.
 */
export class ConfirmTriggerAria<E extends HTMLElement = HTMLElement> extends DialogTriggerAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.confirm = confirmCtx.get();
  }

  protected override createAttributes(): ConfirmTriggerAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    const attrs = super.createAttributes() as ConfirmTriggerAttributes<E>;
    attrs['aria-controls'] = `${parentId}-panel`;
    return attrs;
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    super.handleClick(e);
  }
}

/**
 * Action button controller for confirming and executing the action.
 * Emits a bubbling 'confirm' event upon activation before closing.
 */
export class ConfirmActionAria<E extends HTMLElement = HTMLElement> extends DialogCloseAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.confirm = confirmCtx.get();
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    const evt: ConfirmEvent = new CustomEvent('confirm', { bubbles: true, cancelable: true });
    this.element?.dispatchEvent(evt);
    this.confirm?.properties.onconfirm?.(evt);
    if (!evt.defaultPrevented) {
      this.confirm?.close();
    }
  }
}

/**
 * Safe cancel button controller for dismissing the confirmation dialog.
 * Emits a bubbling 'cancel' event upon activation, lands initial autofocus, and closes.
 */
export class ConfirmCancelAria<E extends HTMLElement = HTMLElement> extends DialogCloseAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.confirm = confirmCtx.get();
  }

  protected override attach(): DetachFn {
    const el = this.element!;
    el.setAttribute('autofocus', '');
    return () => {
      el.removeAttribute('autofocus');
    };
  }

  protected override handleClick(e: MouseEvent): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    const evt: CancelEvent = new CustomEvent('cancel', { bubbles: true, cancelable: true });
    this.element?.dispatchEvent(evt);
    this.confirm?.properties.oncancel?.(evt);
    if (!evt.defaultPrevented) {
      this.confirm?.close();
    }
  }
}

/**
 * Title element controller providing accessible labeling for a confirmation dialog.
 */
export class ConfirmTitleAria<E extends HTMLElement = HTMLElement> extends DialogTitleAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmTitleAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    return {
      id: `${parentId}-title`,
    };
  }
}

/**
 * Description element controller providing accessible description for a confirmation dialog.
 */
export class ConfirmDescriptionAria<E extends HTMLElement = HTMLElement> extends DialogDescriptionAria<E> {
  public confirm?: ConfirmAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.confirm = confirmCtx.get();
    this.update();
  }

  protected override createAttributes(): ConfirmDescriptionAttributes<E> {
    const confirm = this.confirm ?? confirmCtx.get() ?? (this.dialog as ConfirmAria);
    const parentId = confirm?.id ?? 'confirm';
    return {
      id: `${parentId}-description`,
    };
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
