import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/mkdir.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1mkdir%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1mkdir%').run();
});

describe('D1Driver mkdir operations', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1mkdir%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1mkdir%').run();
  });

  it('records a directory row with the inode descriptor', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx = createDriverCtx<FileInfo>();

      await normalize.mkdir(ctx, '/d1mkdir/docs');
      await driver.mkdir(ctx, '/d1mkdir/docs');

      expect((ctx.result as FileInfo).path).toBe('/d1mkdir/docs');
      expect((ctx.result as FileInfo).type).toBe('inode/directory');
      expect((ctx.result as FileInfo).size).toBe(0);
      expect((ctx.result as FileInfo).isDirectory).toBe(true);
    });
  });

  it('supports directory metadata, public flag, and idempotent updates on conflict', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx = createDriverCtx<FileInfo>();
      await normalize.mkdir(ctx, '/d1mkdir/public-meta', { public: true, metadata: { section: 'docs' } });
      await driver.mkdir(ctx, '/d1mkdir/public-meta', { public: true, metadata: { section: 'docs' } });

      expect(ctx.result?.public).toBe(true);
      expect(ctx.result?.metadata).toEqual({ section: 'docs' });

      const row = await db
        .prepare('SELECT public, metadata FROM _r2_files WHERE path = ?')
        .bind('/d1mkdir/public-meta')
        .first<{ public: number; metadata: string }>();
      expect(row?.public).toBe(1);
      expect(JSON.parse(row!.metadata)).toEqual({ section: 'docs' });

      const updateCtx = createDriverCtx<FileInfo>();
      await normalize.mkdir(updateCtx, '/d1mkdir/public-meta', { public: false, metadata: { section: 'archive' } });
      await driver.mkdir(updateCtx, '/d1mkdir/public-meta', { public: false, metadata: { section: 'archive' } });

      expect(updateCtx.result?.public).toBe(false);
      expect(updateCtx.result?.metadata).toEqual({ section: 'archive' });
    });
  });

  it('registers a rollback handler that purges the created directory row on reversal', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx = createDriverCtx<FileInfo>();

      await normalize.mkdir(ctx, '/d1mkdir/rb-docs');
      await driver.mkdir(ctx, '/d1mkdir/rb-docs');

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      expect(await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1mkdir/rb-docs').first()).toBeNull();
    });
  });
});
