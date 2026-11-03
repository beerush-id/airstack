import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn } from '../../types.js';
import { attachOverlayLifecycle } from '../../utils/overlay.js';
import { type DialogAria, dialogCtx, type DialogEvent } from './dialog.js';

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
