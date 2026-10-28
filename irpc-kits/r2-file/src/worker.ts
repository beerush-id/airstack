import type { ExecutionContext } from '@cloudflare/workers-types';
import { HTTPRouter } from '@irpclib/http/router';
import { type AnyType, envCtx, getEnv, HandlerError } from '@irpclib/irpc';
import type { FileAdapter, FileDriver } from './adapter.js';
import type { FileWorkerEnv } from './constructor.js';
import { implement } from './constructor.js';
import { transport } from './index.js';
import type { FileAdapterOptions } from './types.js';
import { matchPattern, mountAt, normalizeSegments } from './utils/path.js';
import { verifyToken } from './utils/security.js';

/**
 * CORS behavior for browser callers of the worker.
 */
export interface CorsOptions {
  origin?: string | string[] | boolean;
  headers?: string[];
  methods?: string[];
}

/**
 * Worker deployment options: the filesystem wiring plus the topology
 * controls for the RPC and delivery planes.
 *
 * `callable: false` turns the worker into a pure delivery CDN with no
 * RPC surface; `public` opens unsigned GET access for all paths or the
 * matching patterns; `secret` signs and verifies delivery URLs.
 */
export interface FileWorkerConfig extends FileAdapterOptions {
  adapter?: FileAdapter;
  callable?: boolean;
  public?: boolean | string[];
  secret?: string;
  endpoint?: string;
  cache?: {
    browserTtl?: number;
    edgeTtl?: number;
  };
  cors?: CorsOptions;
}

const DEFAULT_BROWSER_TTL = 86400;
const DEFAULT_EDGE_TTL = 2592000;

/**
 * Creates the Cloudflare Worker handler serving the filesystem.
 *
 * POSTs to the RPC endpoint run filesystem calls; GETs deliver stored
 * files with caching, conditional, and range support. Everything else
 * is refused.
 *
 * @param config Filesystem wiring plus topology, signing, cache, and CORS controls
 * @returns Standard Cloudflare Worker handler, with `use()` to append drivers to its filesystem
 */
export function createWorker(config: FileWorkerConfig = {}) {
  const callable = config.callable !== false;
  const endpoint = config.endpoint ?? '/irpc';
  const browserTtl = config.cache?.browserTtl ?? DEFAULT_BROWSER_TTL;
  const edgeTtl = config.cache?.edgeTtl ?? DEFAULT_EDGE_TTL;

  const router = new HTTPRouter(transport, { endpoint });

  // A worker is made before any request, but only gets its bindings with one: without bindings in
  // the config, each call uses the ones in its own environment.
  const adapter = callable
    ? implement({
        ...config,
        bucket: config.bucket ?? envBinding<FileWorkerEnv['BUCKET']>('BUCKET'),
        indexer: config.indexer ?? envBinding<FileWorkerEnv['DB']>('DB'),
      })
    : undefined;

  const worker = {
    router,
    /**
     * Appends a driver to the filesystem the calls run on, after storage: to observe changes
     * (indexing, auditing). A delivery-only worker runs no calls, so it has nothing to observe.
     *
     * @param driver The driver to append
     * @returns The worker, to chain
     */
    use(driver: FileDriver) {
      adapter?.use(driver);
      return worker;
    },
    async fetch(request: Request, env: FileWorkerEnv, ctx: AnyType): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return respondPreflight(request, config.cors);
      }

      if (request.method === 'POST' && url.pathname === endpoint) {
        if (!callable) {
          return new Response('Not Found', { status: 404 });
        }
        return router.resolve(request, [
          [envCtx.key, env],
          ['ctx', ctx],
          ['config', config],
        ]);
      }

      if (request.method === 'GET') {
        return deliverFile(request, url, env, ctx, config, browserTtl, edgeTtl);
      }

      return new Response('Method Not Allowed', { status: 405 });
    },
  };
  return worker;
}

/**
 * Answers a CORS preflight with the configured origin allowance.
 */
function respondPreflight(request: Request, cors?: CorsOptions): Response {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const allowed = resolveAllowedOrigin(cors?.origin, origin);
  if (allowed !== undefined && origin !== null) {
    headers.set('Access-Control-Allow-Origin', allowed);
  }
  headers.set('Access-Control-Allow-Methods', (cors?.methods ?? ['GET', 'POST', 'OPTIONS']).join(', '));
  headers.set('Access-Control-Allow-Headers', (cors?.headers ?? ['Content-Type', 'Range']).join(', '));
  return new Response(null, { status: 204, headers });
}

/**
 * Resolves the ACAO value for a request origin, or `undefined` when disallowed.
 */
