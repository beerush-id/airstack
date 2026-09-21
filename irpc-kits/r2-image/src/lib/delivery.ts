import type { DurableObjectNamespace, ExecutionContext, Fetcher, ImageWorkerEnv, R2Bucket, Resize } from '../types.js';
import { isSizeAllowed, parseImageRequest } from '../utils/index.js';
import { resizeImage, resolveBucket, resolveResizer } from './resizer.js';
import { getOriginal, getVariant, getVariantKey, putVariant } from './storage.js';

export interface DeliveryOptions<Env> {
  variantPrefix?: string;
  browserTtl: number;
  edgeTtl: number;
  bucketResolver?: keyof Env | ((env: Env) => R2Bucket);
  resizerResolver?: keyof Env | ((env: Env) => DurableObjectNamespace | Fetcher | string);
  onDemand?: boolean;
  allowedSizes?: (number | Resize)[];
  sizes?: Resize[];
}

/**
 * Handles binary image delivery using Cloudflare Edge Cache, R2, and container resizing.
 *
 * @param request Incoming GET request
 * @param url Parsed request URL
 * @param env Worker environment bindings
 * @param ctx Worker execution context
 * @param options Delivery and caching options
 * @returns Binary image HTTP Response
 */
export async function handleImageDelivery<Env extends ImageWorkerEnv>(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext,
  options: DeliveryOptions<Env>
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;

  // 1. Check Cloudflare Edge Cache
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const { path, transforms, isOriginal: rawIsOriginal } = parseImageRequest(url);
  if (!path) {
    return new Response('Image not found', { status: 404 });
  }

  // Resolve preset dimensions from worker sizes if named preset requested
  if (transforms.name && options.sizes) {
    const preset = options.sizes.find((s) => s.name === transforms.name);
    if (preset) {
      Object.assign(transforms, { ...preset, ...transforms });
    }
  }

  // If transforms are not allowed by whitelist, skip the transform and serve original image
  const isAllowed = rawIsOriginal || isSizeAllowed(transforms, options.allowedSizes);
  const isOriginal = rawIsOriginal || !isAllowed;

  const bucket = resolveBucket(env, options.bucketResolver);
  const resizer = resolveResizer(env, options.resizerResolver);

  const cacheHeaders = {
    'Cache-Control': `public, max-age=${options.browserTtl}, s-maxage=${options.edgeTtl}, immutable`,
  };

  // 2. Original Image Requested (or transform skipped)
  if (isOriginal) {
    const original = await getOriginal(bucket, path);
    if (!original) {
      return new Response('Image not found', { status: 404 });
    }

    const contentType = original.httpMetadata?.contentType as string;
    return respondAndCache(original.body, contentType, cacheHeaders, request, ctx, cache, original.httpEtag);
  }

  // 3. Transformed Variant Requested: Check R2 Variant Storage
  const variantKey = getVariantKey(path, transforms, options.variantPrefix);
  const existingVariant = await getVariant(bucket, variantKey);

  if (existingVariant) {
    const contentType = existingVariant.httpMetadata?.contentType as string;
    return respondAndCache(
      existingVariant.body,
      contentType,
      cacheHeaders,
      request,
      ctx,
      cache,
      existingVariant.httpEtag
    );
  }

  // 4. Variant Cache Miss: Check if on-demand resizing is permitted
  /* istanbul ignore else */
  if (options.onDemand === false) {
    return new Response('Image not found', { status: 404 });
  }

  // 5. Fetch Original and Trigger Container Resize
  const original = await getOriginal(bucket, path);
  if (!original) {
    return new Response('Image not found', { status: 404 });
  }

  try {
    const resizedResponse = await resizeImage(resizer, original.body, transforms);
    const contentType = resizedResponse.headers.get('content-type') as string;
    const transformedBuffer = await resizedResponse.arrayBuffer();

    // Persist to R2 variant storage in the background
    await putVariant(bucket, variantKey, transformedBuffer, contentType, original.etag);
    return respondAndCache(transformedBuffer, contentType, cacheHeaders, request, ctx, cache);
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Constructs an HTTP Response, sets caching headers, and registers edge cache persistence.
 */
async function respondAndCache(
  body: BodyInit | null,
  contentType: string,
  cacheHeaders: Record<string, string>,
  request: Request,
  ctx: ExecutionContext,
  cache: Cache,
  etag?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    ...cacheHeaders,
  };
  /* istanbul ignore else */
  if (etag) headers.ETag = etag;

  const response = new Response(body, { status: 200, headers });
  await cache.put(request, response.clone());
  return response;
}
