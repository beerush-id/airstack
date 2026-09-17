import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { expectDenial, withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/remove-restore.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1remove%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1remove%').run();
});

describe('D1Driver remove and restore operations', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1remove%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1remove%').run();
  });

  it('returns false when removing a path that does not exist in the index', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/missing.txt');
      await driver.remove(ctx, '/d1remove/missing.txt');

      expect(ctx.result).toBe(false);
    });
  });

  it('soft-deletes a directory across its whole subtree', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const dir: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dir, '/d1remove/sub');
      await soft.mkdir(dir, '/d1remove/sub');
      const f: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f, '/d1remove/sub/a.txt', 'x', { type: 'text/plain' });
      await soft.write(f, '/d1remove/sub/a.txt', 'x', { type: 'text/plain' });

      const rm: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rm, '/d1remove/sub');
      await soft.remove(rm, '/d1remove/sub');

      const child = await db
        .prepare('SELECT deleted_at FROM _r2_files WHERE path = ?')
        .bind('/d1remove/sub/a.txt')
        .first<{ deleted_at: number | null }>();
      expect(child?.deleted_at).not.toBeNull();
    });
  });

  it('restores a directory across its whole subtree', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const dir: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dir, '/d1remove/rsub');
      await soft.mkdir(dir, '/d1remove/rsub');
      const f: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f, '/d1remove/rsub/a.txt', 'x', { type: 'text/plain' });
      await soft.write(f, '/d1remove/rsub/a.txt', 'x', { type: 'text/plain' });

      const rm: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rm, '/d1remove/rsub');
      await soft.remove(rm, '/d1remove/rsub');
      const rs: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(rs, '/d1remove/rsub');
      await soft.restore(rs, '/d1remove/rsub');

      const child = await db
        .prepare('SELECT deleted_at FROM _r2_files WHERE path = ?')
        .bind('/d1remove/rsub/a.txt')
        .first<{ deleted_at: number | null }>();
      expect(child?.deleted_at).toBeNull();
    });
  });

  it('removes a file row and its content unconditionally', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/trash.txt', 'trash', { type: 'text/plain' });
      await driver.write(seed, '/d1remove/trash.txt', 'trash', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/trash.txt');
      await driver.remove(ctx, '/d1remove/trash.txt');

      expect(ctx.result).toBe(true);
      expect(await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1remove/trash.txt').first()).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_contents WHERE path = ?').bind('/d1remove/trash.txt').first()
      ).toBeNull();
    });
  });

  it('purges empty directory rows', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(seed, '/d1remove/empty-dir');
      await driver.mkdir(seed, '/d1remove/empty-dir');

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/empty-dir');
      await driver.remove(ctx, '/d1remove/empty-dir');

      expect(ctx.result).toBe(true);
      expect(await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1remove/empty-dir').first()).toBeNull();
    });
  });

  it('enforces strict non-empty directory removal rejection without context enforcement', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const strictDriver = new D1Driver(db, { strict: true });
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/d1remove/parent');
      await driver.mkdir(dirCtx, '/d1remove/parent');

      const childCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(childCtx, '/d1remove/parent/child.txt', 'child', { type: 'text/plain' });
      await driver.write(childCtx, '/d1remove/parent/child.txt', 'child', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/parent');
      await expect(strictDriver.remove(ctx, '/d1remove/parent')).rejects.toThrow('Directory not empty');
    });
  });

  it('soft-deletes a single file setting deleted_at timestamp', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/soft.txt', 'soft delete me', { type: 'text/plain' });
      await driver.write(seed, '/d1remove/soft.txt', 'soft delete me', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/soft.txt');
      await soft.remove(ctx, '/d1remove/soft.txt');

      expect(ctx.result).toBe(true);
      const row = await db
        .prepare('SELECT deleted_at FROM _r2_files WHERE path = ?')
        .bind('/d1remove/soft.txt')
        .first<{ deleted_at: number | null }>();
      expect(row?.deleted_at).not.toBeNull();
    });
  });

  it('soft-deletes recursively across an entire directory tree', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1remove/rec-soft/a.txt', 'a', { type: 'text/plain' });
      await soft.write(s1, '/d1remove/rec-soft/a.txt', 'a', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1remove/rec-soft/sub/b.txt', 'b', { type: 'text/plain' });
      await soft.write(s2, '/d1remove/rec-soft/sub/b.txt', 'b', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/rec-soft', { recursive: true });
      await soft.remove(ctx, '/d1remove/rec-soft', { recursive: true });

      expect(ctx.result).toBe(true);
      const rows = await db
        .prepare('SELECT path, deleted_at FROM _r2_files WHERE path LIKE ?')
        .bind('/d1remove/rec-soft%')
        .all<{ path: string; deleted_at: number | null }>();
      expect(rows.results.length).toBeGreaterThanOrEqual(2);
      expect(rows.results.every((r) => r.deleted_at !== null)).toBe(true);

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      const restoredRows = await db
        .prepare('SELECT path, deleted_at FROM _r2_files WHERE path LIKE ?')
        .bind('/d1remove/rec-soft%')
        .all<{ path: string; deleted_at: number | null }>();
      expect(restoredRows.results.every((r) => r.deleted_at === null)).toBe(true);
    });
  });

  it('hard-deletes permanently when force option is true on a softDelete driver', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const softDriver = new D1Driver(db, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/forced.txt', 'permanent delete', { type: 'text/plain' });
      await softDriver.write(seed, '/d1remove/forced.txt', 'permanent delete', { type: 'text/plain' });

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/d1remove/forced.txt', { force: true });
      await softDriver.remove(remCtx, '/d1remove/forced.txt', { force: true });

      expect(remCtx.result).toBe(true);
      expect(
        await db.prepare('SELECT 1 FROM _r2_files WHERE path = ?').bind('/d1remove/forced.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT 1 FROM _r2_contents WHERE path = ?').bind('/d1remove/forced.txt').first()
      ).toBeNull();
    });
  });

  it('restores a soft-deleted row to active state', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/back.txt', 'come back', { type: 'text/plain' });
      await driver.write(seed, '/d1remove/back.txt', 'come back', { type: 'text/plain' });

      const removed: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removed, '/d1remove/back.txt', {});
      await soft.remove(removed, '/d1remove/back.txt', {});

      const restored: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(restored, '/d1remove/back.txt', {});
      await soft.restore(restored, '/d1remove/back.txt', {});

      expect((restored.result as FileInfo).path).toBe('/d1remove/back.txt');
    });
  });

  it('halts restore with ENOENT outside the trash', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(ctx, '/d1remove/never.txt', {});

      await expectDenial(
        () => {
          return driver.restore(ctx, '/d1remove/never.txt', {});
        },
        'ENOENT',
        '/d1remove/never.txt'
      );
    });
  });

  it('halts restore with ENOENT when target file is active and not soft-deleted', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/active.txt', 'alive', { type: 'text/plain' });
      await driver.write(seed, '/d1remove/active.txt', 'alive', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(ctx, '/d1remove/active.txt', {});

      await expectDenial(
        () => {
          return driver.restore(ctx, '/d1remove/active.txt', {});
        },
        'ENOENT',
        '/d1remove/active.txt'
      );
    });
  });

  it('registers a rollback handler that clears the soft-delete timestamp on reversal', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const softDriver = new D1Driver(db, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/rb-soft.txt', 'soft', { type: 'text/plain' });
      await softDriver.write(seed, '/d1remove/rb-soft.txt', 'soft', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/d1remove/rb-soft.txt');
      await softDriver.remove(ctx, '/d1remove/rb-soft.txt');

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      const row = await db
        .prepare('SELECT deleted_at FROM _r2_files WHERE path = ?')
        .bind('/d1remove/rb-soft.txt')
        .first<{ deleted_at: number | null }>();
      expect(row?.deleted_at).toBeNull();
    });
  });

  it('registers a rollback handler that re-stamps the soft-delete timestamp when restore is reversed', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const softDriver = new D1Driver(db, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1remove/rb-res.txt', 'restore', { type: 'text/plain' });
      await softDriver.write(seed, '/d1remove/rb-res.txt', 'restore', { type: 'text/plain' });

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/d1remove/rb-res.txt');
      await softDriver.remove(remCtx, '/d1remove/rb-res.txt');

      const resCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(resCtx, '/d1remove/rb-res.txt');
      await softDriver.restore(resCtx, '/d1remove/rb-res.txt');

      expect(resCtx.rollback.size).toBe(1);
      for (const rb of resCtx.rollback) await rb();

      const row = await db
        .prepare('SELECT deleted_at FROM _r2_files WHERE path = ?')
        .bind('/d1remove/rb-res.txt')
        .first<{ deleted_at: number | null }>();
      expect(row?.deleted_at).not.toBeNull();
    });
  });
});
