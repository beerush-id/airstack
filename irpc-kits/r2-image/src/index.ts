import { HTTPTransport } from '@irpclib/http';
import type { IRPCFile, RemoteState } from '@irpclib/irpc';
import { createPackage } from '@irpclib/irpc';
import { resize } from './resize.js';
import type { ClientConfig, ImageMetadata, ImageUploadOptions, ImageUploadState, Resize } from './types.js';
import { formatImageUrl } from './utils/index.js';

export * from './resize.js';
export * from './types.js';
export { isSizeAllowed } from './utils/index.js';

/**
 * IRPC stub function signature for uploading an image with reactive stream tracking.
 */
export type UploadFn = (path: string, file: IRPCFile, options?: ImageUploadOptions) => RemoteState<ImageUploadState>;

/**
 * IRPC stub function signature for deleting an image and its variants.
 */
export type RemoveFn = (path: string) => Promise<boolean>;

/**
 * IRPC stub function signature for retrieving image metadata.
 */
export type InfoFn = (path: string) => Promise<ImageMetadata | undefined>;

/**
 * Universal IRPC package namespace for r2-image.
 */
export const imageModule = createPackage({
  name: 'r2-image',
  version: '1.0.0',
});

/**
 * Configured base domain for public image delivery and default transport.
 */
let baseUrl = '';

/**
 * Default transport initialized to relative '/irpc' for same-origin browser calls.
 */
export const transport = new HTTPTransport({ endpoint: '/irpc' });
imageModule.use(transport);

/**
 * Configures the client transport base URL and optional API key credentials.
 *
 * @param config Client configuration options
 */
export function configure(config: ClientConfig): void {
  /* istanbul ignore else */
  if (config.baseUrl !== undefined) {
    baseUrl = config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : '';
    transport.config.baseURL = baseUrl;
  }

  /* istanbul ignore else */
  if (config.apiKey) {
    transport.sign({ apiKey: config.apiKey });
  }
}

/**
 * Formats a public image URL with requested transformation parameters.
 * Automatically prepends the base URL configured via `configure({ baseUrl })`.
 *
 * @param path Stored image path (e.g. '/photos/vacation.png')
 * @param options Desired width, height, format, or quality
 * @param base Optional base URL override (defaults to configured baseUrl)
 * @returns Clean, formatted image URL
 */
export function url(path: string, options?: Resize, base = baseUrl): string {
  return formatImageUrl(path, options, base);
}

/**
 * Uploads an image file to R2 via IRPC.
 * Supports eager variant generation before resolution and reactive `.later()` bindings.
 */
export const upload = imageModule.declare<UploadFn>('image.upload', () => ({
  step: 'original',
  progress: '',
  path: '',
  type: '',
  size: 0,
}));

/**
 * Deletes an image and all its generated variants from R2.
 */
export const remove = imageModule.declare<RemoveFn>('image.delete', () => false);

/**
 * Retrieves metadata for a stored image in R2.
 */
export const info = imageModule.declare<InfoFn>('image.info');

export default {
  configure,
  upload,
  remove,
  info,
  url,
  resize,
};
