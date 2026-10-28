import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { envCtx } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { mkdir, read, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/read: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/read: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('read stub — multi-tenant system, options entrance', () => {
  it('reads back written text through the text encoding', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-tenant/notes.txt', 'hello');

      const result = await read('~/r-tenant/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
    });
  });

  it('reads back a written JSON object through the json encoding', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-tenant/config.json', { retries: 3 });

      const result = await read('~/r-tenant/config.json', { encoding: 'json' });

      expect(result).toEqual({ retries: 3 });
    });
  });

  it('delivers the stored content from the canonical URL without an encoding', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-tenant/blob.txt', 'hello');

      const fetchMock = vi.fn(async () => new Response('hello'));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const delivered = (await read('~/r-tenant/blob.txt')) as unknown as Blob;

        expect(fetchMock).toHaveBeenCalledWith('/users/alice/r-tenant/blob.txt', expect.anything());
        expect(await delivered.text()).toBe('hello');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('delivers through a signed URL when FILE_SECRET is configured', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      envCtx.set({ FILE_SECRET: 'delivery-secret' });
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-signed/notes.txt', 'hello');

      const fetchMock = vi.fn(async () => new Response('hello'));
      vi.stubGlobal('fetch', fetchMock);
      try {
        const delivered = (await read('~/r-signed/notes.txt')) as unknown as Blob;

        const requested = String(fetchMock.mock.calls[0]?.[0]);
        expect(requested.startsWith('/users/alice/r-signed/notes.txt?token=')).toBe(true);
        expect(requested).toContain('&expires=');
        expect(await delivered.text()).toBe('hello');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('reads stored text as base64', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-tenant/encoded.txt', 'hello');

      const result = await read('~/r-tenant/encoded.txt', { encoding: 'base64' });

      expect(result).toBe('aGVsbG8=');
    });
  });

  it('reads stored text as a data-url synthesized from the stored type', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/r-tenant/page.html', 'hello');

      const result = await read('~/r-tenant/page.html', { encoding: 'data-url' });

      expect(result).toBe('data:text/plain;base64,aGVsbG8=');
    });
  });

  it('returns undefined for a missing file', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const result = await read('~/r-tenant/missing.txt', { encoding: 'text' });

      expect(result).toBeUndefined();
    });
  });

  it('returns undefined when reading a directory — a directory holds no payload', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await mkdir('~/r-tenant/folder');

      const result = await read('~/r-tenant/folder', { encoding: 'text' });

      expect(result).toBeUndefined();
    });
  });

  it('rejects an encoded read exceeding maxEncodingSize with EFBIG', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, maxEncodingSize: 50 });
      await write('~/r-big/payload.txt', '01234567890123456789');

      implement({ bucket, indexer: db, maxEncodingSize: 10 });

      await expectDenial(() => read('~/r-big/payload.txt', { encoding: 'base64' }), 'EFBIG', 'maxEncodingSize');
    });
  });
});

describe('read stub — user-scoped system', () => {
  it('reads a shared canonical path when an access rule allows it', async () => {
    await withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/shared/**', allow: ['write', 'read'] }] },
      async () => {
        implement({ bucket, indexer: db });
        await write('/shared/r-user/team-notes.txt', 'hello team');

        const result = await read('/shared/r-user/team-notes.txt', { encoding: 'text' });

        expect(result).toBe('hello team');
      }
    );
  });

  it('denies a read outside home with no matching rule — EACCES before any existence check', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => read('/private/r-user/carol-secret.txt', { encoding: 'text' }),
        'EACCES',
        'accessRules',
        '/private/r-user/carol-secret.txt'
      );
    });
  });
});

describe('read stub — open system', () => {
  it('reads what was written under the default home', async () => {
    await withFs({}, async () => {
      implement({ bucket });
      await write('~/r-open/notes.txt', 'hello');

      const result = await read('~/r-open/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
    });
  });
});

describe('read stub — wiring variations carry the same contract', () => {
  it('reads text identically over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/r-r2only/notes.txt', 'hello');

      const result = await read('~/r-r2only/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
    });
  });

  it('reads text through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });
      await write('~/r-adapter/notes.txt', 'hello');

      const result = await read('~/r-adapter/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
    });
  });
});
