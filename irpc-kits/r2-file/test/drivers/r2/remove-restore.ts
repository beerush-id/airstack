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
  if (!env.BUCKET) throw new Error('r2/remove-restore.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2remove/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver remove and restore', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2remove/gone.txt',
      'r2remove/tree/child.txt',
      'r2remove/guarded/child.txt',
      'r2remove/enforced/child.txt',
      'r2remove/soft.txt',
      'r2remove/back.txt',
      'r2remove/rb-soft.txt',
      'r2remove/rb-restore.txt',
      'r2remove/nonempty/child.txt',
      'r2remove/slashed/',
    ]);
  });

  it('purges the object by default', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/gone.txt', 'bye', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/gone.txt', 'bye', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/gone.txt');
      await driver.remove(ctx, '/r2remove/gone.txt');

      expect(ctx.result).toBe(true);
      expect(await bucket.head('r2remove/gone.txt')).toBeNull();
    });
  });

  it('seals false for an absent target', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/ghost.txt');
      await driver.remove(ctx, '/r2remove/ghost.txt');

      expect(ctx.result).toBe(false);
    });
  });

  it('removes a tree recursively', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/tree/child.txt', 'child', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/tree/child.txt', 'child', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/tree', { recursive: true });
      await driver.remove(ctx, '/r2remove/tree', { recursive: true });

      expect(ctx.result).toBe(true);
      expect(await bucket.head('r2remove/tree/child.txt')).toBeNull();
    });
  });

  it('blocks strict removal without enforcement', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const strict = new R2Driver(bucket, { strict: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/guarded/child.txt', 'child', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/guarded/child.txt', 'child', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/guarded', { recursive: true });

      await expectDenial(
        () => {
          return strict.remove(ctx, '/r2remove/guarded', { recursive: true });
        },
        'ENOTEMPTY',
        '/r2remove/guarded'
      );
    });
  });

  it('strict removal still blocks when force: true is passed if enforced is false', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const strict = new R2Driver(bucket, { strict: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/guarded/child.txt', 'child');
      await driver.write(seed, '/r2remove/guarded/child.txt', 'child');

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/guarded', { recursive: true, force: true });

      await expectDenial(
        () => {
          return strict.remove(ctx, '/r2remove/guarded', { recursive: true, force: true });
        },
        'ENOTEMPTY',
        '/r2remove/guarded'
      );
    });
  });

  it('authorizes strict removal under enforcement', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice', enforced: true }, async () => {
      const strict = new R2Driver(bucket, { strict: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/enforced/child.txt', 'child', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/enforced/child.txt', 'child', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/enforced', { recursive: true });
      await strict.remove(ctx, '/r2remove/enforced', { recursive: true });

      expect(ctx.result).toBe(true);
      expect(await bucket.head('r2remove/enforced/child.txt')).toBeNull();
    });
  });

  it('soft-deletes hiding the object from active lookups', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/soft.txt', 'soft', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/soft.txt', 'soft', { type: 'text/plain' });

      const removed: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removed, '/r2remove/soft.txt', {});
      await soft.remove(removed, '/r2remove/soft.txt', {});

      expect(removed.result).toBe(true);

      const marker = await bucket.head('r2remove/soft.txt');
      expect(marker?.customMetadata?._fs_deleted).toBeTruthy();

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/r2remove/soft.txt');
      await driver.stat(stat, '/r2remove/soft.txt');

      expect('result' in stat).toBe(true);
      expect(stat.result).toBeUndefined();
    });
  });

  it('registers rollback for soft delete that clears the deleted timestamp', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/rb-soft.txt', 'valuable');
      await driver.write(seed, '/r2remove/rb-soft.txt', 'valuable');

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/rb-soft.txt');
      await soft.remove(ctx, '/r2remove/rb-soft.txt');

      const headDeleted = await bucket.head('r2remove/rb-soft.txt');
      expect(headDeleted?.customMetadata?._fs_deleted).toBeDefined();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      const headRestored = await bucket.head('r2remove/rb-soft.txt');
      expect(headRestored?.customMetadata?._fs_deleted).toBeUndefined();
    });
  });

  it('restores a soft-deleted object to active state', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/back.txt', 'come back', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/back.txt', 'come back', { type: 'text/plain' });

      const removed: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removed, '/r2remove/back.txt', {});
      await soft.remove(removed, '/r2remove/back.txt', {});

      const restored: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(restored, '/r2remove/back.txt', {});
      await soft.restore(restored, '/r2remove/back.txt', {});

      expect((restored.result as FileInfo).path).toBe('/r2remove/back.txt');

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/r2remove/back.txt');
      await driver.stat(stat, '/r2remove/back.txt');

      expect((stat.result as FileInfo).path).toBe('/r2remove/back.txt');
    });
  });

  it('registers rollback for restore that re-applies soft delete', async () => {
    await withFs({}, async () => {
      const soft = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/rb-restore.txt', 'data');
      await driver.write(seed, '/r2remove/rb-restore.txt', 'data');

      const rem: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rem, '/r2remove/rb-restore.txt');
      await soft.remove(rem, '/r2remove/rb-restore.txt');

      const restored: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(restored, '/r2remove/rb-restore.txt');
      await soft.restore(restored, '/r2remove/rb-restore.txt');

      expect((await bucket.head('r2remove/rb-restore.txt'))?.customMetadata?._fs_deleted).toBeUndefined();

      for (const rollback of Array.from(restored.rollback).reverse()) {
        await rollback();
      }

      expect((await bucket.head('r2remove/rb-restore.txt'))?.customMetadata?._fs_deleted).toBeDefined();
    });
  });

  it('halts restore with ENOENT outside the trash', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(ctx, '/r2remove/never.txt', {});

      await expectDenial(
        () => {
          return driver.restore(ctx, '/r2remove/never.txt', {});
        },
        'ENOENT',
        '/r2remove/never.txt'
      );
    });
  });

  it('rejects non-recursive removal of a non-empty directory with ENOTEMPTY', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2remove/nonempty/child.txt', 'child', { type: 'text/plain' });
      await driver.write(seed, '/r2remove/nonempty/child.txt', 'child', { type: 'text/plain' });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/nonempty');

      await expectDenial(
        () => {
          return driver.remove(ctx, '/r2remove/nonempty');
        },
        'ENOTEMPTY',
        '/r2remove/nonempty'
      );
      expect(await bucket.head('r2remove/nonempty/child.txt')).not.toBeNull();
    });
  });

  it('removes a trailing-slash directory marker by its resolved key', async () => {
    await withFs({}, async () => {
      await bucket.put('r2remove/slashed/', '', { httpMetadata: { contentType: 'inode/directory' } });

      const ctx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(ctx, '/r2remove/slashed');
      await driver.remove(ctx, '/r2remove/slashed');

      expect(ctx.result).toBe(true);
      expect(await bucket.head('r2remove/slashed/')).toBeNull();
    });
  });
});
