import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { envCtx } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { read, write } from '../src/index.js';
import { signUrl } from '../src/utils/security.js';
import { createWorker } from '../src/worker.js';
import { createMockCache, mockCtx, withFs } from './helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('delivery: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('delivery: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

beforeEach(() => {
  (globalThis as unknown as { caches: { default: unknown } }).caches = {
    default: createMockCache(),
  };
});

describe('delivery plane — full responses', () => {
  it('serves a stored file with type, ETag, cache headers, and body', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true, cache: { browserTtl: 60, edgeTtl: 120 } });
      await write('~/d-basic/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-basic/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('hello');
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(res.headers.get('ETag')).toBeTruthy();
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=60, s-maxage=120');
    });
  });

  it('answers a conditional request with 304 when the ETag matches', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/d-etag/notes.txt', 'hello');

      const first = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-etag/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );
      const etag = first.headers.get('ETag')!;

      const second = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-etag/notes.txt', { headers: { 'If-None-Match': etag } }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(second.status).toBe(304);
    });
  });

  it('serves a byte range with 206 and Content-Range', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/d-range/bytes.txt', '0123456789');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-range/bytes.txt', { headers: { Range: 'bytes=2-5' } }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(206);
      expect(await res.text()).toBe('2345');
      expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10');
    });
  });

  it('serves a download request with Content-Disposition attachment', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/d-download/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-download/notes.txt?download'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="notes.txt"');
    });
  });

  it('answers 404 for a path with nothing stored', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const worker = createWorker({ bucket, indexer: db, public: true });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-missing/nothing.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(404);
    });
  });
});

describe('delivery plane — signed tokens', () => {
  it('refuses an unsigned request for a protected file with 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/d-protected/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-protected/notes.txt'),
        { BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' },
        mockCtx
      );

      expect(res.status).toBe(403);
    });
  });

  it('serves the signed URL that the read stub delivered', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/d-signed/notes.txt', 'hello');

      const fetchMock = vi.fn(async () => new Response('hello'));
      vi.stubGlobal('fetch', fetchMock);
      let signedPath = '';
      try {
        await read('~/d-signed/notes.txt');
        signedPath = String(fetchMock.mock.calls[0]?.[0]);
      } finally {
        vi.unstubAllGlobals();
      }

      const res = await worker.fetch(
        new Request(`https://cdn.example.com${signedPath}`),
        { BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('hello');
    });
  });

  it('honors a signing secret given through worker config', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, secret: 'config-secret' });
      await write('~/d-config-secret/notes.txt', 'hello');

      const signed = await signUrl('/users/alice/d-config-secret/notes.txt', 'config-secret', 60);

      const res = await worker.fetch(
        new Request(`https://cdn.example.com${signed}`),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('hello');
    });
  });
});

describe('delivery plane — public topology', () => {
  it('serves everything unsigned when public is true', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/d-public/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-public/notes.txt'),
        { BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('hello');
    });
  });

  it('serves only matching patterns when public is a list', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: ['banners/**'] });
      await write('/banners/d-patterns/hero.png', 'hero-bytes');
      await write('~/d-patterns/private.txt', 'secret');

      const open = await worker.fetch(
        new Request('https://cdn.example.com/banners/d-patterns/hero.png'),
        { BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' },
        mockCtx
      );
      const blocked = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-patterns/private.txt'),
        { BUCKET: bucket, DB: db, FILE_SECRET: 'delivery-secret' },
        mockCtx
      );

      expect(open.status).toBe(200);
      expect(await open.text()).toBe('hero-bytes');
      expect(blocked.status).toBe(403);
    });
  });
});

describe('delivery plane — callable topology', () => {
  it('refuses the RPC plane entirely when callable is false, still delivers files', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, callable: false, public: true });
      await write('~/d-cdn/notes.txt', 'hello');

      const rpc = await worker.fetch(
        new Request('https://cdn.example.com/irpc', { method: 'POST', body: '{}' }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );
      const file = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-cdn/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(rpc.status).toBe(404);
      expect(file.status).toBe(200);
      expect(await file.text()).toBe('hello');
    });
  });

  it('dispatches POST /irpc to the RPC plane by default', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const worker = createWorker({ bucket, indexer: db });

      const rpc = await worker.fetch(
        new Request('https://cdn.example.com/irpc', { method: 'POST', body: 'not-an-irpc-packet' }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(rpc.status).toBe(400);
    });
  });

  it('answers a CORS preflight with the configured origin', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, cors: { origin: 'https://app.example.com' } });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/d-cors/notes.txt', {
          method: 'OPTIONS',
          headers: { Origin: 'https://app.example.com' },
        }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    });
  });
});
