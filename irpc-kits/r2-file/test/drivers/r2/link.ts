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
  if (!env.BUCKET) throw new Error('r2/link.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2link/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver link', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2link/target.txt',
      'r2link/alias.txt',
      'r2link/pub-alias.txt',
      'r2link/meta-alias.txt',
      'r2link/rb-alias.txt',
      'r2link/rb-existing.txt',
    ]);
  });

  it('records the alias marker with symlink metadata', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2link/target.txt', 'target content');
      await driver.write(seed, '/r2link/target.txt', 'target content');

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/alias.txt');
      await driver.link(ctx, '/r2link/target.txt', '/r2link/alias.txt');

      expect((ctx.result as FileInfo).link).toBe('/r2link/target.txt');
      expect((ctx.result as FileInfo).type).toBe('inode/symlink');
      expect((ctx.result as FileInfo).isDirectory).toBe(false);

      const marker = await bucket.head('r2link/alias.txt');
      expect(marker).not.toBeNull();
      expect(marker?.customMetadata?._fs_link).toBe('/r2link/target.txt');
      expect(marker?.customMetadata?._fs_type).toBe('inode/symlink');
    });
  });

  it('stamps public flag on the link marker when requested', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/pub-alias.txt', { public: true });
      await driver.link(ctx, '/r2link/target.txt', '/r2link/pub-alias.txt', { public: true });

      const marker = await bucket.head('r2link/pub-alias.txt');
      expect(marker?.customMetadata?._fs_public).toBe('true');
    });
  });

  it('stamps custom metadata on the link marker', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/meta-alias.txt', { metadata: { tag: 'sym' } });
      await driver.link(ctx, '/r2link/target.txt', '/r2link/meta-alias.txt', { metadata: { tag: 'sym' } });

      const marker = await bucket.head('r2link/meta-alias.txt');
      expect(marker?.customMetadata?.tag).toBe('sym');
    });
  });

  it('registers link rollback that removes alias marker on failure', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/rb-alias.txt');
      await driver.link(ctx, '/r2link/target.txt', '/r2link/rb-alias.txt');

      expect(await bucket.head('r2link/rb-alias.txt')).not.toBeNull();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await bucket.head('r2link/rb-alias.txt')).toBeNull();
    });
  });

  it('acts cooperatively without skipping when ctx.result was pre-set upstream', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/alias.txt');

      // Pre-set result as if an upstream driver already ran
      ctx.result = {
        path: '/r2link/alias.txt',
        name: 'alias.txt',
        size: 0,
        type: 'inode/symlink',
        mtime: new Date(),
        isDirectory: false,
        link: '/r2link/target.txt',
      };

      await driver.link(ctx, '/r2link/target.txt', '/r2link/alias.txt');

      const marker = await bucket.head('r2link/alias.txt');
      expect(marker).not.toBeNull();
      expect(marker?.customMetadata?._fs_link).toBe('/r2link/target.txt');
    });
  });

  it('restores a pre-existing file at the alias path on link rollback', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2link/rb-existing.txt', 'existing file', { type: 'text/plain' });
      await driver.write(seed, '/r2link/rb-existing.txt', 'existing file', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2link/target.txt', '/r2link/rb-existing.txt');
      await driver.link(ctx, '/r2link/target.txt', '/r2link/rb-existing.txt');

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      const restored = await bucket.get('r2link/rb-existing.txt');
      expect(await restored?.text()).toBe('existing file');
      expect(restored?.customMetadata?._fs_link).toBeUndefined();
    });
  });
});
