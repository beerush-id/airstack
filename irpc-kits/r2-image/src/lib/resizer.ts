import { HandlerError } from '@irpclib/irpc';
import type {
  DurableObjectNamespace,
  Fetcher,
  ImageWorkerEnv,
  R2Bucket,
  Resize,
} from '../types.js';

/**
 * Dispatches an image transformation request to the container.
 *
 * @param resizer Cloudflare Container DO namespace, Service Binding Fetcher, or URL string
 * @param sourceStream Raw binary stream of the original image
 * @param transforms Transformation options requested
 * @returns Transformed image response from the container
 */
export async function resizeImage(
  resizer: DurableObjectNamespace | Fetcher | string,
  sourceStream: ReadableStream<Uint8Array>,
  transforms: Resize
): Promise<Response> {
  const query = new URLSearchParams();

  /* istanbul ignore else */
  if (transforms.width) query.set('w', String(transforms.width));
  /* istanbul ignore else */
  if (transforms.height) query.set('h', String(transforms.height));
  /* istanbul ignore else */
  if (transforms.format) query.set('f', transforms.format);
  /* istanbul ignore else */
  if (transforms.quality) query.set('q', String(transforms.quality));
  /* istanbul ignore else */
  if (transforms.fit) query.set('fit', transforms.fit);
  /* istanbul ignore else */
  if (transforms.blur) query.set('blur', String(transforms.blur));

  const requestUrl = `http://container/resize?${query.toString()}`;
  const requestInit: RequestInit & { duplex?: string } = {
    method: 'POST',
    body: sourceStream,
    duplex: 'half',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  };

  let response: Response;

  // 1. Cloudflare Container Durable Object Namespace
  if (typeof resizer === 'object' && resizer !== null && 'idFromName' in resizer) {
    const doNamespace = resizer as DurableObjectNamespace;
    const stub = doNamespace.get(doNamespace.idFromName('default'));
    response = await stub.fetch(requestUrl, requestInit);
  }
  // 2. Cloudflare Service Binding Fetcher
  else if (typeof resizer === 'object' && resizer !== null && 'fetch' in resizer) {
    const fetcher = resizer as Fetcher;
    response = await fetcher.fetch(requestUrl, requestInit);
  }
  // 3. String URL Endpoint
  else if (typeof resizer === 'string') {
    const targetUrl = new URL(`/resize?${query.toString()}`, resizer);
    response = await fetch(targetUrl.toString(), requestInit);
  } else {
    throw HandlerError.failed('Invalid resizer configuration: expected DurableObjectNamespace, Fetcher, or URL string');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw HandlerError.failed(`Image resize failed (${response.status}): ${errorText}`);
  }

  return response;
}

/**
 * Resolves the R2 bucket from environment using a binding key or custom accessor.
 */
export function resolveBucket<Env extends ImageWorkerEnv>(
  env: Env,
  resolver?: keyof Env | ((env: Env) => R2Bucket)
): R2Bucket {
  return resolveBinding(env, resolver, env.IMAGES);
}

/**
 * Resolves the resizer container from environment using a binding key or custom accessor.
 */
export function resolveResizer<Env extends ImageWorkerEnv>(
  env: Env,
  resolver?: keyof Env | ((env: Env) => DurableObjectNamespace | Fetcher | string)
): DurableObjectNamespace | Fetcher | string {
  return resolveBinding(env, resolver, env.RESIZER);
}

/**
 * Generic resolver for environment bindings supporting accessor functions and string keys.
 */
function resolveBinding<Env, T>(
  env: Env,
  resolver: keyof Env | ((env: Env) => T) | undefined,
  fallback: T
): T {
  if (typeof resolver === 'function') return resolver(env);
  if (resolver && env[resolver]) return env[resolver] as unknown as T;
  return fallback;
}
