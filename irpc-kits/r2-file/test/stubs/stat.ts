import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { exists, mkdir, remove, stat, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/stat: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/stat: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('stat stub — multi-tenant system, options entrance', () => {
  it('returns the FileInfo of a written file with the canonical path, mount invisible', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/s-tenant/notes.txt', 'hello');

      const info = await stat('~/s-tenant/notes.txt');

      expect(info?.path).toBe('/users/alice/s-tenant/notes.txt');
      expect(info?.name).toBe('notes.txt');
      expect(info?.size).toBe(5);
      expect(info?.type).toBe('text/plain');
      expect(info?.isDirectory).toBe(false);
      expect(info?.mtime).toBeInstanceOf(Date);
    });
  });

  it('returns the FileInfo of a created directory', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await mkdir('~/s-tenant/folder');

      const info = await stat('~/s-tenant/folder');

      expect(info?.path).toBe('/users/alice/s-tenant/folder');
      expect(info?.isDirectory).toBe(true);
    });
  });

  it('returns undefined for a missing path', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await stat('~/s-tenant/missing.txt');

      expect(info).toBeUndefined();
    });
  });

  it('treats a soft-deleted file as non-existent', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/s-tenant/trashed.txt', 'hello');
      await remove('~/s-tenant/trashed.txt', { soft: true });

      const info = await stat('~/s-tenant/trashed.txt');
      const present = await exists('~/s-tenant/trashed.txt');

      expect(info).toBeUndefined();
      expect(present).toBe(false);
    });
  });
});

describe('exists stub', () => {
  it('answers true for a written file and false for a missing one', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/s-tenant/present.txt', 'hello');

      expect(await exists('~/s-tenant/present.txt')).toBe(true);
      expect(await exists('~/s-tenant/absent.txt')).toBe(false);
    });
  });
});

describe('stat stub — user-scoped system', () => {
  it('stats a shared canonical path when an access rule allows it', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/shared/**', allow: ['write', 'stat'] }] }, async () => {
      implement({ bucket, indexer: db });
      await write('/shared/s-user/team-notes.txt', 'hello team');

      const info = await stat('/shared/s-user/team-notes.txt');

      expect(info?.path).toBe('/shared/s-user/team-notes.txt');
      expect(info?.size).toBe(10);
    });
  });

  it('denies a stat outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(() => stat('/private/s-user/carol-secret.txt'), 'EACCES', 'accessRules', '/private/s-user/carol-secret.txt');
    });
  });
});

describe('stat stub — open system', () => {
  it('stats what was written under the default home', async () => {
    await withFs({}, async () => {
      implement({ bucket });
      await write('~/s-open/notes.txt', 'hello');

      const info = await stat('~/s-open/notes.txt');

      expect(info?.path).toBe('/home/s-open/notes.txt');
      expect(info?.size).toBe(5);
    });
  });
});

describe('stat stub — wiring variations carry the same contract', () => {
  it('stats identically over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/s-r2only/notes.txt', 'hello');

      const info = await stat('~/s-r2only/notes.txt');

      expect(info?.path).toBe('/users/alice/s-r2only/notes.txt');
      expect(info?.size).toBe(5);
      expect(info?.type).toBe('text/plain');
      expect(info?.isDirectory).toBe(false);
    });
  });

  it('stats through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });
      await write('~/s-adapter/notes.txt', 'hello');

      const info = await stat('~/s-adapter/notes.txt');

      expect(info?.path).toBe('/users/alice/s-adapter/notes.txt');
      expect(info?.size).toBe(5);
    });
  });
});
