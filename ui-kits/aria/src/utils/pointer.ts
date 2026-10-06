/**
 * Pointer handlers for an active drag session.
 */
export interface DragSessionHandlers {
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
 * @param handlers - Session move, release, and cancellation handlers
 * @returns Closer ending the session early
 */
export function openDragSession(handlers: DragSessionHandlers): () => void {
  const handleUp = (e: PointerEvent): void => {
    handlers.onUp(e);
    close();
  };

  const handleCancel = (e: PointerEvent): void => {
    handlers.onCancel(e);
    close();
  };

  function close(): void {
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
  }

  window.addEventListener('pointermove', handlers.onMove);
  window.addEventListener('pointerup', handleUp);
  window.addEventListener('pointercancel', handleCancel);
  return close;
}
