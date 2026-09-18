import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { setContext } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { write } from '../src/index.js';
import { signUrl } from '../src/utils/security.js';
import { createWorker } from '../src/worker.js';
import { createMockCache, mockCtx, withFs } from './helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('security: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('security: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

beforeEach(() => {
  (globalThis as unknown as { caches: { default: unknown } }).caches = {
    default: createMockCache(),
  };
});

const guardedEnv = () => ({ BUCKET: bucket, DB: db, FILE_SECRET: 'security-secret' });

describe('perimeter defense — path escapes', () => {
  it('rejects percent-encoded traversal with 403 and serves nothing', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('/s-escape/secret.txt', 'top-secret');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/%2e%2e%2f%2e%2e%2fs-escape/secret.txt'),
        guardedEnv(),
        mockCtx
      );

      expect(res.status).toBe(403);
    });
  });

  it('rejects double-encoded traversal with 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const worker = createWorker({ bucket, indexer: db, public: true });

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/%252e%252e%252f%252e%252e%252fs-escape/secret.txt'),
        guardedEnv(),
        mockCtx
      );

      expect(res.status).toBe(403);
    });
  });

  it('rejects a null byte in the path with 400', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: true });
      await write('~/s-null/notes.txt', 'hello');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/s-null/notes.txt%00.png'),
        guardedEnv(),
        mockCtx
      );

      expect(res.status).toBe(400);
    });
  });
});

describe('perimeter defense — signed token attacks', () => {
  it('rejects a forged token with a valid expiry — 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/s-token/notes.txt', 'hello');

      const expires = Math.floor(Date.now() / 1000) + 600;
      const forged = `https://cdn.example.com/users/alice/s-token/notes.txt?token=${'0'.repeat(64)}&expires=${expires}`;

      const res = await worker.fetch(new Request(forged), guardedEnv(), mockCtx);

      expect(res.status).toBe(403);
    });
  });

  it('rejects an expired signature — 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/s-expired/notes.txt', 'hello');

      const expired = await signUrl('/users/alice/s-expired/notes.txt', 'security-secret', -60);

      const res = await worker.fetch(new Request(`https://cdn.example.com${expired}`), guardedEnv(), mockCtx);

      expect(res.status).toBe(403);
    });
  });

  it('rejects a genuine token replayed against a different path — 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/s-replay/mine.txt', 'hello');
      await write('~/s-replay/yours.txt', 'private');

      const signed = await signUrl('/users/alice/s-replay/mine.txt', 'security-secret', 600);
      const stolen = signed.replace('/users/alice/s-replay/mine.txt', '/users/alice/s-replay/yours.txt');

      const res = await worker.fetch(new Request(`https://cdn.example.com${stolen}`), guardedEnv(), mockCtx);

      expect(res.status).toBe(403);
    });
  });
});

describe('perimeter defense — access control', () => {
  it('refuses direct unauthenticated access to another user home — 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db });
      await write('~/s-direct/private.txt', 'alice private');

      const res = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/s-direct/private.txt'),
        guardedEnv(),
        mockCtx
      );

      expect(res.status).toBe(403);
    });
  });

  it('never leaks non-matching paths under a public pattern list — 403', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      setContext('env', { BUCKET: bucket, DB: db });
      const worker = createWorker({ bucket, indexer: db, public: ['banners/**'] });
      await write('/banners/s-leak/hero.txt', 'public hero');
      await write('~/s-leak/private.txt', 'alice private');

      const open = await worker.fetch(
        new Request('https://cdn.example.com/banners/s-leak/hero.txt'),
        guardedEnv(),
        mockCtx
      );
      const blocked = await worker.fetch(
        new Request('https://cdn.example.com/users/alice/s-leak/private.txt'),
        guardedEnv(),
        mockCtx
      );

      expect(open.status).toBe(200);
      expect(blocked.status).toBe(403);
    });
  });
});
