import type { IRPCData, IRPCFile } from '@irpclib/irpc';
import type { Output, OutputMeta } from '../types/output.js';

/** Supported standardized image aspect ratios. */
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | 'auto' | string;

/** Supported output image encoding formats. */
export type ImageFormat = 'webp' | 'png' | 'jpeg';

/** Generation quality or resolution tiers. */
export type ImageQuality = 'standard' | 'hd' | '2k' | '4k' | string;

/** Normalized configuration options for image synthesis and editing. */
export type ImageOptions = {
  /** Textual description or instruction for image synthesis or editing. */
  prompt: string;
  /** Target provider model identifier. */
  model?: string;
  /** Desired aspect ratio. */
  aspectRatio?: ImageAspectRatio;
  /** Elements or concepts to exclude from generation. */
  negativePrompt?: string;
  /** Deterministic randomization seed. */
  seed?: number;
  /** URLs of reference images for conditioning, or IRPCFiles uploaded automatically before dispatch. */
  attachments?: (string | IRPCFile)[];
  /** Output file encoding format. */
  format?: ImageFormat;
  /** Generation quality or resolution tier. */
  quality?: ImageQuality;
  /** Toggles provider safety/NSFW content filtering if supported by the model. */
  nsfwCheck?: boolean;
  /** Configures provider safety tolerance level or threshold if supported by the model. */
  safetyTolerance?: number | string;
};

/**
 * Normalized image output returned by image operations.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface ImageOutput<M extends IRPCData = OutputMeta> extends Output<ImageOptions, M> {
  /** Pixel width of the generated image if known. */
  width?: number;
  /** Pixel height of the generated image if known. */
  height?: number;
  /** Randomization seed used by the generator. */
  seed?: number;
}
