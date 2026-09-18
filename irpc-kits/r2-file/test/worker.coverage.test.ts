import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { setContext } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { write, remove } from '../src/index.js';
import { createWorker } from '../src/worker.js';
import { createMockCache, mockCtx, withFs } from './helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('worker.coverage: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('worker.coverage: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

beforeEach(() => {
  (globalThis as unknown as { caches: { default: unknown } }).caches = {
    default: createMockCache(),
  };
});

describe('worker coverage — delivery edge cases', () => {
  it('serves the second identical GET from the edge cache', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-cache/notes.txt', 'hello');

      const first = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cache/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );
      const second = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cache/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await second.text()).toBe('hello');
    });
  });

  it('answers 400 for a malformed percent sequence', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, public: true });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/%zz/broken.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(400);
    });
  });

  it('answers 405 for a method that is neither GET, POST, nor OPTIONS', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, public: true });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-method/notes.txt', { method: 'PUT' }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(405);
    });
  });

  it('answers 400 for a Range in an unsupported unit', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-range/bytes.txt', '0123456789');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-range/bytes.txt', { headers: { Range: 'items=0-1' } }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(400);
    });
  });

  it('answers 416 with the total size for an unsatisfiable Range', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-range/bytes.txt', '0123456789');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-range/bytes.txt', { headers: { Range: 'bytes=50-60' } }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(416);
      expect(res.headers.get('Content-Range')).toBe('bytes */10');
    });
  });

  it('answers 404 when the object vanishes between head and get', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-race/notes.txt', 'hello');

      const racingBucket = {
        head: (key: string) => bucket.head(key),
        get: async () => null,
      } as unknown as R2Bucket;

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-race/notes.txt'),
        { BUCKET: racingBucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(404);
    });
  });
  it('answers 404 when the object vanishes between head and ranged get', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-race/bytes.txt', '0123456789');

      const racingBucket = {
        head: (key: string) => bucket.head(key),
        get: async () => null,
      } as unknown as R2Bucket;

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-race/bytes.txt', { headers: { Range: 'bytes=0-3' } }),
        { BUCKET: racingBucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(404);
    });
  });

  it('answers 404 for a soft-deleted file even under public delivery', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-trashed/notes.txt', 'hello');
      await remove('~/wc-trashed/notes.txt', { soft: true });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-trashed/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(404);
    });
  });

  it('answers 404 for a directory marker path', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-dir/inside.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-dir/'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(404);
    });
  });
  it('serves an open-ended range to the end of the file', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-openrange/bytes.txt', '0123456789');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-openrange/bytes.txt', { headers: { Range: 'bytes=5-' } }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(206);
      expect(await res.text()).toBe('56789');
      expect(res.headers.get('Content-Range')).toBe('bytes 5-9/10');
    });
  });

  it('falls back to a quoted raw etag when head carries no httpEtag', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-etag/notes.txt', 'hello');

      const bareHeadBucket = {
        head: async () => ({ etag: 'abc123', size: 5, httpMetadata: { contentType: 'text/plain' } }),
        get: (key: string, options?: unknown) => bucket.get(key, options as never),
      } as unknown as R2Bucket;

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-etag/notes.txt'),
        { BUCKET: bareHeadBucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('ETag')).toBe('"abc123"');
    });
  });

  it('applies the default edge TTL when only browserTtl is configured', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true, cache: { browserTtl: 30 } });
      await write('~/wc-ttl/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-ttl/notes.txt'),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, s-maxage=2592000');
    });
  });

  it('defaults to octet-stream when the stored object carries no content type', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/wc-notype/notes.bin', 'hello');

      const bareHeadBucket = {
        head: async () => ({ etag: 'abc123', size: 5 }),
        get: (key: string, options?: unknown) => bucket.get(key, options as never),
      } as unknown as R2Bucket;

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-notype/notes.bin'),
        { BUCKET: bareHeadBucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    });
  });

  it('protects every path when created with no configuration at all', async () => {
    const worker = createWorker();

    const res = await worker.fetch(
      new Request('https://cdn.example.com/users/alice/wc-default/notes.txt'),
      { BUCKET: bucket, DB: db },
      mockCtx
    );

    expect(res.status).toBe(403);
  });
});

describe('worker coverage — CORS origin resolution', () => {
  it('echoes the request origin when any origin is allowed', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, cors: { origin: true } });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cors/notes.txt', {
          method: 'OPTIONS',
          headers: { Origin: 'https://any.example.com' },
        }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://any.example.com');
    });
  });

  it('echoes a request origin listed in the allowed array', async () => {
    await withFs({}, async () => {
      const worker = createWorker({
        bucket,
        indexer: db,
        cors: { origin: ['https://app.example.com', 'https://admin.example.com'] },
      });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cors/notes.txt', {
          method: 'OPTIONS',
          headers: { Origin: 'https://admin.example.com' },
        }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example.com');
    });
  });

  it('omits the allow-origin header for an origin outside the array', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, cors: { origin: ['https://app.example.com'] } });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cors/notes.txt', {
          method: 'OPTIONS',
          headers: { Origin: 'https://evil.example.com' },
        }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  it('answers a preflight without an Origin header when any origin is allowed', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db, cors: { origin: true } });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cors/notes.txt', { method: 'OPTIONS' }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  it('answers a preflight without any CORS configuration', async () => {
    await withFs({}, async () => {
      const worker = createWorker({ bucket, indexer: db });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/wc-cors/notes.txt', {
          method: 'OPTIONS',
          headers: { Origin: 'https://app.example.com' },
        }),
        { BUCKET: bucket, DB: db },
        mockCtx
      );

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
