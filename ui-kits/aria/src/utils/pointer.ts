/**
 * Pointer handlers for an active drag session.
 */
export interface DragSessionHandlers {
  host?: HTMLElement;
  startX?: number;
  startY?: number;
  orientation?: 'horizontal' | 'vertical';

  /**
   * Handles pointer travel anywhere in the window while the session is open.
   */
  onMove: (e: PointerEvent) => void;

  /**
   * Handles the pointer release ending the session.
   */
  onUp: (e: PointerEvent) => void;

  /**
   * Handles session cancellation without a release.
   */
  onCancel: (e: PointerEvent) => void;
}

/**
 * Opens a window-level drag session routing pointer travel to the given handlers
 * regardless of which element sits under the pointer. The session ends itself on
 * pointer release or cancellation; the returned closer also ends it early and
 * stays safe to call after the session already ended.
 *
 * Shared by draggable roles (sliders, splitters) so pointer capture gaps never
 * strand a drag when the pointer leaves the grabbing element.
 *
 * @param options - Session move, release, and cancellation handlers
 * @returns Closer ending the session early
 */
export function openDragSession(options: DragSessionHandlers): () => void {
  const handleUp = (e: PointerEvent): void => {
    options.onUp(e);

    if (options.host) {
      options.host.style.removeProperty('--drag-move-x');
      options.host.style.removeProperty('--drag-move-y');
      options.host.style.removeProperty('--drag-start-x');
      options.host.style.removeProperty('--drag-start-y');
    }

    close();
  };

  const handleCancel = (e: PointerEvent): void => {
    options.onCancel(e);
    close();
  };

  const handleMove = (e: PointerEvent): void => {
    if (options.host) {
      /* istanbul ignore next */
      const { startX = 0, startY = 0, host, orientation } = options;

      const moveX = e.clientX - startX;
      const moveY = e.clientY - startY;

      if (!orientation || orientation === 'horizontal') {
        host.style.setProperty('--drag-start-x', `${startX}px`);
        host.style.setProperty('--drag-move-x', `${moveX}px`);
      }
      if (!orientation || orientation === 'vertical') {
        host.style.setProperty('--drag-start-y', `${startY}px`);
        host.style.setProperty('--drag-move-y', `${moveY}px`);
      }
    }

    options.onMove(e);
  };

  function close(): void {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
  }

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp);
  window.addEventListener('pointercancel', handleCancel);
  return close;
}
