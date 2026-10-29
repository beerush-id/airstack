import { createContext } from '@airlib/core';
import type { TimelineSegment } from '@airlib/core/timeline';
import type { VideoStageAria } from './stage.js';

export const videoStageCtx = createContext<VideoStageAria>();

/**
 * Whether a segment is left off the stage — neither drawn nor heard — because it, or its whole
 * track, is disabled: a hidden track.
 *
 * @param segment - The segment.
 * @returns Whether it's left off.
 */
export function isSegmentOff(segment: TimelineSegment): boolean {
  return !!(segment.disabled || segment.track.disabled);
}

/**
 * Whether a segment's sound is left unheard: it's off the stage, or its track is muted —
 * `meta.muted` — which keeps its pictures but silences it.
 *
 * @param segment - The segment.
 * @returns Whether its sound is left unheard.
 */
export function isSegmentMuted(segment: TimelineSegment): boolean {
  return isSegmentOff(segment) || !!segment.track.meta?.muted;
}

/**
 * A piece of media a clip plays, decoded by whatever the app provides — the stage needs no decoder
 * of its own. It says how long it runs, hands over its picture at any moment, and its sound, whole.
 * Each clip opens its own, so two clips of one file read their pictures apart.
 */
export interface VideoMedia {
  /** How long it runs, in seconds. */
  readonly duration: number;
  /**
   * Its picture at a moment, in seconds: the frame showing then, held past its end. Nothing when
   * it has no pictures, or the signal aborted while it was decoding.
   */
  frame?(time: number, signal?: AbortSignal): Promise<CanvasImageSource | undefined>;
  /** Its sound, decoded whole; nothing when it has none. */
  sound?(): Promise<AudioBuffer | undefined>;
  /** Lets go of what reading it holds. */
  dispose?(): void;
}

/**
 * Opens media by its address, for one clip.
 *
 * @param src - Where the media is.
 * @returns The media, or nothing when it can't be read.
 */
export type VideoMediaLoader = (src: string) => Promise<VideoMedia | undefined>;

/**
 * How a clip's picture fills its box: cropped to cover it, or fitted whole inside it.
 */
export type VideoMediaFit = 'cover' | 'contain';

export const VIDEO_STAGE = 'video-stage';
export const VIDEO_CLIP = 'video-clip';

/** The size a stage composes at unless told otherwise, in its own units. */
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

/** How long capture waits for the browser to repaint the clips before drawing anyway. */
export const PAINT_TIMEOUT = 1000;

/** How far, in seconds, a playing media clip may drift from the timeline before it is re-seeked. */
export const MEDIA_DRIFT = 0.25;

/**
 * How much faster or slower, at most, a playing media clip plays to catch up with the timeline
 * within the drift it's allowed: 0.1 makes up a tenth of a second each second, too little to hear.
 */
export const MEDIA_CATCHUP = 0.1;

/**
 * How far, in seconds, the stage's sound may come apart from its timeline before it's scheduled
 * again from where the timeline is — a seek while playing, or a frame held up.
 */
export const SOUND_DRIFT = 0.15;

/** How quickly, in seconds, a sound glides to a new volume or balance: short enough to follow a fade, long enough not to click. */
export const SOUND_GLIDE = 0.015;

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
