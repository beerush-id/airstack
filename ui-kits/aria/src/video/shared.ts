import { createContext } from '@airlib/core';
import type { VideoStageAria } from './stage.js';

export const videoStageCtx = createContext<VideoStageAria>();

export const VIDEO_STAGE = 'video-stage';
export const VIDEO_CLIP = 'video-clip';

/** The size a stage composes at unless told otherwise, in its own units. */
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

/** How long capture waits for the browser to repaint the clips before drawing anyway. */
export const PAINT_TIMEOUT = 1000;

/** How far, in seconds, a playing media clip may drift from the timeline before it is re-seeked. */
export const MEDIA_DRIFT = 0.25;

/** How long before its segment starts, in seconds, a previewed clip is put on stage, painted but unseen. */
export const VIDEO_PREROLL = 2;

/**
 * The opacity a previewed clip never goes below: low enough to be unseen, high enough that the
 * browser still paints it. At 0 the browser skips painting it, so its pictures are first drawn a
 * couple of frames after it shows — a flicker even when the file is cached.
 */
export const PAINTED_OPACITY = 0.001;

/**
 * Settles once every value that is work to wait for has settled; at once when none is.
 *
 * @param values - What clips and handlers returned.
 * @returns The wait, or undefined when there is nothing to wait for.
 */
export function settleAll(values: unknown[]): Promise<unknown> | undefined {
  const waiting = values.filter(
    (value): value is PromiseLike<unknown> =>
      value !== null && typeof value === 'object' && typeof (value as PromiseLike<unknown>).then === 'function'
  );
  return waiting.length ? Promise.allSettled(waiting) : undefined;
}
