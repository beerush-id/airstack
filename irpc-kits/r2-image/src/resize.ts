import { type AnyType, HandlerError, IRPCFile } from '@irpclib/irpc';
import type { Transformer } from '@napi-rs/image';
import type { ImageFileMeta, ImageSource, Resize } from './types.js';

/**
 * Supported output formats mapped to MIME types.
 */
const FORMAT_MIME_MAP: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/**
 * Maximum allowable resolution (64 Megapixels) for decompression bomb protection.
 */
const MAX_INPUT_PIXELS = 67_108_864;

let resolveNImage: Promise<AnyType> | undefined;

// Do not inline the import to prevent bundle optimization from removing the dynamic import.
const RESIZER_PACKAGE = '@napi-rs/image';

/**
 * Resizes and transforms an image using the local @napi-rs/image engine.
 * Runs isomorphically in both the browser (via WebAssembly) and server runtimes (via native bindings).
 *
 * @param source Input image source (IRPCFile, Blob, Uint8Array, or ArrayBuffer)
 * @param options Target resize dimensions, format, and quality parameters
 * @returns Transformed image packaged as an IRPCFile ready for upload
 */
export async function resize(source: ImageSource, options: Resize = {}): Promise<IRPCFile<ImageFileMeta>> {
  resolveNImage ??= import(RESIZER_PACKAGE);
  const ResolvedTransformer = (await resolveNImage).Transformer as typeof Transformer;

  const { buffer, name } = await resolveSourceBuffer(source);
  const transformer = new ResolvedTransformer(buffer);
  const meta = await transformer.metadata();

  if (meta.width * meta.height > MAX_INPUT_PIXELS) {
    throw HandlerError.failed('Image resolution exceeds maximum allowable limits (64 MP)');
  }

  let targetWidth = options.width!;
  let targetHeight = options.height!;

  if (options.size) {
    if (meta.width >= meta.height) {
      targetWidth = options.size;
      targetHeight = Math.max(1, Math.round(meta.height * (options.size / meta.width)));
    } else {
      targetHeight = options.size;
      targetWidth = Math.max(1, Math.round(meta.width * (options.size / meta.height)));
    }
  } else if (targetWidth && !targetHeight) {
    targetHeight = Math.max(1, Math.round(meta.height * (targetWidth / meta.width)));
  } else if (targetHeight && !targetWidth) {
    targetWidth = Math.max(1, Math.round(meta.width * (targetHeight / meta.height)));
  }

  /* istanbul ignore else */
  if (targetWidth && targetHeight) {
    transformer.resize(targetWidth, targetHeight);
  }

  /* istanbul ignore else */
  if (options.blur && options.blur > 0) {
    transformer.blur(options.blur);
  }

  const format = options.format || 'webp';
  const quality = options.quality ? Math.min(100, Math.max(1, options.quality)) : 80;

  let outputBuffer: Uint8Array;
  if (format === 'webp') {
    outputBuffer = await transformer.webp(quality);
  } else if (format === 'avif') {
    outputBuffer = await transformer.avif({ quality });
  } else if (format === 'png') {
    outputBuffer = await transformer.png();
  } else {
    outputBuffer = await transformer.jpeg(quality);
  }

  const mimeType = FORMAT_MIME_MAP[format];
  const baseName = options.name || (name ? name.replace(/\.[^/.]+$/, '') : 'image');
  const fileName = `${baseName}.${format}`;

  const blob = new Blob([outputBuffer as BlobPart], { type: mimeType });

  return new IRPCFile(
    {
      name: fileName,
      type: mimeType,
      size: blob.size,
      width: targetWidth,
      height: targetHeight,
    },
    blob
  );
}

/**
 * Resolves various image source representations into a Uint8Array.
 *
 * @param source Raw input image source
 * @returns Resolved byte array and optional original file name
 */
async function resolveSourceBuffer(source: ImageSource): Promise<{ buffer: Uint8Array; name?: string }> {
  if (source instanceof IRPCFile) {
    const arrayBuffer = await source.data.arrayBuffer();
    return { buffer: new Uint8Array(arrayBuffer), name: source.meta.name };
  }

  if (source instanceof Blob) {
    const arrayBuffer = await source.arrayBuffer();
    const name = 'name' in source && typeof source.name === 'string' ? source.name : undefined;
    return { buffer: new Uint8Array(arrayBuffer), name };
  }

  if (source instanceof ArrayBuffer) {
    return { buffer: new Uint8Array(source) };
  }

  if (source instanceof Uint8Array) {
    return { buffer: source };
  }

  throw HandlerError.failed(
    'Invalid image source type provided for resize: expected IRPCFile, Blob, ArrayBuffer, or Uint8Array'
  );
}
