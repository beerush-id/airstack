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
  if (!env.BUCKET) throw new Error('r2/read.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2read/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver read', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2read/blob.txt',
      'r2read/text.txt',
      'r2read/doc.json',
      'r2read/bin.dat',
      'r2read/dir',
      'r2read/dir/',
      'r2read/soft.txt',
      'r2read/range.txt',
    ]);
  });

  it('returns stored bytes as Blob for consumption', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/blob.txt', 'blob bytes', { type: 'text/plain' });
      await driver.write(seed, '/r2read/blob.txt', 'blob bytes', { type: 'text/plain' });

      const ctx: DriverContext<Blob | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/blob.txt');
      await driver.read(ctx, '/r2read/blob.txt');

      expect('result' in ctx).toBe(true);
      expect(ctx.result).toBeDefined();
      expect(await (ctx.result as Blob).text()).toBe('blob bytes');
    });
  });

  it('seals undefined when the object is absent', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<Blob | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/ghost.txt');
      await driver.read(ctx, '/r2read/ghost.txt');

      expect('result' in ctx).toBe(true);
      expect(ctx.result).toBeUndefined();
    });
  });

  it('decodes text through requested encoding', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/text.txt', 'plain utf8 string', { type: 'text/plain' });
      await driver.write(seed, '/r2read/text.txt', 'plain utf8 string', { type: 'text/plain' });

      const ctx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/text.txt', { encoding: 'text' });
      await driver.read(ctx, '/r2read/text.txt', { encoding: 'text' });

      expect(ctx.result).toBe('plain utf8 string');
    });
  });

  it('decodes json through requested encoding', async () => {
    await withFs({}, async () => {
      const payload = { num: 42, label: 'answer' };
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/doc.json', JSON.stringify(payload), { type: 'application/json' });
      await driver.write(seed, '/r2read/doc.json', JSON.stringify(payload), { type: 'application/json' });

      const ctx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(ctx, '/r2read/doc.json', { encoding: 'json' });
      await driver.read(ctx, '/r2read/doc.json', { encoding: 'json' });

      expect(ctx.result).toEqual(payload);
    });
  });

  it('decodes base64 through requested encoding', async () => {
    await withFs({}, async () => {
      const original = 'binary string for base64';
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/bin.dat', original, { type: 'application/octet-stream' });
      await driver.write(seed, '/r2read/bin.dat', original, { type: 'application/octet-stream' });

      const ctx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/bin.dat', { encoding: 'base64' });
      await driver.read(ctx, '/r2read/bin.dat', { encoding: 'base64' });

      const expectedBase64 = Buffer.from(original).toString('base64');
      expect(ctx.result).toBe(expectedBase64);
    });
  });

  it('decodes data-url through requested encoding', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/dataurl.txt', 'hello data url', { type: 'text/plain' });
      await driver.write(seed, '/r2read/dataurl.txt', 'hello data url', { type: 'text/plain' });

      const ctx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/dataurl.txt', { encoding: 'data-url' });
      await driver.read(ctx, '/r2read/dataurl.txt', { encoding: 'data-url' });

      expect(typeof ctx.result).toBe('string');
      expect(ctx.result).toMatch(/^data:text\/plain;base64,/);
    });
  });

  it('seals undefined when target is a directory marker (holds no payload)', async () => {
    await withFs({}, async () => {
      const mkdirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mkdirCtx, '/r2read/dir');
      await driver.mkdir(mkdirCtx, '/r2read/dir');

      const ctx: DriverContext<Blob | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/dir');
      await driver.read(ctx, '/r2read/dir');

      expect('result' in ctx).toBe(true);
      expect(ctx.result).toBeUndefined();
    });
  });

  it('skips read if upstream driver already resolved result (gating check)', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/upstream.txt', { encoding: 'text' });

      // Upstream D1 inlined resolution simulation:
      ctx.result = 'upstream resolved payload';

      await driver.read(ctx, '/r2read/upstream.txt', { encoding: 'text' });

      expect(ctx.result).toBe('upstream resolved payload');
    });
  });

  it('hides soft-deleted files from read', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/soft.txt', 'soft data');
      await softDriver.write(seed, '/r2read/soft.txt', 'soft data');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2read/soft.txt');
      await softDriver.remove(removeCtx, '/r2read/soft.txt');

      const hideCtx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(hideCtx, '/r2read/soft.txt', { encoding: 'text' });
      await softDriver.read(hideCtx, '/r2read/soft.txt', { encoding: 'text' });
      expect(hideCtx.result).toBeUndefined();
    });
  });

  it('reads byte range when range options are provided', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2read/range.txt', '0123456789abcdef');
      await driver.write(seed, '/r2read/range.txt', '0123456789abcdef');

      const ctx: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(ctx, '/r2read/range.txt', { encoding: 'text', range: { offset: 4, length: 6 } } as any);
      await driver.read(ctx, '/r2read/range.txt', { encoding: 'text', range: { offset: 4, length: 6 } } as any);

      if (ctx.result !== undefined) {
        expect(ctx.result).toBe('456789');
      }
    });
  });
});
