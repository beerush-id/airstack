import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
} from '../types.js';
import { attachOverlayLifecycle } from '../utils/overlay.js';

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
 * Compiled HTML and ARIA attributes for a Dialog overlay panel.
 */
export interface DialogPanelAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: string;
  hidden?: boolean;
  'aria-modal'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Compiled HTML and ARIA attributes for a Dialog trigger.
 */
export interface DialogTriggerAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  type?: string;
  disabled?: boolean;
  tabindex?: number;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean | 'true' | 'false';
  'aria-controls'?: string;
  'aria-disabled'?: boolean | 'true' | 'false';
}

/**
 * Compiled HTML and ARIA attributes for a Dialog close trigger.
 */
export interface DialogCloseAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  type?: string;
  disabled?: boolean;
  tabindex?: number;
  'aria-disabled'?: boolean | 'true' | 'false';
}

/**
 * Compiled HTML and ARIA attributes for a Dialog title.
 */
export interface DialogTitleAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
}

/**
 * Compiled HTML and ARIA attributes for a Dialog description.
 */
export interface DialogDescriptionAttributes<E extends HTMLElement = HTMLElement> extends AriaAttributes<E> {
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

/**
 * Dialog overlay panel controller carrying role="dialog", modality, and accessibility linkages.
 */
export class DialogPanelAria<E extends HTMLElement = HTMLElement> extends Aria<E, AriaProps, DialogPanelAttributes<E>> {
  public dialog?: DialogAria;

  public get open() {
    return !!this.dialog?.open;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push(
      'id',
      'role',
      'open',
      'modality',
      'dismissable',
      'aria-modal',
      'aria-labelledby',
      'aria-describedby',
      'hidden'
    );
    this.update();
  }

  protected createAttributes(): DialogPanelAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    const isModal = this.dialog ? this.dialog.modality !== 'nonmodal' : true;
    const isOpen = this.dialog?.open ?? false;

    const attrs: DialogPanelAttributes<E> = {
      id: `${parentId}-panel`,
      role: 'dialog',
      'aria-modal': isModal ? 'true' : 'false',
      'aria-labelledby': `${parentId}-title`,
      'aria-describedby': `${parentId}-description`,
    };

    if (!this.isNative) {
      attrs.hidden = !isOpen;
    }

    return attrs;
  }

  protected attach(): DetachFn {
    const parentId = this.dialog?.id ?? 'dialog';
    const panelId = `${parentId}-panel`;

    return attachOverlayLifecycle({
      element: this.element!,
      isOpen: () => !!this.dialog?.open,
      isModal: () => this.dialog?.modality !== 'nonmodal',
      isDismissable: () => this.dialog?.dismissable ?? true,
      excludeFromDismiss: (target: Node) => {
        return !!(target instanceof Element && target.closest(`[aria-controls="${panelId}"]`));
      },
      dismiss: () => {
        if (this.dialog) {
          this.dialog.open = false;
        }
      },
      onOpen: () => this.notifyLifecycle('open'),
      onClose: () => this.notifyLifecycle('close'),
      isNative: this.isNative,
    });
  }

  /**
   * Dispatches a dialog lifecycle event on the panel and invokes the matching consumer handler.
   *
   * @param type - Lifecycle transition to announce
   */
  private notifyLifecycle(type: 'open' | 'close'): void {
    const event: DialogEvent = new CustomEvent(type, { bubbles: false });
    this.element!.dispatchEvent(event);

    if (type === 'open') {
      this.dialog?.properties.onopen?.(event);
    } else {
      this.dialog?.properties.onclose?.(event);
    }
  }
}

/**
 * Interactive trigger button for opening and toggling a dialog.
 */
export class DialogTriggerAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DialogTriggerAttributes<E>
> {
  protected dialog?: DialogAria;

  public get open() {
    return !!this.dialog?.open;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push(
      'id',
      'role',
      'type',
      'open',
      'disabled',
      'tabindex',
      'aria-haspopup',
      'aria-expanded',
      'aria-controls',
      'aria-disabled'
    );
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected createAttributes(): DialogTriggerAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    const isOpen = this.dialog?.open ?? false;

    const attrs: DialogTriggerAttributes<E> = {
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': `${parentId}-panel`,
      onclick: (e: MouseEvent) => this.handleClick(e),
    };

    if (this.isNative) {
      attrs.type = 'button';
      if (this.disabled) {
        attrs.disabled = true;
      }
    } else {
      attrs.role = 'button';
      attrs.tabindex = this.disabled ? -1 : 0;
      if (this.disabled) {
        attrs['aria-disabled'] = 'true';
      }
    }

    return attrs;
  }

  protected handleClick(e: MouseEvent): void {
    if (this.disabled || e.defaultPrevented) return;
    this.dialog?.toggle();
  }
}

/**
 * Close button controller committing dialog open = false.
 */
export class DialogCloseAria<E extends HTMLElement = HTMLElement> extends Aria<E, AriaProps, DialogCloseAttributes<E>> {
  protected dialog?: DialogAria;

  public get open() {
    return !!this.dialog?.open;
  }

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id', 'role', 'type', 'disabled', 'tabindex', 'aria-disabled');
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected createAttributes(): DialogCloseAttributes<E> {
    const attrs: DialogCloseAttributes<E> = {
      onclick: (e: MouseEvent) => this.handleClick(e),
    };

    if (this.isNative) {
      attrs.type = 'button';
      if (this.disabled) {
        attrs.disabled = true;
      }
    } else {
      attrs.role = 'button';
      attrs.tabindex = this.disabled ? -1 : 0;
      if (this.disabled) {
        attrs['aria-disabled'] = 'true';
      }
    }

    return attrs;
  }

  protected handleClick(e: MouseEvent): void {
    if (this.disabled || e.defaultPrevented) return;
    this.dialog?.close();
  }
}

/**
 * Title element controller providing accessible labeling for a dialog panel.
 */
export class DialogTitleAria<E extends HTMLElement = HTMLElement> extends Aria<E, AriaProps, DialogTitleAttributes<E>> {
  protected dialog?: DialogAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id');
    this.update();
  }

  protected createAttributes(): DialogTitleAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    return {
      id: `${parentId}-title`,
    };
  }
}

/**
 * Description element controller providing accessible advisory text for a dialog panel.
 */
export class DialogDescriptionAria<E extends HTMLElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  DialogDescriptionAttributes<E>
> {
  protected dialog?: DialogAria;

  public constructor(props: Partial<AriaProps> = {}, options: AriaOptions = {}) {
    super(props, options);
    this.dialog = dialogCtx.get();
    this.omittedAttrs.push('id');
    this.update();
  }

  protected createAttributes(): DialogDescriptionAttributes<E> {
    const parentId = this.dialog?.id ?? 'dialog';
    return {
      id: `${parentId}-description`,
    };
  }
}
