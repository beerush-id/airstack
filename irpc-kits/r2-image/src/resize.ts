import { type AnyType, HandlerError, IRPCFile } from '@irpclib/irpc';
import { isBrowser } from '@irpclib/irpc/core';
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
  if (isBrowser()) {
    return browserResize(source, options);
  }

  resolveNImage ??= import(/* @vite-ignore */ RESIZER_PACKAGE);
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

/**
 * Resizes and transforms an image using native browser Canvas and createImageBitmap APIs.
 * Runs entirely on the client with zero external WebAssembly binaries or network overhead.
 *
 * @param source Input image source (IRPCFile, Blob, Uint8Array, or ArrayBuffer)
 * @param options Target resize dimensions, format, and quality parameters
 * @returns Transformed image packaged as an IRPCFile ready for upload
 */
export async function browserResize(source: ImageSource, options: Resize = {}): Promise<IRPCFile<ImageFileMeta>> {
  const { blob, name } = await resolveSourceBlob(source);
  const image = await loadSourceImage(blob);

  if (image.width * image.height > MAX_INPUT_PIXELS) {
    image.close();
    throw HandlerError.failed('Image resolution exceeds maximum allowable limits (64 MP)');
  }

  let targetWidth = options.width!;
  let targetHeight = options.height!;

  if (options.size) {
    if (image.width >= image.height) {
      targetWidth = options.size;
      targetHeight = Math.max(1, Math.round(image.height * (options.size / image.width)));
    } else {
      targetHeight = options.size;
      targetWidth = Math.max(1, Math.round(image.width * (options.size / image.height)));
    }
  } else if (targetWidth && !targetHeight) {
    targetHeight = Math.max(1, Math.round(image.height * (targetWidth / image.width)));
  } else if (targetHeight && !targetWidth) {
    targetWidth = Math.max(1, Math.round(image.width * (targetHeight / image.height)));
  } else if (!targetWidth && !targetHeight) {
    targetWidth = image.width;
    targetHeight = image.height;
  }

  if (options.fit === 'inside' && options.width && options.height) {
    const scale = Math.min(options.width / image.width, options.height / image.height, 1);
    targetWidth = Math.max(1, Math.round(image.width * scale));
    targetHeight = Math.max(1, Math.round(image.height * scale));
  }

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : Object.assign(document.createElement('canvas'), { width: targetWidth, height: targetHeight });

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (options.blur && options.blur > 0) {
    ctx.filter = `blur(${options.blur}px)`;
  }

  if (options.fit === 'cover' && options.width && options.height) {
    const srcRatio = image.width / image.height;
    const dstRatio = targetWidth / targetHeight;
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;

    if (srcRatio > dstRatio) {
      sw = Math.round(image.height * dstRatio);
      sx = Math.round((image.width - sw) / 2);
    } else {
      sh = Math.round(image.width / dstRatio);
      sy = Math.round((image.height - sh) / 2);
    }

    ctx.drawImage(image.element, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  } else if (options.fit === 'contain' && options.width && options.height) {
    const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
    const dw = Math.round(image.width * scale);
    const dh = Math.round(image.height * scale);
    const dx = Math.round((targetWidth - dw) / 2);
    const dy = Math.round((targetHeight - dh) / 2);

    ctx.drawImage(image.element, 0, 0, image.width, image.height, dx, dy, dw, dh);
  } else {
    ctx.drawImage(image.element, 0, 0, targetWidth, targetHeight);
  }

  image.close();

  const format = options.format || 'webp';
  const quality = options.quality ? Math.min(100, Math.max(1, options.quality)) / 100 : 0.8;
  const mimeType = FORMAT_MIME_MAP[format] || 'image/webp';

  let outputBlob: Blob;
  if ('convertToBlob' in canvas) {
    outputBlob = await canvas.convertToBlob({ type: mimeType, quality });
  } else {
    outputBlob = await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(HandlerError.failed('Canvas conversion to blob failed'))),
        mimeType,
        quality
      );
    });
  }

  const baseName = options.name || (name ? name.replace(/\.[^/.]+$/, '') : 'image');
  const fileName = `${baseName}.${format}`;

  return new IRPCFile<ImageFileMeta>(
    {
      name: fileName,
      type: outputBlob.type || mimeType,
      size: outputBlob.size,
      width: targetWidth,
      height: targetHeight,
    },
    outputBlob
  );
}

/**
 * Resolves various image source representations into a Blob and optional file name for browser processing.
 */
async function resolveSourceBlob(source: ImageSource): Promise<{ blob: Blob; name?: string }> {
  if (source instanceof IRPCFile) {
    return { blob: source.data, name: source.meta.name };
  }

  if (source instanceof Blob) {
    const name = 'name' in source && typeof source.name === 'string' ? source.name : undefined;
    return { blob: source, name };
  }

  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    return { blob: new Blob([source as BlobPart]) };
  }

  throw HandlerError.failed(
    'Invalid image source type provided for resize: expected IRPCFile, Blob, ArrayBuffer, or Uint8Array'
  );
}

/**
 * Loads an image representation using createImageBitmap or HTMLImageElement fallback.
 */
async function loadSourceImage(blob: Blob): Promise<{
  element: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap !== 'undefined') {
    const bitmap = await createImageBitmap(blob);
    return {
      element: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({
        element: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(HandlerError.failed('Failed to decode image in browser'));
    };
    img.src = objectUrl;
  });
}
