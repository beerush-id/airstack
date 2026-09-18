import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { exists, list, mkdir, read, remove, restore, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/remove: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/remove: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('remove stub — multi-tenant system, options entrance', () => {
  it('permanently removes a file by default and answers false when already absent', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/rm-tenant/gone.txt', 'hello');

      const removed = await remove('~/rm-tenant/gone.txt');
      const again = await remove('~/rm-tenant/gone.txt');

      expect(removed).toBe(true);
      expect(again).toBe(false);
      expect(await exists('~/rm-tenant/gone.txt')).toBe(false);
    });
  });

  it('removes a non-empty directory subtree with recursive', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await mkdir('~/rm-tenant/tree');
      await write('~/rm-tenant/tree/a.txt', 'aaa');
      await write('~/rm-tenant/tree/nested/b.txt', 'bbb');

      const removed = await remove('~/rm-tenant/tree', { recursive: true });

      expect(removed).toBe(true);
      expect(await exists('~/rm-tenant/tree/a.txt')).toBe(false);
      expect(await exists('~/rm-tenant/tree/nested/b.txt')).toBe(false);
    });
  });
});

describe('remove stub — strict policy', () => {
  it('blocks a non-empty directory removal with ENOTEMPTY without context enforcement', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, strict: true });
      await mkdir('~/rm-strict/tree');
      await write('~/rm-strict/tree/a.txt', 'aaa');

      await expectDenial(
        () => remove('~/rm-strict/tree', { recursive: true }),
        'ENOTEMPTY',
        'is not empty',
        '/users/alice/rm-strict/tree'
      );
      expect(await exists('~/rm-strict/tree/a.txt')).toBe(true);
    });
  });

  it('allows the same removal under an enforced context', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice', enforced: true }, async () => {
      implement({ bucket, indexer: db, strict: true });
      await mkdir('~/rm-strict-enforced/tree');
      await write('~/rm-strict-enforced/tree/a.txt', 'aaa');

      const removed = await remove('~/rm-strict-enforced/tree', { recursive: true });

      expect(removed).toBe(true);
      expect(await exists('~/rm-strict-enforced/tree/a.txt')).toBe(false);
    });
  });
});

describe('soft deletion and restore', () => {
  it('soft-deletes on per-operation override, hides from active lookups, and restores', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/rm-soft/notes.txt', 'hello');

      const removed = await remove('~/rm-soft/notes.txt', { soft: true });
      expect(removed).toBe(true);
      expect(await exists('~/rm-soft/notes.txt')).toBe(false);

      const trash = await list('~/rm-soft', { trash: true });
      expect(trash.entries.map((entry) => entry.path)).toEqual(['/users/alice/rm-soft/notes.txt']);
      expect(trash.entries[0]?.deletedAt).toBeInstanceOf(Date);

      const restored = await restore('~/rm-soft/notes.txt');
      expect(restored.path).toBe('/users/alice/rm-soft/notes.txt');
      expect(restored.deletedAt).toBeUndefined();
      expect(await read('~/rm-soft/notes.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('soft-deletes by driver setting when softDelete is configured', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, softDelete: true });
      await write('~/rm-softdrv/notes.txt', 'hello');

      const removed = await remove('~/rm-softdrv/notes.txt');

      expect(removed).toBe(true);
      expect(await exists('~/rm-softdrv/notes.txt')).toBe(false);

      const restored = await restore('~/rm-softdrv/notes.txt');
      expect(restored.path).toBe('/users/alice/rm-softdrv/notes.txt');
      expect(await read('~/rm-softdrv/notes.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('stamps and restores a whole directory subtree', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      await mkdir('~/rm-subtree/tree');
      await write('~/rm-subtree/tree/a.txt', 'aaa');
      await write('~/rm-subtree/tree/nested/b.txt', 'bbb');

      await remove('~/rm-subtree/tree', { recursive: true, soft: true });
      expect(await exists('~/rm-subtree/tree/a.txt')).toBe(false);
      expect(await exists('~/rm-subtree/tree/nested/b.txt')).toBe(false);

      await restore('~/rm-subtree/tree');
      expect(await exists('~/rm-subtree/tree/a.txt')).toBe(true);
      expect(await read('~/rm-subtree/tree/nested/b.txt', { encoding: 'text' })).toBe('bbb');
    });
  });

  it('rejects restoring an active file that is not in the trash — ENOENT', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      await write('~/rm-restore/active.txt', 'hello');

      await expectDenial(
        () => restore('~/rm-restore/active.txt'),
        'ENOENT',
        'does not exist',
        '/users/alice/rm-restore/active.txt'
      );
    });
  });

  it('rejects restoring a path that never existed — ENOENT', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => restore('~/rm-restore/ghost.txt'),
        'ENOENT',
        'does not exist',
        '/users/alice/rm-restore/ghost.txt'
      );
    });
  });
});

describe('remove stub — user-scoped system', () => {
  it('removes within a shared canonical directory when the rule allows remove', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/shared/**', allow: ['write', 'remove', 'exists'] }] }, async () => {
      implement({ bucket, indexer: db });
      await write('/shared/rm-user/junk.txt', 'trash me');

      const removed = await remove('/shared/rm-user/junk.txt');

      expect(removed).toBe(true);
      expect(await exists('/shared/rm-user/junk.txt')).toBe(false);
    });
  });

  it('denies a remove outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(() => remove('/private/rm-user/carol-file.txt'), 'EACCES', 'accessRules', '/private/rm-user/carol-file.txt');
    });
  });
});

describe('remove stub — open system', () => {
  it('removes what was written under the default home', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      await write('~/rm-open/notes.txt', 'hello');

      const removed = await remove('~/rm-open/notes.txt');

      expect(removed).toBe(true);
      expect(await exists('~/rm-open/notes.txt')).toBe(false);
    });
  });
});

describe('remove stub — wiring variations carry the same contract', () => {
  it('soft-deletes and restores identically over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/rm-r2only/notes.txt', 'hello');

      await remove('~/rm-r2only/notes.txt', { soft: true });
      expect(await exists('~/rm-r2only/notes.txt')).toBe(false);

      const trash = await list('~/rm-r2only', { trash: true });
      expect(trash.entries.map((entry) => entry.path)).toEqual(['/users/alice/rm-r2only/notes.txt']);

      await restore('~/rm-r2only/notes.txt');
      expect(await read('~/rm-r2only/notes.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('removes through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });
      await write('~/rm-adapter/notes.txt', 'hello');

      const removed = await remove('~/rm-adapter/notes.txt');

      expect(removed).toBe(true);
      expect(await exists('~/rm-adapter/notes.txt')).toBe(false);
    });
  });
});
