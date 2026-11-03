import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { exists, link, mkdir, read, remove, stat, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/link: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/link: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('mkdir stub — multi-tenant system, options entrance', () => {
  it('creates a directory and returns its FileInfo with the canonical path, mount invisible', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await mkdir('~/k-tenant/folder');

      expect(info.path).toBe('/users/alice/k-tenant/folder');
      expect(info.name).toBe('folder');
      expect(info.isDirectory).toBe(true);
      expect(info.mtime).toBeInstanceOf(Date);
      expect(await exists('~/k-tenant/folder')).toBe(true);
    });
  });

  it('creates a directory under the default home in an open system', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });

      const info = await mkdir('~/k-open/folder');

      expect(info.path).toBe('/home/k-open/folder');
      expect(info.isDirectory).toBe(true);
    });
  });

  it('creates a directory through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });

      const info = await mkdir('~/k-adapter/folder');

      expect(info.path).toBe('/users/alice/k-adapter/folder');
      expect(info.isDirectory).toBe(true);
    });
  });

  it('denies a mkdir outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(() => mkdir('/private/k-user/squat'), 'EACCES', 'accessRules', '/private/k-user/squat');
    });
  });
});

describe('link stub — multi-tenant system, options entrance', () => {
  it('creates a symbolic link whose FileInfo carries the canonical target', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/k-tenant/target.txt', 'hello');

      const info = await link('~/k-tenant/target.txt', '~/k-tenant/alias.txt');

      expect(info.path).toBe('/users/alice/k-tenant/alias.txt');
      expect(info.link).toBe('/users/alice/k-tenant/target.txt');
    });
  });

  it('derives size and type from the target dynamically on stat', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/k-stat/target.txt', 'hello');
      await link('~/k-stat/target.txt', '~/k-stat/alias.txt');

      const info = await stat('~/k-stat/alias.txt');

      expect(info?.size).toBe(5);
      expect(info?.type).toBe('text/plain');
      expect(info?.link).toBe('/users/alice/k-stat/target.txt');
    });
  });

  it('reads through the link and follows target updates without stale metadata', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/k-read/target.txt', 'hello');
      await link('~/k-read/target.txt', '~/k-read/alias.txt');

      expect(await read('~/k-read/alias.txt', { encoding: 'text' })).toBe('hello');

      await write('~/k-read/target.txt', 'hello world');

      expect(await read('~/k-read/alias.txt', { encoding: 'text' })).toBe('hello world');
    });
  });

  it('removes the link alone and leaves the target intact', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });
      await write('~/k-unlink/target.txt', 'hello');
      await link('~/k-unlink/target.txt', '~/k-unlink/alias.txt');

      const removed = await remove('~/k-unlink/alias.txt');

      expect(removed).toBe(true);
      expect(await exists('~/k-unlink/alias.txt')).toBe(false);
      expect(await read('~/k-unlink/target.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('creates a link over R2-only wiring with the same contract', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });
      await write('~/k-r2only/target.txt', 'hello');

      const info = await link('~/k-r2only/target.txt', '~/k-r2only/alias.txt');

      expect(info.path).toBe('/users/alice/k-r2only/alias.txt');
      expect(info.link).toBe('/users/alice/k-r2only/target.txt');
      expect(await read('~/k-r2only/alias.txt', { encoding: 'text' })).toBe('hello');
    });
  });

  it('denies a link outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => link('/private/k-user/target.txt', '/private/k-user/alias.txt'),
        'EACCES',
        'accessRules',
        '/private/k-user/target.txt'
      );
    });
  });
});
