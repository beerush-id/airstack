import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/stat.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2stat/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver stat and exists', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2stat/file.txt',
      'r2stat/dir',
      'r2stat/dir/',
      'r2stat/symlink.txt',
      'r2stat/public.txt',
      'r2stat/hidden.txt',
      'r2stat/soft.txt',
      'r2stat/unindexed.txt',
      'r2stat/link-target.txt',
      'r2stat/resolved-link.txt',
      'r2stat/trashed-target.txt',
      'r2stat/trashed-link.txt',
    ]);
  });

  it('stats an existing file with full FileInfo metadata', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2stat/file.txt', 'hello stat', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      await driver.write(seed, '/r2stat/file.txt', 'hello stat', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });

      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/file.txt');
      await driver.stat(ctx, '/r2stat/file.txt');

      expect('result' in ctx).toBe(true);
      const info = ctx.result as FileInfo;
      expect(info.path).toBe('/r2stat/file.txt');
      expect(info.name).toBe('file.txt');
      expect(info.size).toBe(10);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
      expect(info.mtime).toBeInstanceOf(Date);
      expect(info.etag).toBeDefined();
      expect(info.metadata?.author).toBe('alice');
    });
  });

  it('stats a directory marker with isDirectory: true and size: 0', async () => {
    await withFs({}, async () => {
      const mkdirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mkdirCtx, '/r2stat/dir');
      await driver.mkdir(mkdirCtx, '/r2stat/dir');

      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/dir');
      await driver.stat(ctx, '/r2stat/dir');

      expect('result' in ctx).toBe(true);
      const info = ctx.result as FileInfo;
      expect(info.path).toBe('/r2stat/dir');
      expect(info.isDirectory).toBe(true);
      expect(info.size).toBe(0);
    });
  });

  it('seals undefined for absent path stat', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/ghost.txt');
      await driver.stat(ctx, '/r2stat/ghost.txt');

      expect('result' in ctx).toBe(true);
      expect(ctx.result).toBeUndefined();
    });
  });

  it('confirms file and directory exist with exists()', async () => {
    await withFs({}, async () => {
      const writeCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(writeCtx, '/r2stat/file.txt', 'x');
      await driver.write(writeCtx, '/r2stat/file.txt', 'x');

      const mkdirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mkdirCtx, '/r2stat/dir');
      await driver.mkdir(mkdirCtx, '/r2stat/dir');

      const fileExists: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(fileExists, '/r2stat/file.txt');
      await driver.exists(fileExists, '/r2stat/file.txt');
      expect(fileExists.result).toBe(true);

      const dirExists: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(dirExists, '/r2stat/dir');
      await driver.exists(dirExists, '/r2stat/dir');
      expect(dirExists.result).toBe(true);

      const ghostExists: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(ghostExists, '/r2stat/ghost.txt');
      await driver.exists(ghostExists, '/r2stat/ghost.txt');
      expect(ghostExists.result).toBe(false);
    });
  });

  it('resolves symlink target in stat', async () => {
    await withFs({}, async () => {
      const linkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(linkCtx, '/r2stat/target.txt', '/r2stat/symlink.txt');
      await driver.link(linkCtx, '/r2stat/target.txt', '/r2stat/symlink.txt');

      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/symlink.txt');
      await driver.stat(ctx, '/r2stat/symlink.txt');

      expect('result' in ctx).toBe(true);
      const info = ctx.result as FileInfo;
      expect(info.link).toBe('/r2stat/target.txt');
      expect(info.type).toBe('inode/symlink');
    });
  });

  it('reflects public and hidden flags in stat', async () => {
    await withFs({}, async () => {
      const pubCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(pubCtx, '/r2stat/public.txt', 'pub', { public: true });
      await driver.write(pubCtx, '/r2stat/public.txt', 'pub', { public: true });

      const pubStat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(pubStat, '/r2stat/public.txt');
      await driver.stat(pubStat, '/r2stat/public.txt');
      expect((pubStat.result as FileInfo).public).toBe(true);

      const hidCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(hidCtx, '/r2stat/hidden.txt', 'hid', { hidden: true });
      await driver.write(hidCtx, '/r2stat/hidden.txt', 'hid', { hidden: true });

      const hidStat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(hidStat, '/r2stat/hidden.txt');
      await driver.stat(hidStat, '/r2stat/hidden.txt');
      expect((hidStat.result as FileInfo).hidden).toBe(true);
    });
  });

  it('hides soft-deleted files unless options.trash is true', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2stat/soft.txt', 'soft');
      await softDriver.write(seed, '/r2stat/soft.txt', 'soft');

      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2stat/soft.txt');
      await softDriver.remove(rem, '/r2stat/soft.txt');

      // Without trash:
      const statNormal: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statNormal, '/r2stat/soft.txt');
      await softDriver.stat(statNormal, '/r2stat/soft.txt');
      expect(statNormal.result).toBeUndefined();

      const existsNormal: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(existsNormal, '/r2stat/soft.txt');
      await softDriver.exists(existsNormal, '/r2stat/soft.txt');
      expect(existsNormal.result).toBe(false);

      // With trash:
      const statTrash: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statTrash, '/r2stat/soft.txt', { trash: true } as any);
      await softDriver.stat(statTrash, '/r2stat/soft.txt', { trash: true } as any);
      expect(statTrash.result).toBeDefined();
      expect((statTrash.result as FileInfo).deletedAt).toBeInstanceOf(Date);

      const existsTrash: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(existsTrash, '/r2stat/soft.txt', { trash: true } as any);
      await softDriver.exists(existsTrash, '/r2stat/soft.txt', { trash: true } as any);
      expect(existsTrash.result).toBe(true);
    });
  });

  it('skips stat and exists when upstream already resolved (gating check)', async () => {
    await withFs({}, async () => {
      const statCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statCtx, '/r2stat/upstream.txt');
      statCtx.result = {
        path: '/r2stat/upstream.txt',
        name: 'upstream.txt',
        size: 99,
        type: 'text/plain',
        mtime: new Date(),
        isDirectory: false,
      };

      await driver.stat(statCtx, '/r2stat/upstream.txt');
      expect(statCtx.result?.size).toBe(99);

      const existsCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(existsCtx, '/r2stat/upstream.txt');
      existsCtx.result = true;

      await driver.exists(existsCtx, '/r2stat/upstream.txt');
      expect(existsCtx.result).toBe(true);
    });
  });

  it('re-checks canonical storage when upstream sealed exists as false', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2stat/unindexed.txt', 'x', { type: 'text/plain' });
      await driver.write(seed, '/r2stat/unindexed.txt', 'x', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(ctx, '/r2stat/unindexed.txt');
      ctx.result = false;
      await driver.exists(ctx, '/r2stat/unindexed.txt');

      expect(ctx.result).toBe(true);
    });
  });

  it('resolves the target live metadata in stat when the symlink target exists', async () => {
    await withFs({}, async () => {
      const tgt: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tgt, '/r2stat/link-target.txt', 'target body', {
        type: 'text/plain',
        metadata: { kind: 'doc' },
      });
      await driver.write(tgt, '/r2stat/link-target.txt', 'target body', {
        type: 'text/plain',
        metadata: { kind: 'doc' },
      });

      const linkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(linkCtx, '/r2stat/link-target.txt', '/r2stat/resolved-link.txt');
      await driver.link(linkCtx, '/r2stat/link-target.txt', '/r2stat/resolved-link.txt');

      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/resolved-link.txt');
      await driver.stat(ctx, '/r2stat/resolved-link.txt');

      const info = ctx.result as FileInfo;
      expect(info.path).toBe('/r2stat/resolved-link.txt');
      expect(info.link).toBe('/r2stat/link-target.txt');
      expect(info.size).toBe(11);
      expect(info.type).toBe('text/plain');
      expect(info.metadata?.kind).toBe('doc');
    });
  });

  it('falls back to the alias marker in stat when the symlink target is trashed', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const tgt: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tgt, '/r2stat/trashed-target.txt', 'body', { type: 'text/plain' });
      await soft.write(tgt, '/r2stat/trashed-target.txt', 'body', { type: 'text/plain' });

      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2stat/trashed-target.txt');
      await soft.remove(rem, '/r2stat/trashed-target.txt');

      const linkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(linkCtx, '/r2stat/trashed-target.txt', '/r2stat/trashed-link.txt');
      await driver.link(linkCtx, '/r2stat/trashed-target.txt', '/r2stat/trashed-link.txt');

      const ctx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(ctx, '/r2stat/trashed-link.txt');
      await driver.stat(ctx, '/r2stat/trashed-link.txt');

      const info = ctx.result as FileInfo;
      expect(info.link).toBe('/r2stat/trashed-target.txt');
      expect(info.type).toBe('inode/symlink');
      expect(info.size).toBe(0);
    });
  });
});
