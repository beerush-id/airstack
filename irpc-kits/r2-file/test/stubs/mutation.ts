import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { copy, exists, mkdir, move, read, remove, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/mutation: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/mutation: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('copy stub — multi-tenant system, options entrance', () => {
  it('duplicates a file and leaves the source intact', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await write('~/m-tenant/source.txt', 'hello');

      const copied = await copy('~/m-tenant/source.txt', '~/m-tenant/destination.txt');

      expect(copied).toBe(true);
      expect(await read('~/m-tenant/destination.txt', { encoding: 'text' })).toBe('hello');
      expect(await read('~/m-tenant/source.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('duplicates a directory with every descendant unconditionally', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await mkdir('~/m-tenant/tree');
      await write('~/m-tenant/tree/a.txt', 'aaa');
      await write('~/m-tenant/tree/nested/b.txt', 'bbb');

      const copied = await copy('~/m-tenant/tree', '~/m-tenant/tree-copy');

      expect(copied).toBe(true);
      expect(await read('~/m-tenant/tree-copy/a.txt', { encoding: 'text' })).toBe('aaa');
      expect(await read('~/m-tenant/tree-copy/nested/b.txt', { encoding: 'text' })).toBe('bbb');
      expect(await exists('~/m-tenant/tree/a.txt')).toBe(true);
    });
  });

  it('rejects an existing destination with EEXIST — copy never overwrites', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await write('~/m-tenant/source.txt', 'hello');
      await write('~/m-tenant/taken.txt', 'occupied');

      await expectDenial(
        () => copy('~/m-tenant/source.txt', '~/m-tenant/taken.txt'),
        'EEXIST',
        'already exists',
        '/users/alice/m-tenant/taken.txt'
      );
    });
  });

  it('rejects a missing source with ENOENT', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      await expectDenial(
        () => copy('~/m-tenant/ghost.txt', '~/m-tenant/destination.txt'),
        'ENOENT',
        'does not exist',
        '/users/alice/m-tenant/ghost.txt'
      );
    });
  });
});

describe('move stub — multi-tenant system, options entrance', () => {
  it('relocates a file: destination carries the content, source is gone', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await write('~/m-tenant/movable.txt', 'hello');

      const moved = await move('~/m-tenant/movable.txt', '~/m-tenant/moved.txt');

      expect(moved).toBe(true);
      expect(await read('~/m-tenant/moved.txt', { encoding: 'text' })).toBe('hello');
      expect(await exists('~/m-tenant/movable.txt')).toBe(false);
    });
  });

  it('relocates a directory subtree unconditionally', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await mkdir('~/m-tenant/subtree');
      await write('~/m-tenant/subtree/a.txt', 'aaa');
      await write('~/m-tenant/subtree/nested/b.txt', 'bbb');

      const moved = await move('~/m-tenant/subtree', '~/m-tenant/subtree-moved');

      expect(moved).toBe(true);
      expect(await read('~/m-tenant/subtree-moved/a.txt', { encoding: 'text' })).toBe('aaa');
      expect(await read('~/m-tenant/subtree-moved/nested/b.txt', { encoding: 'text' })).toBe('bbb');
      expect(await exists('~/m-tenant/subtree/a.txt')).toBe(false);
    });
  });

  it('rejects an existing destination with EEXIST — move never overwrites', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await remove('~/m-tenant', { recursive: true });
      await write('~/m-tenant/movable2.txt', 'hello');
      await write('~/m-tenant/taken2.txt', 'occupied');

      await expectDenial(
        () => move('~/m-tenant/movable2.txt', '~/m-tenant/taken2.txt'),
        'EEXIST',
        'already exists',
        '/users/alice/m-tenant/taken2.txt'
      );
    });
  });

  it('rejects a missing source with ENOENT', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      await expectDenial(
        () => move('~/m-tenant/ghost.txt', '~/m-tenant/destination.txt'),
        'ENOENT',
        'does not exist',
        '/users/alice/m-tenant/ghost.txt'
      );
    });
  });
});

describe('mutation stubs — user-scoped system', () => {
  it('moves within a shared canonical directory when the rule allows move', async () => {
    await withFs(
      {
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: [{ path: '/shared/**', allow: ['write', 'read', 'move', 'remove'] }],
      },
      async () => {
        implement({ bucket, indexer: db });
        await remove('/shared/m-user', { recursive: true });
        await write('/shared/m-user/original.txt', 'hello team');

        const moved = await move('/shared/m-user/original.txt', '/shared/m-user/relocated.txt');

        expect(moved).toBe(true);
        expect(await read('/shared/m-user/relocated.txt', { encoding: 'text' })).toBe('hello team');
      }
    );
  });

  it('denies a copy whose destination falls outside the rules — EACCES across the wire', async () => {
    await withFs(
      {
        ownerId: 'bob',
        homeDir: '/users/bob',
        accessRules: [{ path: '/shared/**', allow: ['write', 'read', 'copy'] }],
      },
      async () => {
        implement({ bucket, indexer: db });
        await write('/shared/m-user/public.txt', 'hello');

        await expectDenial(
          () => copy('/shared/m-user/public.txt', '/private/m-user/leak.txt'),
          'EACCES',
          'accessRules',
          '/private/m-user/leak.txt'
        );
      }
    );
  });
});

describe('mutation stubs — open system', () => {
  it('copies under the default home', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      await remove('~/m-open', { recursive: true });
      await write('~/m-open/source.txt', 'hello');

      const copied = await copy('~/m-open/source.txt', '~/m-open/destination.txt');

      expect(copied).toBe(true);
      expect(await read('~/m-open/destination.txt', { encoding: 'text' })).toBe('hello');
    });
  });
});

describe('mutation stubs — wiring variations carry the same contract', () => {
  it('moves identically over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await remove('~/m-r2only', { recursive: true });
      await write('~/m-r2only/movable.txt', 'hello');

      const moved = await move('~/m-r2only/movable.txt', '~/m-r2only/moved.txt');

      expect(moved).toBe(true);
      expect(await read('~/m-r2only/moved.txt', { encoding: 'text' })).toBe('hello');
      expect(await exists('~/m-r2only/movable.txt')).toBe(false);
    });
  });

  it('copies through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });
      await remove('~/m-adapter', { recursive: true });
      await write('~/m-adapter/source.txt', 'hello');

      const copied = await copy('~/m-adapter/source.txt', '~/m-adapter/destination.txt');

      expect(copied).toBe(true);
      expect(await read('~/m-adapter/destination.txt', { encoding: 'text' })).toBe('hello');
    });
  });
});
