import type { R2Bucket } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
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
  if (!env.BUCKET) throw new Error('r2/write.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2write/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver write', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    await bucket.delete([
      'r2write/note.txt',
      'r2write/img.png',
      'r2write/obj.json',
      'r2write/arr.json',
      'r2write/b64.bin',
      'r2write/dataurl.txt',
      'r2write/dataurl-raw.txt',
      'r2write/public.txt',
      'r2write/hidden.txt',
      'r2write/meta.txt',
      'r2write/overwrite.txt',
      'r2write/rollback-new.txt',
      'r2write/rollback-overwrite.txt',
      'r2write/inlined-write.txt',
      'r2write/infer-obj.json',
      'r2write/infer-str.txt',
      'r2write/infer-bin.png',
    ]);
  });

  it('infers application/json for an object write without an explicit type', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2write/infer-obj.json', { a: 1 });
      await driver.write(ctx, '/r2write/infer-obj.json', { a: 1 });

      expect((ctx.result as FileInfo).type).toBe('application/json');
    });
  });

  it('infers text/plain for a string write without an explicit type', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2write/infer-str.txt', 'hello');
      await driver.write(ctx, '/r2write/infer-str.txt', 'hello');

      expect((ctx.result as FileInfo).type).toBe('text/plain');
    });
  });

  it('infers the IRPCFile MIME for a binary write without an explicit type', async () => {
    await withFs({}, async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const input = new IRPCFile(
        { name: 'i.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2write/infer-bin.png', input);
      await driver.write(ctx, '/r2write/infer-bin.png', input);

      expect((ctx.result as FileInfo).type).toBe('image/png');
    });
  });

  it('stores UTF-8 text sealing FileInfo with the owner stamp', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/note.txt', 'hello', { type: 'text/plain' });
      await driver.write(ctx, '/r2write/note.txt', 'hello', { type: 'text/plain' });

      const result = ctx.result as FileInfo;
      expect(result.path).toBe('/r2write/note.txt');
      expect(result.size).toBe(5);

      const stored = await bucket.head('r2write/note.txt');
      expect(stored).not.toBeNull();
      expect(stored?.customMetadata?._fs_user_id).toBe('alice');
      expect(await (await bucket.get('r2write/note.txt'))?.text()).toBe('hello');
    });
  });

  it('stores binary payloads with byte-exact size', async () => {
    await withFs({}, async () => {
      const bytes = new Uint8Array(512).map((_, i) => i % 256);
      const input = new IRPCFile(
        { name: 'img.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/img.png', input, { type: 'image/png' });
      await driver.write(ctx, '/r2write/img.png', input, { type: 'image/png' });

      expect((ctx.result as FileInfo).size).toBe(512);
      expect((await bucket.head('r2write/img.png'))?.size).toBe(512);
    });
  });

  it('stores plain objects serialized to JSON', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const payload = { title: 'TDD', tags: ['storage', 'r2'] };

      await normalize.write(ctx, '/r2write/obj.json', payload, { type: 'application/json' });
      await driver.write(ctx, '/r2write/obj.json', payload, { type: 'application/json' });

      const stored = await bucket.get('r2write/obj.json');
      expect(stored).not.toBeNull();
      expect(await stored?.json()).toEqual(payload);
    });
  });

  it('stores arrays serialized to JSON', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const list = [1, 2, 3, 'four'];

      await normalize.write(ctx, '/r2write/arr.json', list, { type: 'application/json' });
      await driver.write(ctx, '/r2write/arr.json', list, { type: 'application/json' });

      const stored = await bucket.get('r2write/arr.json');
      expect(stored).not.toBeNull();
      expect(await stored?.json()).toEqual(list);
    });
  });

  it('stores primitive numbers serialized to JSON', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/num.json', 12345 as any, { type: 'application/json' });
      await driver.write(ctx, '/r2write/num.json', 12345 as any, { type: 'application/json' });

      const stored = await bucket.get('r2write/num.json');
      expect(stored).not.toBeNull();
      expect(await stored?.json()).toBe(12345);
    });
  });

  it('decodes inbound base64 writes into raw binary in storage', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const base64Data = Buffer.from('hello binary from base64').toString('base64');

      await normalize.write(ctx, '/r2write/b64.bin', base64Data, {
        type: 'application/octet-stream',
        encoding: 'base64',
      });
      await driver.write(ctx, '/r2write/b64.bin', base64Data, { type: 'application/octet-stream', encoding: 'base64' });

      const stored = await bucket.get('r2write/b64.bin');
      expect(await stored?.text()).toBe('hello binary from base64');
    });
  });

  it('decodes inbound base64 data-url write into raw bytes in storage', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const dataUrl = 'data:text/plain;base64,aGVsbG8gd29ybGQ=';

      await normalize.write(ctx, '/r2write/dataurl.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });
      await driver.write(ctx, '/r2write/dataurl.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });

      const stored = await bucket.get('r2write/dataurl.txt');
      expect(await stored?.text()).toBe('hello world');
    });
  });

  it('decodes inbound url-encoded data-url write into raw bytes in storage', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const dataUrl = 'data:text/plain,hello%20world';

      await normalize.write(ctx, '/r2write/dataurl-raw.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });
      await driver.write(ctx, '/r2write/dataurl-raw.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });

      const stored = await bucket.get('r2write/dataurl-raw.txt');
      expect(await stored?.text()).toBe('hello world');
    });
  });

  it('stamps public flag in customMetadata when requested', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/public.txt', 'public text', { public: true });
      await driver.write(ctx, '/r2write/public.txt', 'public text', { public: true });

      const head = await bucket.head('r2write/public.txt');
      expect(head?.customMetadata?._fs_public).toBe('true');
    });
  });

  it('stamps hidden flag in customMetadata when requested', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/hidden.txt', 'secret text', { hidden: true });
      await driver.write(ctx, '/r2write/hidden.txt', 'secret text', { hidden: true });

      const head = await bucket.head('r2write/hidden.txt');
      expect(head?.customMetadata?._fs_hidden).toBe('true');
    });
  });

  it('stamps custom metadata into customMetadata', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/meta.txt', 'meta text', { metadata: { version: '2', branch: 'main' } });
      await driver.write(ctx, '/r2write/meta.txt', 'meta text', { metadata: { version: '2', branch: 'main' } });

      const head = await bucket.head('r2write/meta.txt');
      expect(head?.customMetadata?.version).toBe('2');
      expect(head?.customMetadata?.branch).toBe('main');
    });
  });

  it('updates storage on overwrite', async () => {
    await withFs({}, async () => {
      const first: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(first, '/r2write/overwrite.txt', 'v1', { type: 'text/plain' });
      await driver.write(first, '/r2write/overwrite.txt', 'v1', { type: 'text/plain' });

      const second: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(second, '/r2write/overwrite.txt', 'version two', { type: 'text/plain' });
      await driver.write(second, '/r2write/overwrite.txt', 'version two', { type: 'text/plain' });

      expect((second.result as FileInfo).size).toBe(11);
      const stored = await bucket.get('r2write/overwrite.txt');
      expect(await stored?.text()).toBe('version two');
    });
  });

  it('registers rollback for new file that deletes the object on failure', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();

      await normalize.write(ctx, '/r2write/rollback-new.txt', 'new data');
      await driver.write(ctx, '/r2write/rollback-new.txt', 'new data');

      expect(ctx.rollback.size).toBeGreaterThan(0);
      expect(await bucket.head('r2write/rollback-new.txt')).not.toBeNull();

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await bucket.head('r2write/rollback-new.txt')).toBeNull();
    });
  });

  it('registers rollback for overwrite that restores previous content', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2write/rollback-overwrite.txt', 'original content', { type: 'text/plain' });
      await driver.write(seed, '/r2write/rollback-overwrite.txt', 'original content', { type: 'text/plain' });

      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2write/rollback-overwrite.txt', 'corrupted content', { type: 'text/plain' });
      await driver.write(ctx, '/r2write/rollback-overwrite.txt', 'corrupted content', { type: 'text/plain' });

      expect(await (await bucket.get('r2write/rollback-overwrite.txt'))?.text()).toBe('corrupted content');

      for (const rollback of Array.from(ctx.rollback).reverse()) {
        await rollback();
      }

      expect(await (await bucket.get('r2write/rollback-overwrite.txt'))?.text()).toBe('original content');
    });
  });

  it('acts cooperatively without skipping when ctx.result was pre-set upstream', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2write/coop.txt', 'cooperative data');

      // Pre-set result as if an upstream indexer already ran
      ctx.result = {
        path: '/r2write/coop.txt',
        name: 'coop.txt',
        size: 16,
        type: 'text/plain',
        mtime: new Date(),
        isDirectory: false,
      };

      await driver.write(ctx, '/r2write/coop.txt', 'cooperative data');

      // Storage media must have stored the blob
      const stored = await bucket.get('r2write/coop.txt');
      expect(await stored?.text()).toBe('cooperative data');

      await bucket.delete(['r2write/coop.txt']);
    });
  });

  it('persists the canonical blob even when ctx.info is populated', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      ctx.info = {
        path: '/r2write/inlined-write.txt',
        name: 'inlined-write.txt',
        size: 15,
        type: 'text/plain',
        mtime: new Date(),
        isDirectory: false,
      };

      await normalize.write(ctx, '/r2write/inlined-write.txt', 'small payload', { type: 'text/plain' });
      await driver.write(ctx, '/r2write/inlined-write.txt', 'small payload', { type: 'text/plain' });

      const stored = await bucket.get('r2write/inlined-write.txt');
      expect(stored).not.toBeNull();
      expect(await stored?.text()).toBe('small payload');
    });
  });
});
