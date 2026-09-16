import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { expectDenial, withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/copy-move.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2copymove/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver copy and move', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2copymove/s.txt',
      'r2copymove/d.txt',
      'r2copymove/pub-d.txt',
      'r2copymove/m.txt',
      'r2copymove/m-dest.txt',
      'r2copymove/rb-copy.txt',
      'r2copymove/rb-move.txt',
      'r2copymove/rb-move-dest.txt',
      'r2copymove/self.txt',
      'r2copymove/rb-src2.txt',
      'r2copymove/rb-dst2.txt',
      'r2copymove/rb-msrc.txt',
      'r2copymove/rb-mdst.txt',
    ]);
  });

  it('duplicates bytes and metadata preserving the source', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/s.txt', 'copy payload', { type: 'text/plain', metadata: { k: 'v' } });
      await driver.write(seed, '/r2copymove/s.txt', 'copy payload', { type: 'text/plain', metadata: { k: 'v' } });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/r2copymove/s.txt', '/r2copymove/d.txt');
      await driver.copy(ctx, '/r2copymove/s.txt', '/r2copymove/d.txt');

      expect(ctx.result).toBe(true);

      const dest = await bucket.get('r2copymove/d.txt');
      expect(dest).not.toBeNull();
      expect(await dest?.text()).toBe('copy payload');
      expect(dest?.customMetadata?.k).toBe('v');

      const src = await bucket.get('r2copymove/s.txt');
      expect(src).not.toBeNull();
      expect(await src?.text()).toBe('copy payload');
    });
  });

  it('halts copy with ENOENT on missing source', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/r2copymove/ghost.txt', '/r2copymove/d.txt');

      await expectDenial(
        () => {
          return driver.copy(ctx, '/r2copymove/ghost.txt', '/r2copymove/d.txt');
        },
        'ENOENT',
        '/r2copymove/ghost.txt'
      );
    });
  });

  it('updates public flag on destination when requested', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/s.txt', 'data', { public: false });
      await driver.write(seed, '/r2copymove/s.txt', 'data', { public: false });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/r2copymove/s.txt', '/r2copymove/pub-d.txt', { public: true });
      await driver.copy(ctx, '/r2copymove/s.txt', '/r2copymove/pub-d.txt', { public: true });

      const head = await bucket.head('r2copymove/pub-d.txt');
      expect(head?.customMetadata?._fs_public).toBe('true');
    });
  });

  it('registers copy rollback that removes destination object', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/s.txt', 'data');
      await driver.write(seed, '/r2copymove/s.txt', 'data');

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/r2copymove/s.txt', '/r2copymove/rb-copy.txt');
      await driver.copy(ctx, '/r2copymove/s.txt', '/r2copymove/rb-copy.txt');

      expect(await bucket.head('r2copymove/rb-copy.txt')).not.toBeNull();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await bucket.head('r2copymove/rb-copy.txt')).toBeNull();
      expect(await bucket.head('r2copymove/s.txt')).not.toBeNull();
    });
  });

  it('relocates bytes and metadata removing the source', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/m.txt', 'move payload', { type: 'text/plain' });
      await driver.write(seed, '/r2copymove/m.txt', 'move payload', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/r2copymove/m.txt', '/r2copymove/m-dest.txt');
      await driver.move(ctx, '/r2copymove/m.txt', '/r2copymove/m-dest.txt');

      expect(ctx.result).toBe(true);

      const dest = await bucket.get('r2copymove/m-dest.txt');
      expect(dest).not.toBeNull();
      expect(await dest?.text()).toBe('move payload');

      const src = await bucket.head('r2copymove/m.txt');
      expect(src).toBeNull();
    });
  });

  it('halts move with ENOENT on missing source', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/r2copymove/ghost.txt', '/r2copymove/m-dest.txt');

      await expectDenial(
        () => {
          return driver.move(ctx, '/r2copymove/ghost.txt', '/r2copymove/m-dest.txt');
        },
        'ENOENT',
        '/r2copymove/ghost.txt'
      );
    });
  });

  it('registers move rollback that restores source and deletes destination', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/rb-move.txt', 'valuable');
      await driver.write(seed, '/r2copymove/rb-move.txt', 'valuable');

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/r2copymove/rb-move.txt', '/r2copymove/rb-move-dest.txt');
      await driver.move(ctx, '/r2copymove/rb-move.txt', '/r2copymove/rb-move-dest.txt');

      expect(await bucket.head('r2copymove/rb-move.txt')).toBeNull();
      expect(await bucket.head('r2copymove/rb-move-dest.txt')).not.toBeNull();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await bucket.head('r2copymove/rb-move.txt')).not.toBeNull();
      expect(await (await bucket.get('r2copymove/rb-move.txt'))?.text()).toBe('valuable');
      expect(await bucket.head('r2copymove/rb-move-dest.txt')).toBeNull();
    });
  });

  it('acts cooperatively during copy and move without skipping when ctx.result was pre-set', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/s.txt', 'coop bytes');
      await driver.write(seed, '/r2copymove/s.txt', 'coop bytes');

      const copyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(copyCtx, '/r2copymove/s.txt', '/r2copymove/d.txt');
      copyCtx.result = true; // pre-set by upstream D1

      await driver.copy(copyCtx, '/r2copymove/s.txt', '/r2copymove/d.txt');
      expect(await (await bucket.get('r2copymove/d.txt'))?.text()).toBe('coop bytes');
    });
  });

  it('halts copy with ENOENT for a missing canonical source even when ctx.info is set', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      ctx.info = {
        path: '/r2copymove/inlined.txt',
        name: 'inlined.txt',
        size: 12,
        type: 'text/plain',
        mtime: new Date(),
        isDirectory: false,
      };

      await normalize.copy(ctx, '/r2copymove/inlined.txt', '/r2copymove/inlined-dest.txt');

      await expectDenial(
        () => {
          return driver.copy(ctx, '/r2copymove/inlined.txt', '/r2copymove/inlined-dest.txt');
        },
        'ENOENT',
        '/r2copymove/inlined.txt'
      );
      expect(await bucket.head('r2copymove/inlined-dest.txt')).toBeNull();
    });
  });

  it('halts move with ENOENT for a missing canonical source even when ctx.info is set', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      ctx.info = {
        path: '/r2copymove/inlined-move.txt',
        name: 'inlined-move.txt',
        size: 12,
        type: 'text/plain',
        mtime: new Date(),
        isDirectory: false,
      };

      await normalize.move(ctx, '/r2copymove/inlined-move.txt', '/r2copymove/inlined-move-dest.txt');

      await expectDenial(
        () => {
          return driver.move(ctx, '/r2copymove/inlined-move.txt', '/r2copymove/inlined-move-dest.txt');
        },
        'ENOENT',
        '/r2copymove/inlined-move.txt'
      );
      expect(await bucket.head('r2copymove/inlined-move-dest.txt')).toBeNull();
    });
  });

  it('treats a self-move as a no-op that preserves the object', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2copymove/self.txt', 'keep me', { type: 'text/plain' });
      await driver.write(seed, '/r2copymove/self.txt', 'keep me', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      ctx.path = '/r2copymove/self.txt';
      ctx.destination = '/r2copymove/self.txt';
      await driver.move(ctx, '/r2copymove/self.txt', '/r2copymove/self.txt');

      expect(ctx.result).toBe(true);
      expect(ctx.rollback.size).toBe(0);
      expect(await (await bucket.get('r2copymove/self.txt'))?.text()).toBe('keep me');
    });
  });

  it('restores a pre-existing destination on copy rollback', async () => {
    await withFs({}, async () => {
      const srcSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(srcSeed, '/r2copymove/rb-src2.txt', 'new copy', { type: 'text/plain' });
      await driver.write(srcSeed, '/r2copymove/rb-src2.txt', 'new copy', { type: 'text/plain' });

      const dstSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(dstSeed, '/r2copymove/rb-dst2.txt', 'dest original', { type: 'text/plain' });
      await driver.write(dstSeed, '/r2copymove/rb-dst2.txt', 'dest original', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(ctx, '/r2copymove/rb-src2.txt', '/r2copymove/rb-dst2.txt');
      await driver.copy(ctx, '/r2copymove/rb-src2.txt', '/r2copymove/rb-dst2.txt');
      expect(await (await bucket.get('r2copymove/rb-dst2.txt'))?.text()).toBe('new copy');

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await (await bucket.get('r2copymove/rb-dst2.txt'))?.text()).toBe('dest original');
    });
  });

  it('restores source and a pre-existing destination on move rollback', async () => {
    await withFs({}, async () => {
      const srcSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(srcSeed, '/r2copymove/rb-msrc.txt', 'source data', { type: 'text/plain' });
      await driver.write(srcSeed, '/r2copymove/rb-msrc.txt', 'source data', { type: 'text/plain' });

      const dstSeed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(dstSeed, '/r2copymove/rb-mdst.txt', 'dest original', { type: 'text/plain' });
      await driver.write(dstSeed, '/r2copymove/rb-mdst.txt', 'dest original', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(ctx, '/r2copymove/rb-msrc.txt', '/r2copymove/rb-mdst.txt');
      await driver.move(ctx, '/r2copymove/rb-msrc.txt', '/r2copymove/rb-mdst.txt');

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await (await bucket.get('r2copymove/rb-msrc.txt'))?.text()).toBe('source data');
      expect(await (await bucket.get('r2copymove/rb-mdst.txt'))?.text()).toBe('dest original');
    });
  });
});
