import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { list, mkdir, remove, search, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/list: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/list: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('list stub — multi-tenant system, options entrance', () => {
  it('lists a directory with canonical entry paths sorted by name', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-sort/b.txt', 'hello');
      await write('~/l-sort/a.txt', 'hello');
      await write('~/l-sort/c.txt', 'hello');

      const result = await list('~/l-sort', { sort: 'name' });

      expect(result.entries.map((entry) => entry.path)).toEqual([
        '/users/alice/l-sort/a.txt',
        '/users/alice/l-sort/b.txt',
        '/users/alice/l-sort/c.txt',
      ]);
    });
  });

  it('returns an empty entry list for an empty directory', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await mkdir('~/l-empty');

      const result = await list('~/l-empty');

      expect(result.entries).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  it('lists nested descendants when recursive', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await mkdir('~/l-tree');
      await mkdir('~/l-tree/nested');
      await write('~/l-tree/top.txt', 'hello');
      await write('~/l-tree/nested/deep.txt', 'hello');

      const result = await list('~/l-tree', { recursive: true, sort: 'name' });

      expect(result.entries.map((entry) => entry.path)).toEqual([
        '/users/alice/l-tree/nested/deep.txt',
        '/users/alice/l-tree/nested',
        '/users/alice/l-tree/top.txt',
      ]);
    });
  });

  it('pages through entries with limit and cursor', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-page/a.txt', 'hello');
      await write('~/l-page/b.txt', 'hello');
      await write('~/l-page/c.txt', 'hello');

      const first = await list('~/l-page', { sort: 'name', limit: 2 });
      expect(first.entries.map((entry) => entry.path)).toEqual([
        '/users/alice/l-page/a.txt',
        '/users/alice/l-page/b.txt',
      ]);
      expect(first.nextCursor).toBeDefined();

      const second = await list('~/l-page', { sort: 'name', limit: 2, cursor: first.nextCursor });
      expect(second.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-page/c.txt']);
    });
  });

  it('hides hidden entries by default and reveals them with all', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-hidden/.secret.txt', 'hello', { hidden: true });
      await write('~/l-hidden/visible.txt', 'hello');

      const normal = await list('~/l-hidden');
      expect(normal.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-hidden/visible.txt']);

      const all = await list('~/l-hidden', { all: true, sort: 'name' });
      expect(all.entries.map((entry) => entry.path)).toEqual([
        '/users/alice/l-hidden/.secret.txt',
        '/users/alice/l-hidden/visible.txt',
      ]);
      expect(all.entries[0]?.hidden).toBe(true);
    });
  });

  it('filters entries by size range', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-filter/small.txt', 'hello');
      await write('~/l-filter/big.txt', 'hello world, this is a longer payload');

      const result = await list('~/l-filter', { filter: { size: { min: 10 } } });

      expect(result.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-filter/big.txt']);
    });
  });

  it('filters entries by metadata', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-meta/invoice.txt', 'hello', { metadata: { tag: 'invoice' } });
      await write('~/l-meta/receipt.txt', 'hello', { metadata: { tag: 'receipt' } });

      const result = await list('~/l-meta', { filter: { metadata: { tag: 'invoice' } } });

      expect(result.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-meta/invoice.txt']);
    });
  });

  it('hides soft-deleted entries and shows them in the trash with deletedAt', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/l-trash/gone.txt', 'hello');
      await write('~/l-trash/stay.txt', 'hello');
      await remove('~/l-trash/gone.txt', { soft: true });

      const active = await list('~/l-trash');
      expect(active.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-trash/stay.txt']);

      const trash = await list('~/l-trash', { trash: true });
      expect(trash.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-trash/gone.txt']);
      expect(trash.entries[0]?.deletedAt).toBeInstanceOf(Date);
    });
  });
});

describe('search stub', () => {
  it('finds files by name fragment inside the caller home', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/l-search', { recursive: true });
      await remove('~/report-2026.txt');
      await remove('~/weekly-notes.txt');
      await write('~/report-2026.txt', 'hello');
      await write('~/weekly-notes.txt', 'hello');

      const result = await search('report');

      expect(result.entries.map((entry) => entry.path)).toEqual(['/users/alice/report-2026.txt']);
    });
  });

  it('returns the safe neutral result over R2-only wiring — search is an index capability', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/l-search-r2/report-2026.txt', 'hello');

      const result = await search('report');

      expect(result.entries).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });
});

describe('list stub — user-scoped system', () => {
  it('lists a shared canonical directory when an access rule allows it', async () => {
    await withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/shared/**', allow: ['write', 'list'] }] },
      async () => {
        implement({ bucket, indexer: db });
        await write('/shared/l-user/a.txt', 'hello');

        const result = await list('/shared/l-user');

        expect(result.entries.map((entry) => entry.path)).toEqual(['/shared/l-user/a.txt']);
      }
    );
  });

  it('denies a list outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(() => list('/private/l-user'), 'EACCES', 'accessRules', '/private/l-user');
    });
  });
});

describe('list stub — open system', () => {
  it('lists what was written under the default home', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      await write('~/l-open/notes.txt', 'hello');

      const result = await list('~/l-open');

      expect(result.entries.map((entry) => entry.path)).toEqual(['/home/l-open/notes.txt']);
    });
  });
});

describe('list stub — wiring variations carry the same contract', () => {
  it('lists identically over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/l-r2only/b.txt', 'hello');
      await write('~/l-r2only/a.txt', 'hello');

      const result = await list('~/l-r2only', { sort: 'name' });

      expect(result.entries.map((entry) => entry.path)).toEqual([
        '/users/alice/l-r2only/a.txt',
        '/users/alice/l-r2only/b.txt',
      ]);
    });
  });

  it('lists through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });
      await write('~/l-adapter/notes.txt', 'hello');

      const result = await list('~/l-adapter');

      expect(result.entries.map((entry) => entry.path)).toEqual(['/users/alice/l-adapter/notes.txt']);
    });
  });
});
