import type { ImageMetadata, R2Bucket, R2Object, R2ObjectBody, Resize } from '../types.js';

const cleanPath = (path: string): string => path.replace(/^\/+/, '');
const cleanPrefix = (prefix: string): string => (prefix.endsWith('/') ? prefix : `${prefix}/`);

/**
 * Derives a deterministic R2 storage key for a rendered image variant.
 *
 * @param path Original image path (e.g. '/photos/vacation.png')
 * @param transforms Transformation parameters applied
 * @param prefix Optional variant folder prefix in R2
 * @returns Deterministic variant key (e.g. 'photos/vacation.png-thumb.webp' or '.variants/photos/vacation.png/thumb.webp')
 */
export function getVariantKey(
  path: string,
  transforms: Resize,
  prefix?: string
): string {
  const format = transforms.format || 'webp';
  const clean = cleanPath(path);

  let paramString: string;
  if (transforms.name) {
    paramString = transforms.name;
  } else {
    const parts: string[] = [];
    /* istanbul ignore else */
    if (transforms.width) parts.push(`w_${transforms.width}`);
    /* istanbul ignore else */
    if (transforms.height) parts.push(`h_${transforms.height}`);
    /* istanbul ignore else */
    if (transforms.quality) parts.push(`q_${transforms.quality}`);
    /* istanbul ignore else */
    if (transforms.fit) parts.push(`fit_${transforms.fit}`);
    /* istanbul ignore else */
    if (transforms.blur) parts.push(`b_${transforms.blur}`);

    paramString = parts.length > 0 ? parts.join('_') : 'original';
  }

  if (prefix) {
    return `${cleanPrefix(prefix)}${clean}/${paramString}.${format}`;
  }

  return `${clean}-${paramString}.${format}`;
}

/**
 * Retrieves the raw original image object from R2.
 */
export async function getOriginal(bucket: R2Bucket, path: string): Promise<R2ObjectBody | null> {
  return bucket.get(cleanPath(path));
}

/**
 * Retrieves an existing rendered variant from R2.
 */
export async function getVariant(bucket: R2Bucket, variantKey: string): Promise<R2ObjectBody | null> {
  return bucket.get(variantKey);
}

/**
 * Persists a newly uploaded original image to R2.
 */
export async function putOriginal(
  bucket: R2Bucket,
  path: string,
  data: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
  contentType: string
): Promise<R2Object> {
  return putStorageObject(bucket, cleanPath(path), data, contentType);
}

/**
 * Persists a newly rendered image variant to R2.
 */
export async function putVariant(
  bucket: R2Bucket,
  variantKey: string,
  data: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
  contentType: string,
  originalEtag?: string
): Promise<R2Object> {
  return putStorageObject(
    bucket,
    variantKey,
    data,
    contentType,
    originalEtag ? { originalEtag } : undefined
  );
}

/**
 * Persists an object to R2 with long-term immutable caching headers.
 */
function putStorageObject(
  bucket: R2Bucket,
  key: string,
  data: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
  contentType: string,
  customMetadata?: Record<string, string>
): Promise<R2Object> {
  return bucket.put(key, data, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata,
  });
}

/**
 * Purges all rendered variants for an image from R2.
 */
export async function deleteVariants(
  bucket: R2Bucket,
  path: string,
  prefix?: string
): Promise<void> {
  const targetKey = cleanPath(path);
  const variantPrefix = prefix ? `${cleanPrefix(prefix)}${targetKey}/` : `${targetKey}-`;

  let cursor: string | undefined;
  do {
    const listResult = await bucket.list({ prefix: variantPrefix, cursor });
    /* istanbul ignore else */
    if (listResult.objects.length > 0) {
      const keysToDelete = listResult.objects.map((obj) => obj.key);
      await bucket.delete(keysToDelete);
    }
    cursor = listResult.truncated ? listResult.cursor : undefined;
  } while (cursor);
}

/**
 * Deletes an original image along with all its cached variants from R2.
 */
export async function deleteImage(
  bucket: R2Bucket,
  path: string,
  prefix?: string
): Promise<boolean> {
  const targetKey = cleanPath(path);

  // 1. Delete the original image
  await bucket.delete(targetKey);

  // 2. Purge all rendered variants
  await deleteVariants(bucket, path, prefix);

  return true;
}

/**
 * Reads metadata for an original image stored in R2.
 */
export async function getImageMetadata(
  bucket: R2Bucket,
  path: string
): Promise<ImageMetadata | undefined> {
  const cleanKey = cleanPath(path);
  const obj = await bucket.head(cleanKey);
  if (!obj) return undefined;

  return {
    path: `/${cleanKey}`,
    type: obj.httpMetadata?.contentType as string,
    size: obj.size,
    uploadedAt: obj.uploaded.toISOString(),
    etag: obj.etag,
  };
}
