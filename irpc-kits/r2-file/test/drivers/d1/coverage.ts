import type { D1Database } from '@cloudflare/workers-types';
import { HandlerError, IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { decodePayload, preparePayload } from '../../../src/drivers/d1/codec.js';
import { D1Driver } from '../../../src/drivers/d1/driver.js';
import {
  buildListQuery,
  buildOrderBy,
  buildSearchQuery,
  decodeCursor,
  encodeCursor,
} from '../../../src/drivers/d1/query.js';
import { ensureSchema } from '../../../src/drivers/d1/schema.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { basename, dirname } from '../../../src/utils/path.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/coverage: missing D1 binding DB');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1cov%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1cov%').run();
});

describe('D1Driver auxiliary functions and branch coverage', () => {
  describe('path utilities', () => {
    it('covers basename with various paths', () => {
      expect(basename('/')).toBe('');
      expect(basename('')).toBe('');
      expect(basename('filename.txt')).toBe('filename.txt');
      expect(basename('/dir/file.txt')).toBe('file.txt');
      expect(basename('/dir/subdir/')).toBe('subdir');
      expect(basename('/dir/')).toBe('dir');
    });

    it('covers dirname with various paths', () => {
      expect(dirname('/')).toBe('/');
      expect(dirname('')).toBe('/');
      expect(dirname('filename.txt')).toBe('/');
      expect(dirname('/file.txt')).toBe('/');
      expect(dirname('/dir/file.txt')).toBe('/dir');
      expect(dirname('/dir/subdir/')).toBe('/dir');
      expect(dirname('/a/b/c/d.txt')).toBe('/a/b/c');
    });
  });

  describe('codec utilities', () => {
    it('covers preparePayload with default parameters and various inputs', () => {
      const defaultPrep = preparePayload('short text');
      expect(defaultPrep.shouldInline).toBe(true);
      expect(defaultPrep.content).toBe('short text');

      const irpcFile = new IRPCFile(
        { name: 'test.bin', size: 10, type: 'application/octet-stream' },
        new Blob([new Uint8Array(10)])
      );
      const filePrep = preparePayload(irpcFile);
      expect(filePrep.shouldInline).toBe(false);
      expect(filePrep.content).toBeNull();
      expect(filePrep.size).toBe(10);

      const objPrep = preparePayload({ key: 'val' });
      expect(objPrep.shouldInline).toBe(true);
      expect(objPrep.content).toBe('{"key":"val"}');

      const dataUrlPrep = preparePayload('data:text/plain;charset=utf-8,hello%20world', {
        encoding: 'data-url',
        type: 'text/plain',
      });
      expect(dataUrlPrep.shouldInline).toBe(true);
      expect(dataUrlPrep.content).toBe('hello world');

      const bigPrep = preparePayload('abcdefghijklmnopqrstuvwxyz', undefined, 10);
      expect(bigPrep.shouldInline).toBe(false);
      expect(bigPrep.content).toBe('abcdefghijklmnopqrstuvwxyz');
    });

    it('covers decodePayload across all encoding types and fallbacks', () => {
      expect(decodePayload('test', 'text/plain', 'text')).toBe('test');
      expect(decodePayload('{"a":1}', 'application/json', 'json')).toEqual({ a: 1 });
      expect(decodePayload('hello', 'text/plain', 'base64')).toBe(Buffer.from('hello').toString('base64'));
      expect(decodePayload('hello', 'text/plain', 'data-url')).toBe('data:text/plain;base64,aGVsbG8=');
      expect(decodePayload('hello', 'text/plain', undefined)).toBe('hello');
      expect(decodePayload('hello', 'text/plain', 'unknown' as never)).toBe('hello');
    });

    it('wraps malformed data-url encoding failures as EINVAL HandlerError', () => {
      let failure: unknown;
      try {
        preparePayload('data:text/plain,%', { encoding: 'data-url', type: 'text/plain' });
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(HandlerError);
      const denial = failure as HandlerError & { code: unknown; cause: unknown };
      expect(denial.code).toBe('EINVAL');
      expect(denial.message).toBe('Invalid file content');
      expect(denial.message).not.toMatch(/[/\\]/);
      expect(denial.cause).toBeInstanceOf(Error);
    });

    it('wraps invalid JSON decode failures as EINVAL HandlerError', () => {
      let failure: unknown;
      try {
        decodePayload('not-json', 'text/plain', 'json');
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(HandlerError);
      const denial = failure as HandlerError & { code: unknown; cause: unknown };
      expect(denial.code).toBe('EINVAL');
      expect(denial.message).toBe('Invalid JSON content');
      expect(denial.message).not.toMatch(/[/\\]/);
      expect(denial.cause).toBeInstanceOf(Error);
    });
  });

  describe('query builder edge branches', () => {
    it('covers buildOrderBy with various sorts and fallbacks', () => {
      expect(buildOrderBy()).toBe('name ASC');
      expect(buildOrderBy([])).toBe('name ASC');
      expect(buildOrderBy('unknown_column' as never)).toBe('name ASC');
      expect(buildOrderBy('-name')).toBe('name DESC');
      expect(buildOrderBy('size')).toBe('size ASC');
      expect(buildOrderBy(['-mtime', 'size'])).toBe('mtime DESC, size ASC');
    });

    it('covers decodeCursor and encodeCursor', () => {
      expect(decodeCursor()).toBe(0);
      expect(decodeCursor('')).toBe(0);
      expect(decodeCursor('invalid-base64-%%')).toBe(0);
      expect(decodeCursor(encodeCursor(42))).toBe(42);
    });

    it('covers buildListQuery with filter ranges using Date and timestamp', () => {
      const now = new Date();
      const q = buildListQuery('/d1cov', {
        filter: {
          mtime: { min: now, max: now.getTime() + 1000 },
          size: { min: 10, max: 200 },
          type: 'text/plain',
          metadata: { tag: 'cov' },
        },
      });
      expect(q.sql).toContain('mtime >= ?');
      expect(q.sql).toContain('mtime <= ?');
      expect(q.sql).toContain('size >= ?');
      expect(q.sql).toContain('size <= ?');
      expect(q.sql).toContain('json_extract(metadata, ?)');
    });

    it('covers buildSearchQuery with cursor and no limit', () => {
      const cursor = encodeCursor(15);
      const q = buildSearchQuery('test', '/d1cov', ['tag'], { cursor });
      expect(q.sql).toContain('LIMIT -1 OFFSET 15');
    });

    it('covers buildSearchQuery at root directory scope', () => {
      const q = buildSearchQuery('test', '/', undefined);
      expect(q.sql).not.toContain('directory = ?');
    });
  });

  describe('driver runtime branches through pipeline contract', () => {
    it('initializes schema without ownerKey cleanly', async () => {
      await expect(ensureSchema(db, '')).resolves.toBeUndefined();
    });

    it('instantiates D1Driver with default options', () => {
      const defaultDriver = new D1Driver(db);
      expect(defaultDriver).toBeDefined();
    });

    it('executes hard recursive removal deleting files and contents', async () => {
      const normalize = new NormalizerDriver();
      const hardDriver = new D1Driver(db, { softDelete: false });
      await withFs({ ownerId: 'cov' }, async () => {
        const dirCtx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.mkdir(dirCtx, '/d1cov/hard-rec');
        await hardDriver.mkdir(dirCtx, '/d1cov/hard-rec');

        const f1Ctx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(f1Ctx, '/d1cov/hard-rec/f1.txt', 'content 1', { type: 'text/plain' });
        await hardDriver.write(f1Ctx, '/d1cov/hard-rec/f1.txt', 'content 1', { type: 'text/plain' });

        const f2Ctx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(f2Ctx, '/d1cov/hard-rec/f2.txt', 'content 2', { type: 'text/plain' });
        await hardDriver.write(f2Ctx, '/d1cov/hard-rec/f2.txt', 'content 2', { type: 'text/plain' });

        const rmCtx: DriverContext<boolean> = createDriverCtx();
        await normalize.remove(rmCtx, '/d1cov/hard-rec', { recursive: true });
        await hardDriver.remove(rmCtx, '/d1cov/hard-rec', { recursive: true });
        expect(rmCtx.result).toBe(true);

        const checkRow = await db
          .prepare('SELECT path FROM _r2_files WHERE path LIKE ?')
          .bind('/d1cov/hard-rec%')
          .first();
        expect(checkRow).toBeNull();
      });
    });

    it('executes copy, move, link, and restore adhering to DriverContext contract', async () => {
      const normalize = new NormalizerDriver();
      const driver = new D1Driver(db);
      await withFs({ ownerId: 'cov' }, async () => {
        const ctx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(ctx, '/d1cov/ops/src.txt', 'source data', { type: 'text/plain' });
        await driver.write(ctx, '/d1cov/ops/src.txt', 'source data', { type: 'text/plain' });

        const copyCtx: DriverContext<boolean> = createDriverCtx();
        await normalize.copy(copyCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-copy.txt');
        await driver.copy(copyCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-copy.txt');
        expect(copyCtx.result).toBe(true);

        const copyPrivCtx: DriverContext<boolean> = createDriverCtx();
        await normalize.copy(copyPrivCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-priv.txt', { public: false });
        await driver.copy(copyPrivCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-priv.txt', { public: false });
        expect(copyPrivCtx.result).toBe(true);

        const linkCtx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.link(linkCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-link.txt');
        await driver.link(linkCtx, '/d1cov/ops/src.txt', '/d1cov/ops/dest-link.txt');
        expect(linkCtx.result).toBeDefined();

        const moveCtx: DriverContext<boolean> = createDriverCtx();
        await normalize.move(moveCtx, '/d1cov/ops/dest-copy.txt', '/d1cov/ops/dest-moved.txt');
        await driver.move(moveCtx, '/d1cov/ops/dest-copy.txt', '/d1cov/ops/dest-moved.txt');
        expect(moveCtx.result).toBe(true);

        const softDriver = new D1Driver(db, { softDelete: true });
        const rmCtx: DriverContext<boolean> = createDriverCtx();
        await normalize.remove(rmCtx, '/d1cov/ops/src.txt');
        await softDriver.remove(rmCtx, '/d1cov/ops/src.txt');
        expect(rmCtx.result).toBe(true);

        const restoreCtx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.restore(restoreCtx, '/d1cov/ops/src.txt');
        await softDriver.restore(restoreCtx, '/d1cov/ops/src.txt');
        expect(restoreCtx.result).toBeDefined();
      });
    });

    it('covers write without explicit type defaulting to null in database', async () => {
      const normalize = new NormalizerDriver();
      const driver = new D1Driver(db);
      await withFs({ ownerId: 'cov' }, async () => {
        const ctx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(ctx, '/d1cov/notype.txt', 'no type content');
        await driver.write(ctx, '/d1cov/notype.txt', 'no type content');
        expect(ctx.result?.path).toBe('/d1cov/notype.txt');
      });
    });

    it('short-circuits a self-move without destroying the record', async () => {
      const normalize = new NormalizerDriver();
      const driver = new D1Driver(db);
      await withFs({ ownerId: 'cov' }, async () => {
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, '/d1cov/selfmove.txt', 'keep me', { type: 'text/plain' });
        await driver.write(seed, '/d1cov/selfmove.txt', 'keep me', { type: 'text/plain' });

        const moveCtx: DriverContext<boolean> = createDriverCtx();
        moveCtx.path = '/d1cov/selfmove.txt';
        moveCtx.destination = '/d1cov/selfmove.txt';
        await driver.move(moveCtx, '/d1cov/selfmove.txt', '/d1cov/selfmove.txt');

        expect(moveCtx.result).toBe(true);
        expect(
          await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1cov/selfmove.txt').first()
        ).not.toBeNull();
      });
    });

    it('wraps rollback batch failures as typed EIO HandlerError', async () => {
      let batchCalls = 0;
      const failingRollbackDb = {
        prepare() {
          return {
            bind() {
              return this;
            },
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          };
        },
        batch: async (statements: unknown[]) => {
          batchCalls++;
          if (batchCalls === 1) return statements.map(() => ({ results: [], success: true }));
          throw new Error('D1_ROLLBACK_FAILURE: compensation I/O error');
        },
      } as unknown as D1Database;

      const driver = new D1Driver(failingRollbackDb);
      const ctx = createDriverCtx<FileInfo>();
      await driver.write(ctx, '/d1cov/rollback-fail.txt', 'data', { type: 'text/plain' });

      expect(ctx.rollback.size).toBe(1);
      const [rollback] = [...ctx.rollback];

      let failure: unknown;
      try {
        await rollback();
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(HandlerError);
      const denial = failure as HandlerError & { code: unknown; cause: unknown };
      expect(denial.code).toBe('EIO');
      expect(denial.message).toBe('Failed to write');
      expect(denial.message).not.toMatch(/[/\\]/);
      expect(denial.cause).toBeInstanceOf(Error);
      expect((denial.cause as Error).message).toContain('D1_ROLLBACK_FAILURE');
    });

    it('restores an overwritten spilled record without inline content on rollback', async () => {
      const normalize = new NormalizerDriver();
      const driver = new D1Driver(db);
      await withFs({ ownerId: 'cov' }, async () => {
        const spilled = new IRPCFile(
          { name: 'spill.txt', size: 7, type: 'text/plain' },
          new Blob([new TextEncoder().encode('stream1')], { type: 'text/plain' })
        );
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, '/d1cov/spill-rb.txt', spilled, { type: 'text/plain' });
        await driver.write(seed, '/d1cov/spill-rb.txt', spilled, { type: 'text/plain' });

        const overCtx: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(overCtx, '/d1cov/spill-rb.txt', 'inline now', { type: 'text/plain' });
        await driver.write(overCtx, '/d1cov/spill-rb.txt', 'inline now', { type: 'text/plain' });

        expect(overCtx.rollback.size).toBe(1);
        for (const rb of overCtx.rollback) await rb();

        const restored = await db
          .prepare('SELECT size FROM _r2_files WHERE path = ?')
          .bind('/d1cov/spill-rb.txt')
          .first<{ size: number }>();
        expect(restored?.size).toBe(7);
        expect(
          await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1cov/spill-rb.txt').first()
        ).toBeNull();
      });
    });
  });
});
