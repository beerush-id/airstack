import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, ListResult } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/search.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

describe('R2Driver search', () => {
  it('passes search through without capability, leaving result unset', async () => {
    await withFs({}, async () => {
      const normalize = new NormalizerDriver();
      const driver = new R2Driver(bucket);

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.search(ctx, 'report', { cwd: '/r2search' });
      await driver.search(ctx, 'report', { cwd: '/r2search' });

      // R2 is incapable of search; it passes through without writing ctx.result
      expect('result' in ctx).toBe(false);
      expect(ctx.result).toBeUndefined();
    });
  });

  it('does not alter an existing upstream search result', async () => {
    await withFs({}, async () => {
      const normalize = new NormalizerDriver();
      const driver = new R2Driver(bucket);

      const ctx: DriverContext<ListResult> = createDriverCtx();
      await normalize.search(ctx, 'report');

      // Upstream D1 search resolution simulation:
      ctx.result = { entries: [] };

      await driver.search(ctx, 'report');
      expect('result' in ctx).toBe(true);
      expect(ctx.result?.entries).toEqual([]);
    });
  });
});
