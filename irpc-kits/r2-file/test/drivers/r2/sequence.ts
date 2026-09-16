import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/sequence.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2seq/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver shared instance sequence', () => {
  let normalize!: NormalizerDriver;
  let warm!: R2Driver;

  beforeAll(async () => {
    normalize = new NormalizerDriver();
    warm = new R2Driver(bucket);
  });

  it('writes and reads through one shared instance', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const first: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(first, '/r2seq/note.txt', 'v1', { type: 'text/plain' });
      await warm.write(first, '/r2seq/note.txt', 'v1', { type: 'text/plain' });

      const read: DriverContext<Blob | undefined> = createDriverCtx();
      await normalize.read(read, '/r2seq/note.txt');
      await warm.read(read, '/r2seq/note.txt');

      expect(await (read.result as Blob).text()).toBe('v1');
    });
  });

  it('serves the overwrite, never the stale bytes', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const second: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(second, '/r2seq/note.txt', 'version two', { type: 'text/plain' });
      await warm.write(second, '/r2seq/note.txt', 'version two', { type: 'text/plain' });

      const read: DriverContext<Blob | undefined> = createDriverCtx();
      await normalize.read(read, '/r2seq/note.txt');
      await warm.read(read, '/r2seq/note.txt');

      expect(await (read.result as Blob).text()).toBe('version two');
    });
  });

  it('confirms absence after removal through the same instance', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const removed: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removed, '/r2seq/note.txt');
      await warm.remove(removed, '/r2seq/note.txt');

      expect(removed.result).toBe(true);

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/r2seq/note.txt');
      await warm.stat(stat, '/r2seq/note.txt');

      expect('result' in stat).toBe(true);
      expect(stat.result).toBeUndefined();
    });
  });

  it('handles multi-operation lifecycle sequentially', async () => {
    await withFs({}, async () => {
      // 1. mkdir
      const mk: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mk, '/r2seq/folder');
      await warm.mkdir(mk, '/r2seq/folder');

      // 2. write child
      const wr: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wr, '/r2seq/folder/child.txt', 'content');
      await warm.write(wr, '/r2seq/folder/child.txt', 'content');

      // 3. stat child
      const st: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(st, '/r2seq/folder/child.txt');
      await warm.stat(st, '/r2seq/folder/child.txt');
      expect(st.result?.size).toBe(7);

      // 4. copy child
      const cp: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(cp, '/r2seq/folder/child.txt', '/r2seq/folder/copy.txt');
      await warm.copy(cp, '/r2seq/folder/child.txt', '/r2seq/folder/copy.txt');
      expect(cp.result).toBe(true);

      // 5. read copy
      const rd: DriverContext<string | undefined> = createDriverCtx();
      await normalize.read(rd, '/r2seq/folder/copy.txt', { encoding: 'text' });
      await warm.read(rd, '/r2seq/folder/copy.txt', { encoding: 'text' });
      expect(rd.result).toBe('content');

      // 6. remove recursive
      const rm: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rm, '/r2seq/folder', { recursive: true });
      await warm.remove(rm, '/r2seq/folder', { recursive: true });
      expect(rm.result).toBe(true);
    });
  });
});
