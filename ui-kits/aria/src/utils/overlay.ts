import { effect } from '@airlib/core';
import type { DetachFn } from '../types.js';
import { queryFocusable } from './navigation.js';

/**
 * Configuration options for managing an overlay element's lifecycle and focus.
 */
export interface OverlayLifecycleOptions {
  /**
   * The mounted overlay DOM element.
   */
  element: HTMLElement;

  /**
   * Returns whether the overlay is currently open.
   */
  isOpen: () => boolean;

  /**
   * Returns whether the overlay is modal (trapping focus).
   * Defaults to true.
   */
  isModal?: () => boolean;

  /**
   * Returns whether the overlay can be dismissed via Escape or outside clicks.
   * Defaults to true.
   */
  isDismissable?: () => boolean;

  /**
   * Requests the owner to close the overlay. Invoked on a dismissal path, before any
   * state changes; the owner performs the actual close.
   */
  dismiss: () => void;

  /**
   * Whether bound to a native <dialog> host.
   * Defaults to false.
   */
  isNative?: boolean;

  /**
   * Whether to move focus into the overlay when it opens.
   * Defaults to true for modal overlays (`isModal()`), false otherwise.
   */
  autoFocus?: boolean;

  /**
   * Whether to restore focus to the previously active element upon closing.
   * Defaults to true.
   */
  restoreFocus?: boolean;

  /**
   * Optional predicate to exclude external elements (such as triggers) from outside dismissal.
   */
  excludeFromDismiss?: (target: Node) => boolean;

  /**
   * Invoked after the overlay becomes visible: native display, focus capture, and
   * autofocus all settled. Fires once per transition, never at attach time.
   */
  onOpen?: () => void;

  /**
   * Invoked after the overlay stops being visible, from every path that closes it
   * (programmatic state write, Escape, light dismissal, or native close).
   */
  onClose?: () => void;
}

/** Where a trigger's styles add anchors of their own, after the overlays'. */
const PAGE_ANCHORS = 'var(--aria-anchor-name, --aria-no-anchor)';

/**
 * The anchor names a trigger wears while its overlay is open: the overlay's
 * own, plus any its styles declare in `--aria-anchor-name`. Written inline,
 * the overlay's name would otherwise replace an anchor the page gave the same
 * element — the pressed member a toggle group's indicator glides to. A trigger
 * can hold more than one overlay — a popover and a tooltip — so the names the
 * others already wrote stay beside this one's.
 *
 * @param own - The overlay's anchor name, a dashed ident.
 * @param current - The trigger's `anchor-name` as the other overlays left it, if any.
 * @returns The `anchor-name` value for the trigger.
 */
export function triggerAnchorName(own: string, current?: string): string {
  // Only the overlays' plain names carry over; the page's slot is written once, at the end.
  const names = (current ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => /^--[\w-]+$/.test(name) && name !== '--aria-no-anchor');
  if (!names.includes(own)) names.push(own);
  return `${names.join(', ')}, ${PAGE_ANCHORS}`;
}

/**
 * Manages the DOM lifecycle, focus trapping, light-dismiss, and focus restoration
 * for an overlay element across modal and non-modal states.
 *
 * Captures `document.activeElement` when the overlay opens and restores focus
 * upon closure or teardown. Traps focus within focusable children when modal.
 *
 * @param options - Overlay lifecycle options
 * @returns Detachment callback to tear down listeners and restore focus on unmount
 */
