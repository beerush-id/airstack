/* istanbul ignore file */

import type { AnyType } from '@airlib/core';

let envResolver: Promise<AnyType> | undefined;

/**
 * Resolves Cloudflare environment bindings, transparently falling back
 * to local emulation via `getPlatformProxy()` during development when
 * bindings are absent.
 *
 * @param env - Ambient or passed-in worker environment.
 * @returns Effective environment containing active or emulated bindings.
 */
export async function resolveBinding<T extends object = Record<string, AnyType>>(env?: T): Promise<T> {
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') {
    return { ...env } as T;
  }

  try {
    envResolver ??= import('wrangler').then(async ({ getPlatformProxy }) => {
      return (await getPlatformProxy()).env;
    });

    const resolved = await envResolver;
    return { ...resolved, ...env } as T;
  } catch {
    return { ...env } as T;
  }
}

/**
 * Cloudflare execution context interface.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Resolves Cloudflare execution context, transparently falling back
 * to a no-op implementation during development.
 *
 * @param ctx - Ambient or passed-in execution context.
 * @returns Effective execution context.
 */
export function resolveCtx<T extends ExecutionContext>(ctx?: T) {
  return (ctx ?? {
    waitUntil: () => {},
    passThroughOnException: () => {},
  }) as ExecutionContext;
}

/**
 * `caches` as the Workers runtime exposes it: the DOM `CacheStorage` shape
 * widened with the always-available `default` tier.
 */
export interface WorkerCacheStorage extends CacheStorage {
  readonly default: Cache;
}

/**
 * Returns the runtime Cache API, installing an in-memory stand-in on
 * `globalThis.caches` when none exists (Node/Bun local dev, where the Workers
 * runtime is absent), so cache-aware code paths can run unmodified.
 *
 * Entries are keyed by the request's absolute URL, mirroring the platform
 * requirement that cached URLs be absolute.
 *
 * @returns Effective cache storage, either the platform's or the mock.
 */
export function ensureCache(): WorkerCacheStorage {
  const scope = globalThis as typeof globalThis & { caches?: CacheStorage };

  return (scope.caches ??= createMemoryCacheStorage()) as WorkerCacheStorage;
}

interface CacheEntry {
  body: ArrayBuffer;
  headers: Headers;
  status: number;
  statusText: string;
}

function cacheKey(request: RequestInfo | URL): string {
  if (typeof request === 'string') return request;
  if (request instanceof URL) return request.href;

  return request.url;
}

function createMemoryCache(): Cache {
  const entries = new Map<string, CacheEntry>();

  const replay = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return undefined;

    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers: entry.headers,
    });
  };

  const put = async (request: RequestInfo | URL, response: Response) => {
    // Consumes the given response, so a missing `clone()` fails here exactly as it would on the platform.
    entries.set(cacheKey(request), {
      body: await response.arrayBuffer(),
      headers: new Headers(response.headers),
      status: response.status,
      statusText: response.statusText,
    });
  };

  const add = async (request: RequestInfo | URL) => put(request, await fetch(request));

  return {
    match: async (request?: RequestInfo | URL) => (request === undefined ? undefined : replay(cacheKey(request))),
    matchAll: async (request?: RequestInfo | URL) => {
      const response = request === undefined ? undefined : replay(cacheKey(request));

      return response ? [response] : [];
    },
    add,
    addAll: async (requests: Iterable<RequestInfo | URL>) => {
      await Promise.all([...requests].map(add));
    },
    put,
    delete: async (request: RequestInfo | URL) => entries.delete(cacheKey(request)),
    keys: async (request?: RequestInfo | URL) => {
      const key = request === undefined ? undefined : cacheKey(request);

      return [...entries.keys()]
        .filter((entry) => entry === key || key === undefined)
        .map((entry) => new Request(entry));
    },
  } as Cache;
}

function createMemoryCacheStorage(): CacheStorage {
  const tiers = new Map<string, Cache>();
  const tier = (name: string) => {
    let cache = tiers.get(name);
    if (!cache) tiers.set(name, (cache = createMemoryCache()));

    return cache;
  };

  return {
    default: tier('default'),
    open: async (name: string) => tier(name),
    has: async (name: string) => tiers.has(name),
    delete: async (name: string) => tiers.delete(name),
    match: async (request: RequestInfo | URL, options?: CacheQueryOptions) => {
      for (const cache of tiers.values()) {
        const response = await cache.match(request, options);
        if (response) return response;
      }

      return undefined;
    },
  } as unknown as CacheStorage;
}
