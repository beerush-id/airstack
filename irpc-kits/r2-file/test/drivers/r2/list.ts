import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo, ListResult } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/list.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2list/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver list', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    const listed = await bucket.list({ prefix: 'r2list/' });
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((obj) => obj.key));
    }
  });

  it('lists immediate children without descending (flat listing)', async () => {
    await withFs({}, async () => {
      const f1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f1, '/r2list/flat/one.txt', '1', { type: 'text/plain' });
      await driver.write(f1, '/r2list/flat/one.txt', '1', { type: 'text/plain' });

      const f2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f2, '/r2list/flat/nested/deep.txt', '3', { type: 'text/plain' });
      await driver.write(f2, '/r2list/flat/nested/deep.txt', '3', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/flat');
      await driver.list(ctx, '/r2list/flat');

      expect('result' in ctx).toBe(true);
      const names = (ctx.result as ListResult).entries.map((e) => e.name);
      expect(names).toContain('one.txt');
      expect(names).not.toContain('deep.txt');

      // Immediate nested directory should appear as a directory entry
      const nestedDir = (ctx.result as ListResult).entries.find((e) => e.name === 'nested');
      if (nestedDir) {
        expect(nestedDir.isDirectory).toBe(true);
      }
    });
  });

  it('lists descendants recursively', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2list/tree/nested/deep.txt', 'deep', { type: 'text/plain' });
      await driver.write(seed, '/r2list/tree/nested/deep.txt', 'deep', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/tree', { recursive: true });
      await driver.list(ctx, '/r2list/tree', { recursive: true });

      const paths = (ctx.result as ListResult).entries.map((e) => e.path);
      expect(paths).toContain('/r2list/tree/nested/deep.txt');
    });
  });

  it('filters out the directory marker itself from its own listing', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/r2list/selfdir');
      await driver.mkdir(dirCtx, '/r2list/selfdir');

      const fileCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(fileCtx, '/r2list/selfdir/child.txt', 'child');
      await driver.write(fileCtx, '/r2list/selfdir/child.txt', 'child');

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/selfdir');
      await driver.list(ctx, '/r2list/selfdir');

      const paths = (ctx.result as ListResult).entries.map((e) => e.path);
      expect(paths).toContain('/r2list/selfdir/child.txt');
      expect(paths).not.toContain('/r2list/selfdir');
    });
  });

  it('seals an empty result for an empty directory or prefix', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/void');
      await driver.list(ctx, '/r2list/void');

      expect('result' in ctx).toBe(true);
      expect((ctx.result as ListResult).entries).toEqual([]);
    });
  });

  it('paginates with limit and cursor', async () => {
    await withFs({}, async () => {
      for (const name of ['a.txt', 'b.txt', 'c.txt']) {
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, `/r2list/paged/${name}`, name, { type: 'text/plain' });
        await driver.write(seed, `/r2list/paged/${name}`, name, { type: 'text/plain' });
      }

      const first: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(first, '/r2list/paged', { limit: 2, sort: 'name' });
      await driver.list(first, '/r2list/paged', { limit: 2, sort: 'name' });

      const page1 = first.result as ListResult;
      expect(page1.entries.length).toBe(2);
      expect(page1.entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
      expect(page1.nextCursor).toBeDefined();

      const second: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(second, '/r2list/paged', { limit: 2, cursor: page1.nextCursor, sort: 'name' });
      await driver.list(second, '/r2list/paged', { limit: 2, cursor: page1.nextCursor, sort: 'name' });

      const page2 = second.result as ListResult;
      expect(page2.entries.map((e) => e.name)).toEqual(['c.txt']);
    });
  });

  it('sorts entries by name ascending and descending', async () => {
    await withFs({}, async () => {
      for (const name of ['alpha.txt', 'beta.txt', 'gamma.txt']) {
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, `/r2list/sorted/${name}`, name);
        await driver.write(seed, `/r2list/sorted/${name}`, name);
      }

      const asc: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(asc, '/r2list/sorted', { sort: 'name' });
      await driver.list(asc, '/r2list/sorted', { sort: 'name' });
      expect((asc.result as ListResult).entries.map((e) => e.name)).toEqual(['alpha.txt', 'beta.txt', 'gamma.txt']);

      const desc: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(desc, '/r2list/sorted', { sort: '-name' });
      await driver.list(desc, '/r2list/sorted', { sort: '-name' });
      expect((desc.result as ListResult).entries.map((e) => e.name)).toEqual(['gamma.txt', 'beta.txt', 'alpha.txt']);
    });
  });

  it('filters hidden files unless options.all is true', async () => {
    await withFs({}, async () => {
      const visible: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(visible, '/r2list/hidden-test/vis.txt', 'vis');
      await driver.write(visible, '/r2list/hidden-test/vis.txt', 'vis');

      const hidden: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(hidden, '/r2list/hidden-test/.dotfile', 'dot');
      await driver.write(hidden, '/r2list/hidden-test/.dotfile', 'dot');

      const normalList: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(normalList, '/r2list/hidden-test');
      await driver.list(normalList, '/r2list/hidden-test');
      expect((normalList.result as ListResult).entries.map((e) => e.name)).not.toContain('.dotfile');

      const allList: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(allList, '/r2list/hidden-test', { all: true });
      await driver.list(allList, '/r2list/hidden-test', { all: true });
      expect((allList.result as ListResult).entries.map((e) => e.name)).toContain('.dotfile');
    });
  });

  it('filters soft-deleted files unless options.trash is true', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2list/trash-test/soft.txt', 'soft');
      await softDriver.write(seed, '/r2list/trash-test/soft.txt', 'soft');

      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2list/trash-test/soft.txt');
      await softDriver.remove(rem, '/r2list/trash-test/soft.txt');

      const normalList: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(normalList, '/r2list/trash-test');
      await softDriver.list(normalList, '/r2list/trash-test');
      expect((normalList.result as ListResult).entries.map((e) => e.name)).not.toContain('soft.txt');

      const trashList: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(trashList, '/r2list/trash-test', { trash: true });
      await softDriver.list(trashList, '/r2list/trash-test', { trash: true });
      expect((trashList.result as ListResult).entries.map((e) => e.name)).toContain('soft.txt');
    });
  });

  it('skips listing if upstream driver already populated result (gating check)', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/upstream');

      // Upstream D1 index resolved
      ctx.result = {
        entries: [
          {
            path: '/r2list/upstream/fake.txt',
            name: 'fake.txt',
            size: 1,
            type: 'text/plain',
            mtime: new Date(),
            isDirectory: false,
          },
        ],
      };

      await driver.list(ctx, '/r2list/upstream');
      expect(ctx.result.entries.length).toBe(1);
      expect(ctx.result.entries[0].name).toBe('fake.txt');
    });
  });

  it('honors filter.type with an exact MIME match', async () => {
    await withFs({}, async () => {
      for (const [name, type] of [
        ['a.txt', 'text/plain'],
        ['b.json', 'application/json'],
      ] as const) {
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, `/r2list/ftype/${name}`, 'x', { type });
        await driver.write(seed, `/r2list/ftype/${name}`, 'x', { type });
      }

      // A subdirectory surfaces as a delimited prefix whose type is filtered out below.
      const nested: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(nested, '/r2list/ftype/sub/nested.txt', 'x', { type: 'text/plain' });
      await driver.write(nested, '/r2list/ftype/sub/nested.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/ftype', { filter: { type: 'application/json' } });
      await driver.list(ctx, '/r2list/ftype', { filter: { type: 'application/json' } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['b.json']);
    });
  });

  it('honors filter.public', async () => {
    await withFs({}, async () => {
      const pub: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(pub, '/r2list/fpublic/open.txt', 'x', { type: 'text/plain', public: true });
      await driver.write(pub, '/r2list/fpublic/open.txt', 'x', { type: 'text/plain', public: true });
      const priv: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(priv, '/r2list/fpublic/closed.txt', 'x', { type: 'text/plain' });
      await driver.write(priv, '/r2list/fpublic/closed.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/fpublic', { filter: { public: true } });
      await driver.list(ctx, '/r2list/fpublic', { filter: { public: true } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['open.txt']);
    });
  });

  it('honors filter.size range', async () => {
    await withFs({}, async () => {
      const small: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(small, '/r2list/fsize/small.txt', 'x', { type: 'text/plain' });
      await driver.write(small, '/r2list/fsize/small.txt', 'x', { type: 'text/plain' });
      const big: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(big, '/r2list/fsize/big.txt', 'x'.repeat(100), { type: 'text/plain' });
      await driver.write(big, '/r2list/fsize/big.txt', 'x'.repeat(100), { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/fsize', { filter: { size: { min: 10 } } });
      await driver.list(ctx, '/r2list/fsize', { filter: { size: { min: 10 } } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['big.txt']);
    });
  });

  it('honors filter.metadata key/value match', async () => {
    await withFs({}, async () => {
      const tagged: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tagged, '/r2list/fmeta/tagged.txt', 'x', { type: 'text/plain', metadata: { tag: 'keep' } });
      await driver.write(tagged, '/r2list/fmeta/tagged.txt', 'x', { type: 'text/plain', metadata: { tag: 'keep' } });
      const plain: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(plain, '/r2list/fmeta/plain.txt', 'x', { type: 'text/plain' });
      await driver.write(plain, '/r2list/fmeta/plain.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/fmeta', { filter: { metadata: { tag: 'keep' } } });
      await driver.list(ctx, '/r2list/fmeta', { filter: { metadata: { tag: 'keep' } } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['tagged.txt']);
    });
  });

  it('honors filter.mtime range', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2list/fmtime/now.txt', 'x', { type: 'text/plain' });
      await driver.write(seed, '/r2list/fmtime/now.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      const future = Date.now() + 100_000;
      await normalize.list(ctx, '/r2list/fmtime', { filter: { mtime: { min: future } } });
      await driver.list(ctx, '/r2list/fmtime', { filter: { mtime: { min: future } } });
      expect((ctx.result as ListResult).entries).toEqual([]);
    });
  });

  it('over-fetches past filtered-out entries to satisfy limit', async () => {
    await withFs({}, async () => {
      for (const name of ['.h1', '.h2', 'a.txt', 'b.txt']) {
        const seed: DriverContext<FileInfo> = createDriverCtx();
        await normalize.write(seed, `/r2list/overfetch/${name}`, 'x', { type: 'text/plain' });
        await driver.write(seed, `/r2list/overfetch/${name}`, 'x', { type: 'text/plain' });
      }

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/overfetch', { limit: 2, sort: 'name' });
      await driver.list(ctx, '/r2list/overfetch', { limit: 2, sort: 'name' });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
    });
  });

  it('honors filter.size max bound', async () => {
    await withFs({}, async () => {
      const small: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(small, '/r2list/fsizemax/small.txt', 'x', { type: 'text/plain' });
      await driver.write(small, '/r2list/fsizemax/small.txt', 'x', { type: 'text/plain' });
      const big: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(big, '/r2list/fsizemax/big.txt', 'x'.repeat(100), { type: 'text/plain' });
      await driver.write(big, '/r2list/fsizemax/big.txt', 'x'.repeat(100), { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/fsizemax', { filter: { size: { max: 10 } } });
      await driver.list(ctx, '/r2list/fsizemax', { filter: { size: { max: 10 } } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['small.txt']);
    });
  });

  it('honors inclusive filter.mtime Date bounds', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2list/fmtimedate/now.txt', 'x', { type: 'text/plain' });
      await driver.write(seed, '/r2list/fmtimedate/now.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      const bounds = { min: new Date(Date.now() - 100_000), max: new Date(Date.now() + 100_000) };
      await normalize.list(ctx, '/r2list/fmtimedate', { filter: { mtime: bounds } });
      await driver.list(ctx, '/r2list/fmtimedate', { filter: { mtime: bounds } });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['now.txt']);
    });
  });

  it('excludes entries newer than filter.mtime max', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2list/fmtimemax/now.txt', 'x', { type: 'text/plain' });
      await driver.write(seed, '/r2list/fmtimemax/now.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/fmtimemax', { filter: { mtime: { max: Date.now() - 100_000 } } });
      await driver.list(ctx, '/r2list/fmtimemax', { filter: { mtime: { max: Date.now() - 100_000 } } });
      expect((ctx.result as ListResult).entries).toEqual([]);
    });
  });

  it('honors filter.deleted true and false explicitly', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const live: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(live, '/r2list/fdeleted/live.txt', 'x', { type: 'text/plain' });
      await soft.write(live, '/r2list/fdeleted/live.txt', 'x', { type: 'text/plain' });
      const gone: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(gone, '/r2list/fdeleted/gone.txt', 'x', { type: 'text/plain' });
      await soft.write(gone, '/r2list/fdeleted/gone.txt', 'x', { type: 'text/plain' });
      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2list/fdeleted/gone.txt');
      await soft.remove(rem, '/r2list/fdeleted/gone.txt');

      const onlyDeleted: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(onlyDeleted, '/r2list/fdeleted', { filter: { deleted: true } });
      await soft.list(onlyDeleted, '/r2list/fdeleted', { filter: { deleted: true } });
      expect((onlyDeleted.result as ListResult).entries.map((e) => e.name)).toEqual(['gone.txt']);

      const onlyActive: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(onlyActive, '/r2list/fdeleted', { filter: { deleted: false } });
      await soft.list(onlyActive, '/r2list/fdeleted', { filter: { deleted: false } });
      expect((onlyActive.result as ListResult).entries.map((e) => e.name)).toEqual(['live.txt']);
    });
  });

  it('shows only deleted entries under trash when an active sibling exists', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const live: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(live, '/r2list/trashactive/live.txt', 'x', { type: 'text/plain' });
      await soft.write(live, '/r2list/trashactive/live.txt', 'x', { type: 'text/plain' });
      const gone: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(gone, '/r2list/trashactive/gone.txt', 'x', { type: 'text/plain' });
      await soft.write(gone, '/r2list/trashactive/gone.txt', 'x', { type: 'text/plain' });
      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2list/trashactive/gone.txt');
      await soft.remove(rem, '/r2list/trashactive/gone.txt');

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/trashactive', { trash: true });
      await soft.list(ctx, '/r2list/trashactive', { trash: true });
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['gone.txt']);
    });
  });

  it('over-fetches across truncated R2 pages until the prefix is exhausted', async () => {
    await withFs({}, async () => {
      let call = 0;
      const shape = (key: string, etag: string) => ({
        key,
        size: 1,
        uploaded: new Date(),
        etag,
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { author: 'bob' },
      });
      const pagedBucket = {
        head: (k: string) => bucket.head(k),
        get: (k: string, o?: never) => bucket.get(k, o),
        put: (k: string, v: never, o?: never) => bucket.put(k, v, o),
        delete: (k: string | string[]) => bucket.delete(k),
        list: async () => {
          call++;
          return call === 1
            ? { objects: [shape('r2list/pg/a.txt', '1')], delimitedPrefixes: [], truncated: true, cursor: 'c1' }
            : { objects: [shape('r2list/pg/b.txt', '2')], delimitedPrefixes: [], truncated: false };
        },
      } as unknown as R2Bucket;

      const pDriver = new R2Driver(pagedBucket);
      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(ctx, '/r2list/pg');
      await pDriver.list(ctx, '/r2list/pg');
      expect((ctx.result as ListResult).entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
      expect(call).toBe(2);
    });
  });
});
