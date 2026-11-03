import type { IRPCData, IRPCFile } from '@irpclib/irpc';
import type { Output, OutputMeta } from '../types/output.js';

/** Supported standardized video aspect ratios. */
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | 'auto' | string;

/** Standard video resolution tiers. */
export type VideoResolution = '720p' | '1080p' | '4k' | string;

/** Supported output video container formats. */
export type VideoFormat = 'mp4' | 'webm' | string;

/** Normalized configuration options for video synthesis and extension. */
export type VideoOptions = {
  /** Textual description or motion instruction for video synthesis. */
  prompt: string;
  /** Target provider model identifier. */
  model?: string;
  /** Desired video aspect ratio. */
  aspectRatio?: VideoAspectRatio;
  /** Target duration in seconds. */
  duration?: number;
  /** Target resolution tier. */
  resolution?: VideoResolution;
  /** Target frames per second. */
  fps?: number;
  /** Elements or camera motions to exclude from generation. */
  negativePrompt?: string;
  /** Deterministic randomization seed. */
  seed?: number;
  /** URLs of reference image(s) or video(s) for conditioning, or IRPCFiles uploaded automatically before dispatch. */
  attachments?: (string | IRPCFile)[];
  /** Output file encoding format. */
  format?: VideoFormat;
  /** Toggles provider safety/NSFW content filtering if supported by the model. */
  nsfwCheck?: boolean;
  /** Configures provider safety tolerance level or threshold if supported by the model. */
  safetyTolerance?: number | string;
};

/**
 * Normalized video output returned by video operations.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface VideoOutput<M extends IRPCData = OutputMeta> extends Output<VideoOptions, M> {
  /** Video duration in seconds if known. */
  duration?: number;
  /** Pixel width of the synthesized video if known. */
  width?: number;
  /** Pixel height of the synthesized video if known. */
  height?: number;
  /** Frames per second of the generated video. */
  fps?: number;
  /** Randomization seed used by the generator. */
  seed?: number;
}
