import type { IRPCData, IRPCFile } from '@irpclib/irpc';
import type { Output, OutputMeta } from '../types/output.js';

/** Media kinds accepted by enhancement operations. */
export type UpscaleType = 'image' | 'video';

/**
 * A single upload item: the binary to transfer and its optional target path on the
 * provider file service (defaults to the driver's standard upload path).
 */
export type UploadItem = {
  /** Binary file to upload; IRPCFile carries the metadata and the payload in one shape. */
  file: IRPCFile;
  /** Target directory path on the provider file service, without leading/trailing slashes. */
  path?: string;
};

/**
 * Normalized input for media enhancement operations.
 * Carries the source asset kind and its location: a hosted URL or an IRPCFile
 * uploaded automatically before dispatch.
 */
export type UpscaleInput = {
  /** Kind of media being enhanced. */
  type: UpscaleType;
  /** Hosted URL of the source asset, or an IRPCFile uploaded automatically before dispatch. */
  url: string | IRPCFile;
};

/**
 * Normalized output returned by media enhancement operations.
 * Extends canonical Output with the enhanced asset location.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export type UpscaleOutput<M extends IRPCData = OutputMeta> = Output<UpscaleInput, M>;
