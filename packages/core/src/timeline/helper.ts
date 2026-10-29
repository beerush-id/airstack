export type FrameId = number | ReturnType<typeof setTimeout>;

/**
 * The signal handed to a handler reached outside a frame delivery, e.g. a segment re-ticking
 * itself after an edit: nothing ever aborts it.
 */
export const IDLE_SIGNAL: AbortSignal = new AbortController().signal;

/**
 * Whether a handler's return value is work to wait for rather than a plain value.
 *
 * @param {unknown} value - What the handler returned.
 * @returns {boolean} Whether it is a promise or another thenable.
 */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

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
 * Converts a discrete 0-indexed frame number to the time it starts at, in seconds.
 * Frame 0 starts at 0s, frame 30 at 1.0s and frame 60 at 2.0s at 30fps.
 */
export function frameToTime(frame: number, frameRate: number): number {
  if (frame < 0) return 0;
  return frame / frameRate;
}

/**
 * Takes a node off its place in the timeline's storage — a track, segment, scene or marker, by id —
 * when an instance acting on it is removed.
 *
 * @param {{ id: string }[] | undefined} nodes - The storage the node is kept in.
 * @param {string} id - The node's id.
 */
export function dropNode(nodes: { id: string }[] | undefined, id: string): void {
  const index = nodes?.findIndex((node) => node.id === id) ?? -1;
  if (index !== -1) nodes?.splice(index, 1);
}

/**
 * Takes a node into the timeline's storage — a track, segment, scene or marker — and hands back the
 * reactive node there, which the instance made for it then acts on.
 *
 * @param {T[]} nodes - The storage to keep it in.
 * @param {T} node - The node, as plain data.
 * @returns {T} The node as kept.
 */
export function keepNode<T>(nodes: T[], node: T): T {
  nodes.push(node);
  return nodes[nodes.length - 1];
}

/**
 * Converts continuous time in seconds to the 0-indexed frame starting nearest to it.
 */
export function timeToFrame(time: number, frameRate: number): number {
  if (time <= 0) return 0;
  return Math.round(time * frameRate);
}
