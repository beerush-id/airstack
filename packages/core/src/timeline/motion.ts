import type { AnyType } from '../types.js';
import type { TimelineSegment } from './segment.js';

/**
 * Where a layer sits and how it moves, whatever draws it, in the composition's own units: its
 * box, how much it has grown and turned (degrees), both about the box's centre, and how opaque it is.
 */
export type MotionBox = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
};

/**
 * Maps a keyframe span's linear progress (0 to 1) to eased progress.
 */
export type EaseFn = (t: number) => number;

/**
 * The easings a keyframe can name in its `meta.ease`, by name. Add to it to name more.
 */
export const EASES: Record<string, EaseFn> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  'in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/**
 * Whether a segment is on the stage at a timeline frame: from its first frame through its last.
 *
 * @param {TimelineSegment} segment - The segment.
 * @param {number} frame - The frame on the timeline.
 * @returns {boolean} Whether it shows.
 */
export function isSegmentOn(segment: TimelineSegment, frame: number): boolean {
  return !segment.disabled && frame >= segment.startFrame && frame <= segment.endFrame;
}

/**
 * How far into a segment's content a timeline frame is, in seconds, e.g. where its media should
 * be: from its offset at its first frame.
 *
 * @param {TimelineSegment} segment - The segment.
 * @param {number} frame - The frame on the timeline.
 * @returns {number} Seconds into its content.
 */
export function segmentTime(segment: TimelineSegment, frame: number): number {
  return (frame - segment.startFrame + segment.offsetFrame) / segment.timeline.frameRate;
}

/**
 * A segment's values at a timeline frame: its `props`, overridden by the keyframe at or before the
 * frame, with every number the next keyframe sets carried toward it, eased by the earlier keyframe's
 * `meta.ease`. Before the first keyframe it holds the first; after the last it holds the last.
 * Values that aren't numbers switch at the keyframe instead of blending.
 *
 * @param {TimelineSegment} segment - The segment.
 * @param {number} frame - The frame on the timeline.
 * @returns The values to draw it with.
 */
export function sampleSegment<P extends Record<string, AnyType>>(segment: TimelineSegment<P>, frame: number): P {
  const scenes = segment.scenes;
  if (!scenes.length) return { ...segment.props };

  // Keyframes are placed in its content, which starts at its offset.
  const local = frame - segment.startFrame + segment.offsetFrame;
  const index = scenes.findLastIndex((scene) => scene.atFrame <= local);
  const from = scenes[Math.max(index, 0)];
  const to = index < 0 ? undefined : scenes[index + 1];
  const values: Record<string, unknown> = { ...segment.props, ...from.data };
  if (!to || to.atFrame <= from.atFrame) return values as P;

  const ease = EASES[(from.meta?.ease as string) ?? 'linear'] ?? EASES.linear;
  const t = ease(Math.min(1, Math.max(0, (local - from.atFrame) / (to.atFrame - from.atFrame))));
  for (const [key, end] of Object.entries(to.data)) {
    const start = values[key];
    if (typeof start === 'number' && typeof end === 'number') values[key] = start + (end - start) * t;
  }
  return values as P;
}
