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
  if (!env.DB) throw new Error('d1/search.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1search%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1search%').run();
});

describe('D1Driver search operations, filters, and global traversal', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1search%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1search%').run();
  });

  it('searches names scoped to cwd', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const keyed = new D1Driver(db, { indexableKeys: ['author'] });
      const first: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(first, '/d1search/names/quarterly.txt', 'q', { type: 'text/plain' });
      await driver.write(first, '/d1search/names/quarterly.txt', 'q', { type: 'text/plain' });
      const second: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(second, '/d1search/names/essay.txt', 'e', { type: 'text/plain' });
      await driver.write(second, '/d1search/names/essay.txt', 'e', { type: 'text/plain' });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(ctx, 'quarterly', { cwd: '/d1search/names' });
      await keyed.search(ctx, 'quarterly', { cwd: '/d1search/names' });

      expect((ctx.result as { entries: FileInfo[] }).entries.map((entry) => entry.name)).toEqual(['quarterly.txt']);
    });
  });

  it('searches metadata values matching indexable keys', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const keyed = new D1Driver(db, { indexableKeys: ['tag'] });
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1search/meta/report.txt', 'content', {
        type: 'text/plain',
        metadata: { tag: 'urgent' },
      });
      await keyed.write(s1, '/d1search/meta/report.txt', 'content', {
        type: 'text/plain',
        metadata: { tag: 'urgent' },
      });

      const ctx: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(ctx, 'urgent', { cwd: '/d1search/meta' });
      await keyed.search(ctx, 'urgent', { cwd: '/d1search/meta' });

      expect((ctx.result as { entries: FileInfo[] }).entries.map((entry) => entry.name)).toEqual(['report.txt']);
    });
  });

  it('paginates search results with nextCursor continuation', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1search/page/one.txt', '1', { type: 'text/plain' });
      await driver.write(s1, '/d1search/page/one.txt', '1', { type: 'text/plain' });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1search/page/two.txt', '2', { type: 'text/plain' });
      await driver.write(s2, '/d1search/page/two.txt', '2', { type: 'text/plain' });

      const p1Ctx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.search(p1Ctx, 'o', { cwd: '/d1search/page', limit: 1 });
      await driver.search(p1Ctx, 'o', { cwd: '/d1search/page', limit: 1 });

      const page1 = p1Ctx.result as { entries: FileInfo[]; nextCursor?: string };
      expect(page1.entries.length).toBe(1);
      expect(page1.nextCursor).toBeDefined();

      const p2Ctx: DriverContext<{ entries: FileInfo[]; nextCursor?: string }> = createDriverCtx();
      await normalize.search(p2Ctx, 'o', { cwd: '/d1search/page', limit: 1, cursor: page1.nextCursor });
      await driver.search(p2Ctx, 'o', { cwd: '/d1search/page', limit: 1, cursor: page1.nextCursor });

      const page2 = p2Ctx.result as { entries: FileInfo[]; nextCursor?: string };
      expect(page2.entries.length).toBe(1);
      expect(page2.entries[0].name).not.toBe(page1.entries[0].name);
    });
  });

  it('searches globally from root and applies search filters and sorting', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true, indexableKeys: ['tag'] });

      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/d1search/deep/match-one.txt', 'sample 1', {
        type: 'text/plain',
        public: true,
        metadata: { tag: 'special' },
      });
      await driver.write(s1, '/d1search/deep/match-one.txt', 'sample 1', {
        type: 'text/plain',
        public: true,
        metadata: { tag: 'special' },
      });

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/d1search/other/match-two.json', '{"sample": 2}', {
        type: 'application/json',
        public: false,
        hidden: true,
        metadata: { tag: 'special' },
      });
      await driver.write(s2, '/d1search/other/match-two.json', '{"sample": 2}', {
        type: 'application/json',
        public: false,
        hidden: true,
        metadata: { tag: 'special' },
      });

      const rootSearch: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(rootSearch, 'match', { cwd: '/' });
      await driver.search(rootSearch, 'match', { cwd: '/' });
      expect((rootSearch.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['match-one.txt']);

      const typeFilter: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(typeFilter, 'match', { cwd: '/', all: true, filter: { type: 'application/json' } });
      await driver.search(typeFilter, 'match', { cwd: '/', all: true, filter: { type: 'application/json' } });
      expect((typeFilter.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['match-two.json']);

      const sortSearch: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(sortSearch, 'match', { cwd: '/', all: true, sort: '-name' });
      await driver.search(sortSearch, 'match', { cwd: '/', all: true, sort: '-name' });
      expect((sortSearch.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual([
        'match-two.json',
        'match-one.txt',
      ]);

      const hiddenSearch: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(hiddenSearch, 'match-two', { cwd: '/', all: true });
      await driver.search(hiddenSearch, 'match-two', { cwd: '/', all: true });
      expect((hiddenSearch.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['match-two.json']);

      const delSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(delSeed, '/d1search/deep/match-del.txt', 'content', { type: 'text/plain' });
      await soft.write(delSeed, '/d1search/deep/match-del.txt', 'content', { type: 'text/plain' });
      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/d1search/deep/match-del.txt');
      await soft.remove(remCtx, '/d1search/deep/match-del.txt');

      const trashSearch: DriverContext<{ entries: FileInfo[] }> = createDriverCtx();
      await normalize.search(trashSearch, 'match-del', { cwd: '/', trash: true });
      await soft.search(trashSearch, 'match-del', { cwd: '/', trash: true });
      expect((trashSearch.result as { entries: FileInfo[] }).entries.map((e) => e.name)).toEqual(['match-del.txt']);
    });
  });
});