function resolveAllowedOrigin(
  configured: string | string[] | boolean | undefined,
  origin: string | null
): string | undefined {
  if (configured === true) return origin ?? undefined;
  if (typeof configured === 'string') return configured;
  if (Array.isArray(configured) && origin !== null && configured.includes(origin)) return origin;
  return undefined;
}

/**
 * Serves one stored file over the delivery plane: sanitizes the path,
 * enforces public/signed access, then answers from edge cache, a
 * conditional match, a byte range, or the full object.
 */
async function deliverFile(
  request: Request,
  url: URL,
  env: FileWorkerEnv,
  ctx: ExecutionContext,
  config: FileWorkerConfig,
  browserTtl: number,
  edgeTtl: number
): Promise<Response> {
  let canonical: string;
  try {
    canonical = decodeURIComponent(url.pathname);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (canonical.includes('\0')) {
    return new Response('Bad Request', { status: 400 });
  }
  if (canonical !== url.pathname && (canonical.includes('..') || canonical.includes('%'))) {
    return new Response('Forbidden', { status: 403 });
  }
  canonical = normalizeSegments(canonical);

  const secret = config.secret ?? env.FILE_SECRET;
  if (!isPublicPath(canonical, config.public)) {
    const token = url.searchParams.get('token');
    const expires = Number(url.searchParams.get('expires'));
    if (secret === undefined || token === null || !(await verifyToken(canonical, token, secret, expires))) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const cache = (caches as unknown as { default: Cache }).default;
  const rangeHeader = request.headers.get('Range');
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (rangeHeader === null && ifNoneMatch === null) {
    const cached = await cache.match(request);
    if (cached !== undefined) {
      return cached;
    }
  }

  const key = mountAt(config.mountPoint ?? '/', canonical).slice(1);
  const head = await env.BUCKET.head(key);
  if (head === null || isHiddenEntry(head)) {
    return new Response('Not Found', { status: 404 });
  }

  const etag = head.httpEtag ?? `"${head.etag}"`;
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const contentType = head.httpMetadata?.contentType ?? 'application/octet-stream';
  const headers = new Headers({
    'Content-Type': contentType,
    ETag: etag,
    'Cache-Control': `public, max-age=${browserTtl}, s-maxage=${edgeTtl}`,
  });
  if (url.searchParams.has('download')) {
    headers.set('Content-Disposition', `attachment; filename="${canonical.split('/').pop()}"`);
  }

  if (rangeHeader !== null) {
    return deliverRange(env, key, rangeHeader, head.size, headers);
  }

  const object = await env.BUCKET.get(key);
  if (object === null) {
    return new Response('Not Found', { status: 404 });
  }
  const response = new Response(object.body as AnyType, { status: 200, headers });
  ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}

/**
 * Serves one `bytes=start-end` slice with a 206 partial response.
 */
async function deliverRange(
  env: FileWorkerEnv,
  key: string,
  rangeHeader: string,
  size: number,
  headers: Headers
): Promise<Response> {
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
  if (match === null) {
    return new Response('Bad Request', { status: 400 });
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Number(match[2]);
  if (start >= size || end >= size || start > end) {
    return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const object = await env.BUCKET.get(key, { range: { offset: start, length: end - start + 1 } });
  if (object === null) {
    return new Response('Not Found', { status: 404 });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  return new Response(object.body as AnyType, { status: 206, headers });
}

/**
 * Reports whether a head result is a directory marker or soft-deleted —
 * neither is deliverable.
 */
function isHiddenEntry(head: { customMetadata?: Record<string, string> }): boolean {
  const meta = head.customMetadata as Record<string, string> | undefined;
  return meta?._fs_deleted !== undefined || meta?._fs_type === 'inode/directory';
}

/**
 * Reports whether a canonical path is open for unsigned delivery.
 */
function isPublicPath(canonical: string, configured: boolean | string[] | undefined): boolean {
  if (configured === true) return true;
  if (Array.isArray(configured)) {
    const bare = canonical.replace(/^\//, '');
    return configured.some((pattern) => matchPattern(bare, pattern));
  }
  return false;
}

/**
 * A binding that is looked up in the current call's environment (`envCtx`) each time it is used,
 * so a worker made at module level reaches the bindings of whichever request it serves.
 *
 * @param key - The binding's name in the environment, e.g. `BUCKET`.
 * @returns A stand-in that forwards every use to the call's binding.
 * @throws When the call's environment has no such binding.
 */
function envBinding<T extends object>(key: keyof FileWorkerEnv): T {
  return new Proxy({} as T, {
    get(_, property) {
      const binding = getEnv<Partial<FileWorkerEnv>>()[key] as AnyType;
      if (!binding) throw new HandlerError('EIO', `No ${key} binding in this call's environment`);
      const value = binding[property];
      return typeof value === 'function' ? value.bind(binding) : value;
    },
  });
}
