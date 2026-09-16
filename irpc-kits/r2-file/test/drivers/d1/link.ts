import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/link.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1link%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1link%').run();
});

describe('D1Driver link operations and alias resolution', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1link%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1link%').run();
  });

  it('records the alias resolving live target metadata', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1link/target.txt', 'target bytes', { type: 'text/plain' });
      await driver.write(seed, '/d1link/target.txt', 'target bytes', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/d1link/target.txt', '/d1link/alias.txt');
      await driver.link(ctx, '/d1link/target.txt', '/d1link/alias.txt');

      expect((ctx.result as FileInfo).link).toBe('/d1link/target.txt');

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/d1link/alias.txt');
      await driver.stat(stat, '/d1link/alias.txt');

      expect((stat.result as FileInfo).size).toBe(12);
    });
  });

  it('supports public visibility, metadata, and idempotent re-linking on conflict', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1link/t1.txt', 't1', { type: 'text/plain' });
      await driver.write(s1, '/d1link/t1.txt', 't1', { type: 'text/plain' });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1link/t2.txt', 't2', { type: 'text/plain' });
      await driver.write(s2, '/d1link/t2.txt', 't2', { type: 'text/plain' });

      const linkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(linkCtx, '/d1link/t1.txt', '/d1link/pub-meta.lnk', {
        public: true,
        metadata: { purpose: 'shortcut' },
      });
      await driver.link(linkCtx, '/d1link/t1.txt', '/d1link/pub-meta.lnk', {
        public: true,
        metadata: { purpose: 'shortcut' },
      });

      expect(linkCtx.result?.public).toBe(true);
      expect(linkCtx.result?.metadata).toEqual({ purpose: 'shortcut' });

      const relinkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(relinkCtx, '/d1link/t2.txt', '/d1link/pub-meta.lnk', {
        public: false,
        metadata: { purpose: 'updated' },
      });
      await driver.link(relinkCtx, '/d1link/t2.txt', '/d1link/pub-meta.lnk', {
        public: false,
        metadata: { purpose: 'updated' },
      });

      expect(relinkCtx.result?.link).toBe('/d1link/t2.txt');
      expect(relinkCtx.result?.public).toBe(false);
      expect(relinkCtx.result?.metadata).toEqual({ purpose: 'updated' });
    });
  });

  it('registers a rollback handler that purges the created symlink row on reversal', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1link/rb-target.txt', 'target', { type: 'text/plain' });
      await driver.write(seed, '/d1link/rb-target.txt', 'target', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/d1link/rb-target.txt', '/d1link/rb-alias.txt');
      await driver.link(ctx, '/d1link/rb-target.txt', '/d1link/rb-alias.txt');

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1link/rb-alias.txt').first()
      ).toBeNull();
    });
  });
});
