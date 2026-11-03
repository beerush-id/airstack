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
  if (!env.BUCKET) throw new Error('r2/base.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2base/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver identity and contract', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete(['r2base/identity/direct.txt']);
  });

  it('exposes every lifecycle operation', () => {
    expect(typeof driver.mkdir).toBe('function');
    expect(typeof driver.write).toBe('function');
    expect(typeof driver.read).toBe('function');
    expect(typeof driver.stat).toBe('function');
    expect(typeof driver.exists).toBe('function');
    expect(typeof driver.list).toBe('function');
    expect(typeof driver.search).toBe('function');
    expect(typeof driver.copy).toBe('function');
    expect(typeof driver.move).toBe('function');
    expect(typeof driver.link).toBe('function');
    expect(typeof driver.remove).toBe('function');
    expect(typeof driver.restore).toBe('function');
  });

  it('leaves accessRules gating to the pipeline head', async () => {
    const ctx: DriverContext<FileInfo> = createDriverCtx();

    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      return normalize.write(ctx, '/r2base/identity/direct.txt', 'x', { type: 'text/plain' });
    });
    await withFs(
      { ownerId: 'alice', homeDir: '/users/alice', accessRules: [{ path: '/elsewhere/**', allow: ['write'] }] },
      async () => {
        return driver.write(ctx, '/r2base/identity/direct.txt', 'x', { type: 'text/plain' });
      }
    );

    expect('result' in ctx).toBe(true);
  });

  it('rejects paths outside accessRules at the pipeline head', async () => {
    await withFs(
      { ownerId: 'alice', homeDir: '/users/alice', accessRules: [{ path: '/teams/**', allow: ['write'] }] },
      async () => {
        const ctx: DriverContext<FileInfo> = createDriverCtx();

        await expectDenial(
          () => {
            return normalize.write(ctx, '/r2base/denied/a.txt', 'x', { type: 'text/plain' });
          },
          'EACCES',
          '/r2base/denied/a.txt'
        );

        expect('result' in ctx).toBe(false);
      }
    );
  });

  it('keeps mount partitions isolated on shared storage', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const acme = new NormalizerDriver({ mountPoint: '/tenants/acme' });
      const globex = new NormalizerDriver({ mountPoint: '/tenants/globex' });

      const first: DriverContext<FileInfo> = createDriverCtx();
      await acme.write(first, '/r2base/iso/shared.txt', 'acme bytes', { type: 'text/plain' });
      await driver.write(first, '/r2base/iso/shared.txt', 'acme bytes', { type: 'text/plain' });

      const second: DriverContext<boolean> = createDriverCtx();
      await globex.exists(second, '/r2base/iso/shared.txt');
      await driver.exists(second, '/r2base/iso/shared.txt');

      expect(second.result).toBe(false);

      await bucket.delete(['tenants/acme/r2base/iso/shared.txt']);
    });
  });

  it('respects a custom ownerKey configured in driver options', async () => {
    const customDriver = new R2Driver(bucket, { ownerKey: 'x_creator' });
    const ctx: DriverContext<FileInfo> = createDriverCtx();

    await withFs({ ownerId: 'charlie', homeDir: '/users/charlie' }, async () => {
      await normalize.write(ctx, '/r2base/custom-owner.txt', 'data', { type: 'text/plain' });
      await customDriver.write(ctx, '/r2base/custom-owner.txt', 'data', { type: 'text/plain' });

      const head = await bucket.head('r2base/custom-owner.txt');
      expect(head?.customMetadata?.x_creator).toBe('charlie');

      await bucket.delete(['r2base/custom-owner.txt']);
    });
  });
});
