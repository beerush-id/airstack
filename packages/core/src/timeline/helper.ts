export type FrameId = number | ReturnType<typeof setTimeout>;

/**
 * Schedules an animation frame using requestAnimationFrame in browser environments,
 * falling back to setTimeout in non-browser (e.g. Node.js/SSR) environments.
 *
 * @param {(timestamp: number) => void} callback - Callback invoked with the high-resolution timestamp.
 * @param {number} [frameRate=30] - Target frame rate used for the fallback interval.
 * @returns {FrameId} Frame identifier that can be passed to cancelFrame.
 */
export function animationFrame(callback: (timestamp: number) => void, frameRate = 30): FrameId {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(performance.now()), 1000 / frameRate);
}

/**
 * Cancels a scheduled animation frame or fallback timer.
 *
 * @param {FrameId} frameId - The frame identifier returned by animationFrame.
 */
export function cancelFrame(frameId: FrameId): void {
  if (typeof cancelAnimationFrame !== 'undefined' && typeof frameId === 'number') {
    cancelAnimationFrame(frameId);
  } else {
    clearTimeout(frameId);
  }
}

/**
 * Converts a discrete 0-indexed frame number to timeline time in seconds.
 * In a 0-indexed timeline, frame 0 is the 1st frame (duration 1/fps),
 * frame 29 represents 1.0s (30th frame completed), frame 59 represents 2.0s, etc.
 */
export function frameToTime(frame: number, frameRate: number): number {
  if (frame < 0) return 0;
  return (frame + 1) / frameRate;
}

/**
 * Converts continuous time in seconds to the corresponding discrete 0-indexed frame number.
 */
export function timeToFrame(time: number, frameRate: number): number {
  if (time <= 0) return 0;
  return Math.max(0, Math.round(time * frameRate) - 1);
}
