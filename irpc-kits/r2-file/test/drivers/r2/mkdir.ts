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
  if (!env.BUCKET) throw new Error('r2/mkdir.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2mkdir/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver mkdir', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2mkdir/docs',
      'r2mkdir/docs/',
      'r2mkdir/public-dir',
      'r2mkdir/meta-dir',
      'r2mkdir/existing',
    ]);
  });

  it('records a directory marker sealing FileInfo', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.mkdir(ctx, '/r2mkdir/docs');
      await driver.mkdir(ctx, '/r2mkdir/docs');

      const result = ctx.result as FileInfo;
      expect(result.path).toBe('/r2mkdir/docs');
      expect(result.isDirectory).toBe(true);
      expect(result.size).toBe(0);
      expect(result.type).toBe('inode/directory');

      const marker = (await bucket.head('r2mkdir/docs')) ?? (await bucket.head('r2mkdir/docs/'));
      expect(marker).not.toBeNull();
      expect(marker?.customMetadata?._fs_type).toBe('inode/directory');
      expect(marker?.customMetadata?._fs_user_id).toBe('alice');
    });
  });

  it('records public directory marker with public flag in customMetadata', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.mkdir(ctx, '/r2mkdir/public-dir', { public: true });
      await driver.mkdir(ctx, '/r2mkdir/public-dir', { public: true });

      expect((ctx.result as FileInfo).public).toBe(true);

      const marker = (await bucket.head('r2mkdir/public-dir')) ?? (await bucket.head('r2mkdir/public-dir/'));
      expect(marker?.customMetadata?._fs_public).toBe('true');
    });
  });

  it('records custom metadata on the directory marker', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.mkdir(ctx, '/r2mkdir/meta-dir', { metadata: { env: 'production', role: 'assets' } });
      await driver.mkdir(ctx, '/r2mkdir/meta-dir', { metadata: { env: 'production', role: 'assets' } });

      const marker = (await bucket.head('r2mkdir/meta-dir')) ?? (await bucket.head('r2mkdir/meta-dir/'));
      expect(marker?.customMetadata?.env).toBe('production');
      expect(marker?.customMetadata?.role).toBe('assets');
    });
  });

  it('registers a rollback handler that deletes the created directory marker', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.mkdir(ctx, '/r2mkdir/rollback-dir');
      await driver.mkdir(ctx, '/r2mkdir/rollback-dir');

      expect(ctx.rollback.size).toBeGreaterThan(0);

      const markerBefore = (await bucket.head('r2mkdir/rollback-dir')) ?? (await bucket.head('r2mkdir/rollback-dir/'));
      expect(markerBefore).not.toBeNull();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      const markerAfter = (await bucket.head('r2mkdir/rollback-dir')) ?? (await bucket.head('r2mkdir/rollback-dir/'));
      expect(markerAfter).toBeNull();
    });
  });

  it('is idempotent when directory marker already exists', async () => {
    await withFs({}, async () => {
      const first: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(first, '/r2mkdir/docs');
      await driver.mkdir(first, '/r2mkdir/docs');

      const second: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(second, '/r2mkdir/docs');
      await driver.mkdir(second, '/r2mkdir/docs');

      expect((second.result as FileInfo).isDirectory).toBe(true);
      expect((second.result as FileInfo).path).toBe('/r2mkdir/docs');
    });
  });

  it('restores a pre-existing entry at the path on mkdir rollback', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2mkdir/existing', 'a file', { type: 'text/plain' });
      await driver.write(seed, '/r2mkdir/existing', 'a file', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(ctx, '/r2mkdir/existing');
      await driver.mkdir(ctx, '/r2mkdir/existing');

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      const restored = await bucket.get('r2mkdir/existing');
      expect(await restored?.text()).toBe('a file');
      expect(restored?.customMetadata?._fs_type).not.toBe('inode/directory');
    });
  });
});
