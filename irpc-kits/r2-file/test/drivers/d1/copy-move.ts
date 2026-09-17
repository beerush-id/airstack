import type { D1Database } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
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
  if (!env.DB) throw new Error('d1/copy-move.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1copymove%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1copymove%').run();
});

describe('D1Driver copy and move operations', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1copymove%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1copymove%').run();
  });

  it('duplicates the record and its inlined payload', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1copymove/copy/s.txt', 'copy me', { type: 'text/plain' });
      await driver.write(seed, '/d1copymove/copy/s.txt', 'copy me', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/d1copymove/copy/s.txt', '/d1copymove/copy/d.txt');
      await driver.copy(ctx, '/d1copymove/copy/s.txt', '/d1copymove/copy/d.txt');

      expect(ctx.result).toBe(true);
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1copymove/copy/d.txt').first()
      ).not.toBeNull();
    });
  });

  it('halts copy with ENOENT on a missing source', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/d1copymove/copy/ghost.txt', '/d1copymove/copy/d.txt');

      await expectDenial(
        () => {
          return driver.copy(ctx, '/d1copymove/copy/ghost.txt', '/d1copymove/copy/d.txt');
        },
        'ENOENT',
        '/d1copymove/copy/ghost.txt'
      );
    });
  });

  it('moves the record and its payload atomically', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1copymove/move/m.txt', 'atomic', { type: 'text/plain' });
      await driver.write(seed, '/d1copymove/move/m.txt', 'atomic', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/d1copymove/move/m.txt', '/d1copymove/move/m-moved.txt');
      await driver.move(ctx, '/d1copymove/move/m.txt', '/d1copymove/move/m-moved.txt');

      expect(ctx.result).toBe(true);
      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/move/m.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/move/m-moved.txt').first()
      ).not.toBeNull();
    });
  });

  it('halts move with ENOENT on a missing source', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/d1copymove/move/ghost.txt', '/d1copymove/move/d.txt');

      await expectDenial(
        () => {
          return driver.move(ctx, '/d1copymove/move/ghost.txt', '/d1copymove/move/d.txt');
        },
        'ENOENT',
        '/d1copymove/move/ghost.txt'
      );
    });
  });

  it('registers a rollback handler that deletes the copied destination and keeps source intact', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1copymove/copy/rb-s.txt', 'data', { type: 'text/plain' });
      await driver.write(seed, '/d1copymove/copy/rb-s.txt', 'data', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/d1copymove/copy/rb-s.txt', '/d1copymove/copy/rb-d.txt');
      await driver.copy(ctx, '/d1copymove/copy/rb-s.txt', '/d1copymove/copy/rb-d.txt');

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/copy/rb-d.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_contents WHERE path = ?').bind('/d1copymove/copy/rb-d.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/copy/rb-s.txt').first()
      ).not.toBeNull();
    });
  });

  it('registers a rollback handler that restores the original path and contents on reversal', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/d1copymove/move/rb-src.txt', 'move data', { type: 'text/plain' });
      await driver.write(seed, '/d1copymove/move/rb-src.txt', 'move data', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/d1copymove/move/rb-src.txt', '/d1copymove/move/rb-dst.txt');
      await driver.move(ctx, '/d1copymove/move/rb-src.txt', '/d1copymove/move/rb-dst.txt');

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/move/rb-dst.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1copymove/move/rb-src.txt').first()
      ).not.toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_contents WHERE path = ?').bind('/d1copymove/move/rb-src.txt').first()
      ).not.toBeNull();
    });
  });

  it('copies spilled payloads and allows overriding public status', async () => {
    await withFs({}, async () => {
      const spilled = new IRPCFile(
        { name: 'spill.txt', size: 6, type: 'text/plain' },
        new Blob([new TextEncoder().encode('stream')], { type: 'text/plain' })
      );
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1copymove/copy/spilled-src.txt', spilled, { type: 'text/plain', public: false });
      await driver.write(s1, '/d1copymove/copy/spilled-src.txt', spilled, { type: 'text/plain', public: false });

      const copyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(copyCtx, '/d1copymove/copy/spilled-src.txt', '/d1copymove/copy/spilled-dest.txt', {
        public: true,
      });
      await driver.copy(copyCtx, '/d1copymove/copy/spilled-src.txt', '/d1copymove/copy/spilled-dest.txt', {
        public: true,
      });
      expect(copyCtx.result).toBe(true);

      const destRow = await db
        .prepare('SELECT public, size FROM _r2_files WHERE path = ?')
        .bind('/d1copymove/copy/spilled-dest.txt')
        .first<{ public: number; size: number }>();
      expect(destRow?.public).toBe(1);
      expect(destRow?.size).toBe(6);
    });
  });

  it('rejects copy with EEXIST when the destination record exists', async () => {
    await withFs({}, async () => {
      const srcSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(srcSeed, '/d1copymove/copy/ex-src.txt', 'new data', { type: 'text/plain' });
      await driver.write(srcSeed, '/d1copymove/copy/ex-src.txt', 'new data', { type: 'text/plain' });

      const dstSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(dstSeed, '/d1copymove/copy/ex-dest.txt', 'existing', { type: 'text/plain' });
      await driver.write(dstSeed, '/d1copymove/copy/ex-dest.txt', 'existing', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/d1copymove/copy/ex-src.txt', '/d1copymove/copy/ex-dest.txt');

      await expectDenial(
        () => driver.copy(ctx, '/d1copymove/copy/ex-src.txt', '/d1copymove/copy/ex-dest.txt'),
        'EEXIST',
        '/d1copymove/copy/ex-dest.txt'
      );
      const content = await db
        .prepare('SELECT content FROM _r2_contents WHERE path = ?')
        .bind('/d1copymove/copy/ex-dest.txt')
        .first<{ content: string }>();
      expect(content?.content).toBe('existing');
    });
  });

  it('rejects move with EEXIST when the destination record exists', async () => {
    await withFs({}, async () => {
      const srcSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(srcSeed, '/d1copymove/move/ex-src.txt', 'source', { type: 'text/plain' });
      await driver.write(srcSeed, '/d1copymove/move/ex-src.txt', 'source', { type: 'text/plain' });

      const dstSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(dstSeed, '/d1copymove/move/ex-dest.txt', 'existing', { type: 'text/plain' });
      await driver.write(dstSeed, '/d1copymove/move/ex-dest.txt', 'existing', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/d1copymove/move/ex-src.txt', '/d1copymove/move/ex-dest.txt');

      await expectDenial(
        () => driver.move(ctx, '/d1copymove/move/ex-src.txt', '/d1copymove/move/ex-dest.txt'),
        'EEXIST',
        '/d1copymove/move/ex-dest.txt'
      );
      expect(
        await db.prepare('SELECT 1 FROM _r2_files WHERE path = ?').bind('/d1copymove/move/ex-src.txt').first()
      ).not.toBeNull();
    });
  });

  it('copies a directory subtree recursively', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/d1copymove/dir-src');
      await driver.mkdir(dirCtx, '/d1copymove/dir-src');
      const aCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(aCtx, '/d1copymove/dir-src/a.txt', 'aaa', { type: 'text/plain' });
      await driver.write(aCtx, '/d1copymove/dir-src/a.txt', 'aaa', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/d1copymove/dir-src', '/d1copymove/dir-dst');
      await driver.copy(ctx, '/d1copymove/dir-src', '/d1copymove/dir-dst');

      expect(ctx.result).toBe(true);
      expect(
        await db.prepare('SELECT 1 FROM _r2_files WHERE path = ?').bind('/d1copymove/dir-dst/a.txt').first()
      ).not.toBeNull();
      const content = await db
        .prepare('SELECT content FROM _r2_contents WHERE path = ?')
        .bind('/d1copymove/dir-dst/a.txt')
        .first<{ content: string }>();
      expect(content?.content).toBe('aaa');
    });
  });

  it('moves a directory subtree recursively', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/d1copymove/mv-dir-src');
      await driver.mkdir(dirCtx, '/d1copymove/mv-dir-src');
      const aCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(aCtx, '/d1copymove/mv-dir-src/a.txt', 'aaa', { type: 'text/plain' });
      await driver.write(aCtx, '/d1copymove/mv-dir-src/a.txt', 'aaa', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/d1copymove/mv-dir-src', '/d1copymove/mv-dir-dst');
      await driver.move(ctx, '/d1copymove/mv-dir-src', '/d1copymove/mv-dir-dst');

      expect(ctx.result).toBe(true);
      const content = await db
        .prepare('SELECT content FROM _r2_contents WHERE path = ?')
        .bind('/d1copymove/mv-dir-dst/a.txt')
        .first<{ content: string }>();
      expect(content?.content).toBe('aaa');
      expect(
        await db.prepare('SELECT 1 FROM _r2_files WHERE path = ?').bind('/d1copymove/mv-dir-src/a.txt').first()
      ).toBeNull();
    });
  });
});