export function attachOverlayLifecycle(options: OverlayLifecycleOptions): DetachFn {
  const {
    element,
    isOpen,
    isModal = () => true,
    isDismissable = () => true,
    dismiss,
    isNative = false,
    autoFocus,
    restoreFocus = true,
    excludeFromDismiss,
    onOpen,
    onClose,
  } = options;

  let previouslyFocused: HTMLElement | null = null;
  let hasOpened = false;
  let focusRafId: number | null = null;
  const cleanups: Array<() => void> = [];

  const stopEffect = effect(() => {
    const open = isOpen();

    if (open) {
      if (!hasOpened) {
        hasOpened = true;

        const active = element.ownerDocument.activeElement;
        if (active instanceof HTMLElement && active !== element && !element.contains(active)) {
          previouslyFocused = active;
        }

        if (isNative || element instanceof HTMLDialogElement) {
          const dialogEl = element as HTMLDialogElement;
          const modal = isModal();
          if (modal && typeof dialogEl.showModal === 'function') {
            dialogEl.showModal();
          } else if (typeof dialogEl.show === 'function') {
            dialogEl.show();
          }
        }

        const shouldAutoFocus = autoFocus ?? isModal();
        /* istanbul ignore next */
        if (shouldAutoFocus) {
          const moveFocus = (): void => {
            if (!isOpen()) return;
            const autofocusTarget = element.querySelector<HTMLElement>('[autofocus]');
            if (autofocusTarget && typeof autofocusTarget.focus === 'function') {
              autofocusTarget.focus();
            } else {
              const focusables = queryFocusable(element);
              if (focusables.length > 0) {
                focusables[0].focus();
              } else if (typeof element.focus === 'function') {
                element.focus();
              }
            }
          };

          moveFocus();

          if (typeof requestAnimationFrame !== 'undefined') {
            if (focusRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
              cancelAnimationFrame(focusRafId);
            }
            focusRafId = requestAnimationFrame(() => {
              focusRafId = null;
              if (!isOpen()) return;
              const current = element.ownerDocument.activeElement;
              const autofocusTarget = element.querySelector<HTMLElement>('[autofocus]');
              if (autofocusTarget) {
                if (current !== autofocusTarget && typeof autofocusTarget.focus === 'function') {
                  autofocusTarget.focus();
                }
              } else if (current === element || !element.contains(current)) {
                moveFocus();
              }
            });
          }
        }
        onOpen?.();
      }
    } else if (hasOpened) {
      hasOpened = false;

      if (focusRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(focusRafId);
        focusRafId = null;
      }

      if (isNative || element instanceof HTMLDialogElement) {
        const dialogEl = element as HTMLDialogElement;
        if (typeof dialogEl.close === 'function') {
          dialogEl.close();
        }
      }

      if (restoreFocus && previouslyFocused) {
        previouslyFocused.focus();
        previouslyFocused = null;
      }

      onClose?.();
    }
  });
  cleanups.push(stopEffect);

  const onDocumentPointerDown = (e: PointerEvent | MouseEvent): void => {
    if (!isOpen() || !isDismissable()) return;
    const target = e.target as Node;
    if (element.contains(target) || excludeFromDismiss?.(target)) return;
    dismiss();
  };
  document.addEventListener('pointerdown', onDocumentPointerDown);
  cleanups.push(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
  });

  if (isNative || element instanceof HTMLDialogElement) {
    const dialogEl = element as HTMLDialogElement;
    const onNativeCancel = (e: Event): void => {
      if (!isDismissable()) {
        e.preventDefault();
      } else {
        dismiss();
      }
    };
    const onNativeClose = (): void => {
      dismiss();
    };

    dialogEl.addEventListener('cancel', onNativeCancel);
    dialogEl.addEventListener('close', onNativeClose);
    cleanups.push(() => {
      dialogEl.removeEventListener('cancel', onNativeCancel);
      dialogEl.removeEventListener('close', onNativeClose);
    });
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    handleOverlayKeyDown(e, {
      element,
      isOpen,
      isModal,
      isDismissable,
      dismiss,
    });
  };
  element.addEventListener('keydown', onKeyDown);
  cleanups.push(() => {
    element.removeEventListener('keydown', onKeyDown);
  });

  return () => {
    if (focusRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(focusRafId);
      focusRafId = null;
    }
    for (const cleanup of cleanups) {
      cleanup();
    }
    if (hasOpened && isOpen() && restoreFocus && previouslyFocused) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  };
}

/**
 * Handles keyboard interaction for an overlay container, including Escape dismissal
 * with cancel veto and Tab focus trapping when modal.
 *
 * @param event - The incoming keyboard event
 * @param options - Overlay keydown configuration options
 * @returns Whether the key event was handled
 */
export function handleOverlayKeyDown(
  event: KeyboardEvent,
  options: {
    element: HTMLElement;
    isOpen: () => boolean;
    isModal?: () => boolean;
    isDismissable?: () => boolean;
    dismiss: () => void;
  }
): boolean {
  const { element, isOpen, isModal = () => true, isDismissable = () => true, dismiss } = options;

  if (event.key === 'Escape') {
    if (!isOpen() || !isDismissable()) {
      return false;
    }

    event.preventDefault();
    const cancelEvent = new CustomEvent<void>('cancel', {
      bubbles: false,
      cancelable: true,
    });

    element.dispatchEvent(cancelEvent);

    if (!cancelEvent.defaultPrevented) {
      dismiss();
      return true;
    }
    return false;
  }

  if (event.key === 'Tab') {
    if (!isOpen() || !isModal()) {
      return false;
    }

    const focusables = queryFocusable(element);
    if (focusables.length === 0) {
      event.preventDefault();
      return true;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = element.ownerDocument.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (current === first || !focusables.includes(current as HTMLElement)) {
        event.preventDefault();
        last.focus();
        return true;
      }
    } else {
      if (current === last || !focusables.includes(current as HTMLElement)) {
        event.preventDefault();
        first.focus();
        return true;
      }
    }
  }

  return false;
}
