import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo, Sort } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/list.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1list%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1list%').run();
});

describe('D1Driver list operations, filters, sorting, and pagination', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1list%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1list%').run();
  });

  it('lists children with an empty sealed result', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/flat/a.txt', 'a', { type: 'text/plain' });
      await driver.write(s1, '/d1list/flat/a.txt', 'a', { type: 'text/plain' });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/flat');
      await driver.list(ctx, '/d1list/flat');

      expect((ctx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['a.txt']);

      const empty: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(empty, '/d1list/void');
      await driver.list(empty, '/d1list/void');

      expect((empty.result as { entries: FileInfo[] }).entries).toEqual([]);
    });
  });

  it('paginates directory listing with nextCursor continuation', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/paged/a.txt', '1', { type: 'text/plain' });
      await driver.write(s1, '/d1list/paged/a.txt', '1', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/paged/b.txt', '2', { type: 'text/plain' });
      await driver.write(s2, '/d1list/paged/b.txt', '2', { type: 'text/plain' });
      const s3: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s3, '/d1list/paged/c.txt', '3', { type: 'text/plain' });
      await driver.write(s3, '/d1list/paged/c.txt', '3', { type: 'text/plain' });

      const ctx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/paged', { limit: 2, sort: 'name' });
      await driver.list(ctx, '/d1list/paged', { limit: 2, sort: 'name' });

      const page = ctx.result as { entries: FileInfo[]; nextCursor?: string };
      expect(page.entries.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt']);
      expect(page.nextCursor).toBeDefined();

      const nextCtx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.list(nextCtx, '/d1list/paged', { limit: 2, sort: 'name', cursor: page.nextCursor });
      await driver.list(nextCtx, '/d1list/paged', { limit: 2, sort: 'name', cursor: page.nextCursor });

      const nextPage = nextCtx.result as { entries: FileInfo[]; nextCursor?: string };
      expect(nextPage.entries.map((entry) => entry.name)).toEqual(['c.txt']);
    });
  });

  it('filters by MIME type on the index', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/filter/a.txt', 'a', { type: 'text/plain' });
      await driver.write(s1, '/d1list/filter/a.txt', 'a', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/filter/b.json', { b: 1 }, { type: 'application/json' });
      await driver.write(s2, '/d1list/filter/b.json', { b: 1 }, { type: 'application/json' });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/filter', { filter: { type: 'application/json' } });
      await driver.list(ctx, '/d1list/filter', { filter: { type: 'application/json' } });

      const names = (ctx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(names).toEqual(['b.json']);
    });
  });

  it('filters by size range on the index', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/sizes/small.txt', 'x', { type: 'text/plain' });
      await driver.write(s1, '/d1list/sizes/small.txt', 'x', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/sizes/big.txt', 'x'.repeat(64), { type: 'text/plain' });
      await driver.write(s2, '/d1list/sizes/big.txt', 'x'.repeat(64), { type: 'text/plain' });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/sizes', { filter: { size: { min: 32 } } });
      await driver.list(ctx, '/d1list/sizes', { filter: { size: { min: 32 } } });

      const names = (ctx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(names).toEqual(['big.txt']);
    });
  });

  it('filters by upper size bound and bounded range on the index', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/bnd/small.txt', '123', { type: 'text/plain' });
      await driver.write(s1, '/d1list/bnd/small.txt', '123', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/bnd/mid.txt', '1234567890', { type: 'text/plain' });
      await driver.write(s2, '/d1list/bnd/mid.txt', '1234567890', { type: 'text/plain' });
      const s3: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s3, '/d1list/bnd/big.txt', '12345678901234567890', { type: 'text/plain' });
      await driver.write(s3, '/d1list/bnd/big.txt', '12345678901234567890', { type: 'text/plain' });

      const maxCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(maxCtx, '/d1list/bnd', { filter: { size: { max: 5 } } });
      await driver.list(maxCtx, '/d1list/bnd', { filter: { size: { max: 5 } } });
      expect((maxCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['small.txt']);

      const bndCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(bndCtx, '/d1list/bnd', { filter: { size: { min: 5, max: 15 } } });
      await driver.list(bndCtx, '/d1list/bnd', { filter: { size: { min: 5, max: 15 } } });
      expect((bndCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['mid.txt']);
    });
  });

  it('filters by modification time range using Date and timestamp', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const now = Date.now();
      const past = new Date(now - 100_000);
      const future = new Date(now + 100_000);

      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/time/item.txt', 'time', { type: 'text/plain' });
      await driver.write(s1, '/d1list/time/item.txt', 'time', { type: 'text/plain' });

      const minCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(minCtx, '/d1list/time', { filter: { mtime: { min: past } } });
      await driver.list(minCtx, '/d1list/time', { filter: { mtime: { min: past } } });
      expect((minCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['item.txt']);

      const maxCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(maxCtx, '/d1list/time', { filter: { mtime: { max: future } } });
      await driver.list(maxCtx, '/d1list/time', { filter: { mtime: { max: future } } });
      expect((maxCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['item.txt']);

      const outCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(outCtx, '/d1list/time', { filter: { mtime: { min: future.getTime() } } });
      await driver.list(outCtx, '/d1list/time', { filter: { mtime: { min: future.getTime() } } });
      expect((outCtx.result as { entries: FileInfo[] }).entries).toEqual([]);
    });
  });

  it('filters by modification time max with timestamp and bounded range', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const now = Date.now();
      const past = now - 100_000;
      const future = now + 100_000;

      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/time-num/item.txt', 'time', { type: 'text/plain' });
      await driver.write(s1, '/d1list/time-num/item.txt', 'time', { type: 'text/plain' });

      const maxCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(maxCtx, '/d1list/time-num', { filter: { mtime: { max: future } } });
      await driver.list(maxCtx, '/d1list/time-num', { filter: { mtime: { max: future } } });
      expect((maxCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['item.txt']);

      const bndCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(bndCtx, '/d1list/time-num', { filter: { mtime: { min: past, max: future } } });
      await driver.list(bndCtx, '/d1list/time-num', { filter: { mtime: { min: past, max: future } } });
      expect((bndCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['item.txt']);

      const outCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(outCtx, '/d1list/time-num', { filter: { mtime: { max: past } } });
      await driver.list(outCtx, '/d1list/time-num', { filter: { mtime: { max: past } } });
      expect((outCtx.result as { entries: FileInfo[] }).entries).toEqual([]);
    });
  });

  it('filters by public visibility and deleted state', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/flags/pub.txt', 'pub', { type: 'text/plain', public: true });
      await driver.write(s1, '/d1list/flags/pub.txt', 'pub', { type: 'text/plain', public: true });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/flags/priv.txt', 'priv', { type: 'text/plain', public: false });
      await driver.write(s2, '/d1list/flags/priv.txt', 'priv', { type: 'text/plain', public: false });

      const s3: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s3, '/d1list/flags/del.txt', 'del', { type: 'text/plain' });
      await soft.write(s3, '/d1list/flags/del.txt', 'del', { type: 'text/plain' });
      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/d1list/flags/del.txt');
      await soft.remove(remCtx, '/d1list/flags/del.txt');

      const pubCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(pubCtx, '/d1list/flags', { filter: { public: true } });
      await driver.list(pubCtx, '/d1list/flags', { filter: { public: true } });
      expect((pubCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['pub.txt']);

      const delCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(delCtx, '/d1list/flags', { all: true, filter: { deleted: true } });
      await soft.list(delCtx, '/d1list/flags', { all: true, filter: { deleted: true } });
      expect((delCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['del.txt']);
    });
  });

  it('filters by private visibility and active non-deleted state explicitly', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const pub: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(pub, '/d1list/explicit-flags/pub.txt', 'pub', { type: 'text/plain', public: true });
      await driver.write(pub, '/d1list/explicit-flags/pub.txt', 'pub', { type: 'text/plain', public: true });

      const priv: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(priv, '/d1list/explicit-flags/priv.txt', 'priv', { type: 'text/plain', public: false });
      await driver.write(priv, '/d1list/explicit-flags/priv.txt', 'priv', { type: 'text/plain', public: false });

      const del: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(del, '/d1list/explicit-flags/del.txt', 'del', { type: 'text/plain' });
      await soft.write(del, '/d1list/explicit-flags/del.txt', 'del', { type: 'text/plain' });
      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/d1list/explicit-flags/del.txt');
      await soft.remove(rem, '/d1list/explicit-flags/del.txt');

      const privCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(privCtx, '/d1list/explicit-flags', { filter: { public: false } });
      await driver.list(privCtx, '/d1list/explicit-flags', { filter: { public: false } });
      expect((privCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['priv.txt']);

      const actCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(actCtx, '/d1list/explicit-flags', { all: true, filter: { deleted: false } });
      await soft.list(actCtx, '/d1list/explicit-flags', { all: true, filter: { deleted: false } });
      const actNames = (actCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(actNames).toContain('pub.txt');
      expect(actNames).toContain('priv.txt');
      expect(actNames).not.toContain('del.txt');
    });
  });

  it('filters hidden files based on all option', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const visible: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(visible, '/d1list/hidden/visible.txt', 'vis', { type: 'text/plain' });
      await driver.write(visible, '/d1list/hidden/visible.txt', 'vis', { type: 'text/plain' });

      const hidden: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(hidden, '/d1list/hidden/secret.txt', 'sec', { type: 'text/plain', hidden: true });
      await driver.write(hidden, '/d1list/hidden/secret.txt', 'sec', { type: 'text/plain', hidden: true });

      const noAllCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(noAllCtx, '/d1list/hidden');
      await driver.list(noAllCtx, '/d1list/hidden');
      expect((noAllCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['visible.txt']);

      const allCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(allCtx, '/d1list/hidden', { all: true });
      await driver.list(allCtx, '/d1list/hidden', { all: true });
      const names = (allCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(names).toContain('visible.txt');
      expect(names).toContain('secret.txt');
    });
  });

  it('lists root directory recursively excluding root path itself', async () => {
    await withFs({ homeDir: '/' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/root-rec/file.txt', 'root test', { type: 'text/plain' });
      await driver.write(s1, '/d1list/root-rec/file.txt', 'root test', { type: 'text/plain' });

      const rootCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(rootCtx, '/', { recursive: true });
      await driver.list(rootCtx, '/', { recursive: true });

      const entries = (rootCtx.result as { entries: FileInfo[] }).entries;
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e) => e.path !== '/')).toBe(true);

      const emptyTargetCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(emptyTargetCtx, '', { recursive: true });
      await driver.list(emptyTargetCtx, '', { recursive: true });
      expect((emptyTargetCtx.result as { entries: FileInfo[] }).entries.length).toBeGreaterThan(0);
    });
  });

  it('sorts across various fields and compound ordering', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/multi/z.json', { z: 1 }, { type: 'application/json' });
      await driver.write(s1, '/d1list/multi/z.json', { z: 1 }, { type: 'application/json' });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/multi/a.txt', 'text content', { type: 'text/plain' });
      await driver.write(s2, '/d1list/multi/a.txt', 'text content', { type: 'text/plain' });

      const typeCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(typeCtx, '/d1list/multi', { sort: 'type' });
      await driver.list(typeCtx, '/d1list/multi', { sort: 'type' });
      expect((typeCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['z.json', 'a.txt']);

      const compCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(compCtx, '/d1list/multi', { sort: ['type', '-size'] });
      await driver.list(compCtx, '/d1list/multi', { sort: ['type', '-size'] });
      expect((compCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['z.json', 'a.txt']);
    });
  });

  it('orders listing by all supported sort fields and handles unknown fallback', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/all-sorts/alpha.txt', '1', {
        type: 'text/plain',
        public: true,
        hidden: false,
      });
      await driver.write(s1, '/d1list/all-sorts/alpha.txt', '1', {
        type: 'text/plain',
        public: true,
        hidden: false,
      });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/all-sorts/beta.json', '12345678', {
        type: 'application/json',
        public: false,
        hidden: true,
      });
      await driver.write(s2, '/d1list/all-sorts/beta.json', '12345678', {
        type: 'application/json',
        public: false,
        hidden: true,
      });

      const nameDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(nameDesc, '/d1list/all-sorts', { all: true, sort: '-name' });
      await driver.list(nameDesc, '/d1list/all-sorts', { all: true, sort: '-name' });
      expect((nameDesc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'beta.json',
        'alpha.txt',
      ]);

      const sizeAsc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(sizeAsc, '/d1list/all-sorts', { all: true, sort: 'size' });
      await driver.list(sizeAsc, '/d1list/all-sorts', { all: true, sort: 'size' });
      expect((sizeAsc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'alpha.txt',
        'beta.json',
      ]);

      const mtimeAsc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(mtimeAsc, '/d1list/all-sorts', { all: true, sort: 'mtime' });
      await driver.list(mtimeAsc, '/d1list/all-sorts', { all: true, sort: 'mtime' });
      expect((mtimeAsc.result as { entries: FileInfo[] }).entries.length).toBe(2);

      const mtimeDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(mtimeDesc, '/d1list/all-sorts', { all: true, sort: '-mtime' });
      await driver.list(mtimeDesc, '/d1list/all-sorts', { all: true, sort: '-mtime' });
      expect((mtimeDesc.result as { entries: FileInfo[] }).entries.length).toBe(2);

      const typeDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(typeDesc, '/d1list/all-sorts', { all: true, sort: '-type' });
      await driver.list(typeDesc, '/d1list/all-sorts', { all: true, sort: '-type' });
      expect((typeDesc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'alpha.txt',
        'beta.json',
      ]);

      const hiddenAsc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(hiddenAsc, '/d1list/all-sorts', { all: true, sort: 'hidden' });
      await driver.list(hiddenAsc, '/d1list/all-sorts', { all: true, sort: 'hidden' });
      expect((hiddenAsc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'alpha.txt',
        'beta.json',
      ]);

      const hiddenDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(hiddenDesc, '/d1list/all-sorts', { all: true, sort: '-hidden' });
      await driver.list(hiddenDesc, '/d1list/all-sorts', { all: true, sort: '-hidden' });
      expect((hiddenDesc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'beta.json',
        'alpha.txt',
      ]);

      const pubAsc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(pubAsc, '/d1list/all-sorts', { all: true, sort: 'public' });
      await driver.list(pubAsc, '/d1list/all-sorts', { all: true, sort: 'public' });
      expect((pubAsc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['beta.json', 'alpha.txt']);

      const pubDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(pubDesc, '/d1list/all-sorts', { all: true, sort: '-public' });
      await driver.list(pubDesc, '/d1list/all-sorts', { all: true, sort: '-public' });
      expect((pubDesc.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'alpha.txt',
        'beta.json',
      ]);

      const delAsc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(delAsc, '/d1list/all-sorts', { trash: true, sort: 'deletedAt' });
      await soft.list(delAsc, '/d1list/all-sorts', { trash: true, sort: 'deletedAt' });
      expect(delAsc.result).toBeDefined();

      const delDesc: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(delDesc, '/d1list/all-sorts', { trash: true, sort: '-deletedAt' });
      await soft.list(delDesc, '/d1list/all-sorts', { trash: true, sort: '-deletedAt' });
      expect(delDesc.result).toBeDefined();

      const fallbackCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(fallbackCtx, '/d1list/all-sorts', { all: true, sort: 'unknown_column' as Sort });
      await driver.list(fallbackCtx, '/d1list/all-sorts', { all: true, sort: 'unknown_column' as Sort });
      expect((fallbackCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'alpha.txt',
        'beta.json',
      ]);
    });
  });

  it('handles pagination boundary where cursor exceeds total rows and limit equals total', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/bounds/p1.txt', '1', { type: 'text/plain' });
      await driver.write(s1, '/d1list/bounds/p1.txt', '1', { type: 'text/plain' });

      const eqCtx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.list(eqCtx, '/d1list/bounds', { limit: 1 });
      await driver.list(eqCtx, '/d1list/bounds', { limit: 1 });
      expect(eqCtx.result?.entries.length).toBe(1);
      expect(eqCtx.result?.nextCursor).toBeUndefined();

      const beyondCursor = Buffer.from('999').toString('base64');
      const beyondCtx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.list(beyondCtx, '/d1list/bounds', { cursor: beyondCursor });
      await driver.list(beyondCtx, '/d1list/bounds', { cursor: beyondCursor });
      expect(beyondCtx.result?.entries.length).toBe(0);
      expect(beyondCtx.result?.nextCursor).toBeUndefined();
    });
  });

  it('falls back gracefully to start when cursor string is malformed', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/multi', { cursor: '%%%invalid-cursor%%%' });
      await driver.list(ctx, '/d1list/multi', { cursor: '%%%invalid-cursor%%%' });

      expect(ctx.result).toBeDefined();
    });
  });

  it('filters by metadata match on the index', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const keyed = new D1Driver(db, { indexableKeys: ['author'] });
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/meta/mine.txt', 'a', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      await keyed.write(s1, '/d1list/meta/mine.txt', 'a', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/meta/yours.txt', 'b', {
        type: 'text/plain',
        metadata: { author: 'bob' },
      });
      await keyed.write(s2, '/d1list/meta/yours.txt', 'b', {
        type: 'text/plain',
        metadata: { author: 'bob' },
      });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/meta', { filter: { metadata: { author: 'alice' } } });
      await keyed.list(ctx, '/d1list/meta', { filter: { metadata: { author: 'alice' } } });

      const names = (ctx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(names).toEqual(['mine.txt']);
    });
  });

  it('distinguishes flat directory listing from recursive tree listing', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/tree/top.txt', 'top', { type: 'text/plain' });
      await driver.write(s1, '/d1list/tree/top.txt', 'top', { type: 'text/plain' });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/tree/nested/inner.txt', 'inner', { type: 'text/plain' });
      await driver.write(s2, '/d1list/tree/nested/inner.txt', 'inner', { type: 'text/plain' });

      const flatCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(flatCtx, '/d1list/tree', { recursive: false });
      await driver.list(flatCtx, '/d1list/tree', { recursive: false });
      expect((flatCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['top.txt']);

      const recCtx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(recCtx, '/d1list/tree', { recursive: true });
      await driver.list(recCtx, '/d1list/tree', { recursive: true });
      const recNames = (recCtx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(recNames).toContain('top.txt');
      expect(recNames).toContain('inner.txt');
    });
  });

  it('sorts descending by file size', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1list/sort/tiny.txt', '1', { type: 'text/plain' });
      await driver.write(s1, '/d1list/sort/tiny.txt', '1', { type: 'text/plain' });
      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1list/sort/huge.txt', '1234567890', { type: 'text/plain' });
      await driver.write(s2, '/d1list/sort/huge.txt', '1234567890', { type: 'text/plain' });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.list(ctx, '/d1list/sort', { sort: '-size' });
      await driver.list(ctx, '/d1list/sort', { sort: '-size' });

      const names = (ctx.result as { entries: FileInfo[] }).entries.map((e) => e.name);
      expect(names).toEqual(['huge.txt', 'tiny.txt']);
    });
  });
});
