import type { D1Database } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { FileInfo, FileInput } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/write.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1write%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1write%').run();
});

describe('D1Driver write and tiered inlining', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1write/tier%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1write/tier%').run();
  });

  it('infers application/json for an object write without an explicit type', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      await normalize.write(ctx, '/d1write/tier/infer-obj.json', { hello: 'world' });
      await driver.write(ctx, '/d1write/tier/infer-obj.json', { hello: 'world' });

      expect((ctx.result as FileInfo).type).toBe('application/json');
      const row = await db
        .prepare('SELECT type FROM _r2_files WHERE path = ?')
        .bind('/d1write/tier/infer-obj.json')
        .first<{ type: string }>();
      expect(row?.type).toBe('application/json');
    });
  });

  it('inlines a small text payload with its metadata row', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();

      await normalize.write(ctx, '/d1write/tier/small.txt', 'hello', { type: 'text/plain' });
      await driver.write(ctx, '/d1write/tier/small.txt', 'hello', { type: 'text/plain' });

      expect((ctx.result as FileInfo).path).toBe('/d1write/tier/small.txt');
      expect((ctx.result as FileInfo).size).toBe(5);
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/small.txt').first()
      ).not.toBeNull();
    });
  });

  it('inlines a small JSON payload', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();

      await normalize.write(ctx, '/d1write/tier/doc.json', { hello: 'world' }, { type: 'application/json' });
      await driver.write(ctx, '/d1write/tier/doc.json', { hello: 'world' }, { type: 'application/json' });

      expect((ctx.result as FileInfo).path).toBe('/d1write/tier/doc.json');
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/doc.json').first()
      ).not.toBeNull();
    });
  });

  it('inlines a small base64 payload into raw content in storage', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      const base64Data = Buffer.from('hello base64').toString('base64');

      await normalize.write(ctx, '/d1write/tier/b64.txt', base64Data, { type: 'text/plain', encoding: 'base64' });
      await driver.write(ctx, '/d1write/tier/b64.txt', base64Data, { type: 'text/plain', encoding: 'base64' });

      const row = await db
        .prepare('SELECT content FROM _r2_contents WHERE path = ?')
        .bind('/d1write/tier/b64.txt')
        .first<{ content: string }>();

      expect(row?.content).toBe('hello base64');
    });
  });

  it('decodes inbound base64 data-url write into raw bytes', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      const dataUrl = 'data:text/plain;base64,aGVsbG8gd29ybGQ=';
      await normalize.write(ctx, '/d1write/tier/dataurl.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });
      await driver.write(ctx, '/d1write/tier/dataurl.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });

      const read = createDriverCtx<string>();
      await normalize.read(read, '/d1write/tier/dataurl.txt', { encoding: 'text' });
      await driver.read(read, '/d1write/tier/dataurl.txt', { encoding: 'text' });

      expect(read.result).toBe('hello world');
    });
  });

  it('decodes inbound url-encoded data-url write into raw bytes', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      const dataUrl = 'data:text/plain,hello%20world';
      await normalize.write(ctx, '/d1write/tier/dataurl-raw.txt', dataUrl, {
        type: 'text/plain',
        encoding: 'data-url',
      });
      await driver.write(ctx, '/d1write/tier/dataurl-raw.txt', dataUrl, { type: 'text/plain', encoding: 'data-url' });

      const read = createDriverCtx<string>();
      await normalize.read(read, '/d1write/tier/dataurl-raw.txt', { encoding: 'text' });
      await driver.read(read, '/d1write/tier/dataurl-raw.txt', { encoding: 'text' });

      expect(read.result).toBe('hello world');
    });
  });

  it('inlines array JSON values', async () => {
    await withFs({}, async () => {
      const arrCtx = createDriverCtx<FileInfo>();
      await normalize.write(arrCtx, '/d1write/tier/arr.json', [1, 2, 3], { type: 'application/json' });
      await driver.write(arrCtx, '/d1write/tier/arr.json', [1, 2, 3], { type: 'application/json' });
      expect((arrCtx.result as FileInfo).size).toBe(Buffer.byteLength('[1,2,3]', 'utf-8'));

      const readArr = createDriverCtx<FileInput | undefined>();
      await normalize.read(readArr, '/d1write/tier/arr.json', { encoding: 'json' });
      await driver.read(readArr, '/d1write/tier/arr.json', { encoding: 'json' });
      expect(readArr.result).toEqual([1, 2, 3]);
    });
  });

  it('spills large text payloads to storage without inlining', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      const largeText = 'a'.repeat(600 * 1024);

      await normalize.write(ctx, '/d1write/tier/large.txt', largeText, { type: 'text/plain' });
      await driver.write(ctx, '/d1write/tier/large.txt', largeText, { type: 'text/plain' });

      expect((ctx.result as FileInfo).path).toBe('/d1write/tier/large.txt');
      expect((ctx.result as FileInfo).size).toBe(600 * 1024);
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/large.txt').first()
      ).toBeNull();
    });
  });

  it('spills raw byte arrays to storage without inlining', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new IRPCFile(
        { name: 'img.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );

      await normalize.write(ctx, '/d1write/tier/image.png', file, { type: 'image/png' });
      await driver.write(ctx, '/d1write/tier/image.png', file, { type: 'image/png' });

      expect((ctx.result as FileInfo).path).toBe('/d1write/tier/image.png');
      expect((ctx.result as FileInfo).size).toBe(bytes.length);
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/image.png').first()
      ).toBeNull();
    });
  });

  it('spills payloads exceeding custom maxEncodingSize threshold', async () => {
    await withFs({}, async () => {
      const smallDriver = new D1Driver(db, { maxEncodingSize: '16B' });
      const ctx = createDriverCtx<FileInfo>();
      const payload = 'this is longer than 16 bytes';

      await normalize.write(ctx, '/d1write/tier/custom-spill.txt', payload, { type: 'text/plain' });
      await smallDriver.write(ctx, '/d1write/tier/custom-spill.txt', payload, { type: 'text/plain' });

      expect((ctx.result as FileInfo).path).toBe('/d1write/tier/custom-spill.txt');
      expect((ctx.result as FileInfo).size).toBe(Buffer.byteLength(payload, 'utf-8'));
      expect(
        await db
          .prepare('SELECT content FROM _r2_contents WHERE path = ?')
          .bind('/d1write/tier/custom-spill.txt')
          .first()
      ).toBeNull();
    });
  });

  it('purges inlined content table when overwritten by a spilled payload', async () => {
    await withFs({}, async () => {
      const smallCtx = createDriverCtx<FileInfo>();
      await normalize.write(smallCtx, '/d1write/tier/overwrite.txt', 'small', { type: 'text/plain' });
      await driver.write(smallCtx, '/d1write/tier/overwrite.txt', 'small', { type: 'text/plain' });
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/overwrite.txt').first()
      ).not.toBeNull();

      const bigFile = new IRPCFile(
        { name: 'overwrite.txt', size: 64, type: 'text/plain' },
        new Blob([new TextEncoder().encode('x'.repeat(64))], { type: 'text/plain' })
      );
      const bigCtx = createDriverCtx<FileInfo>();
      await normalize.write(bigCtx, '/d1write/tier/overwrite.txt', bigFile, { type: 'text/plain' });
      await driver.write(bigCtx, '/d1write/tier/overwrite.txt', bigFile, { type: 'text/plain' });

      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind('/d1write/tier/overwrite.txt').first()
      ).toBeNull();
    });
  });

  it('registers a rollback handler that purges the row and payload on write failure', async () => {
    await withFs({}, async () => {
      const ctx = createDriverCtx<FileInfo>();

      await normalize.write(ctx, '/d1write/tier/rollback.txt', 'revert data', { type: 'text/plain' });
      await driver.write(ctx, '/d1write/tier/rollback.txt', 'revert data', { type: 'text/plain' });

      expect(ctx.rollback.size).toBe(1);
      for (const rb of ctx.rollback) await rb();

      expect(
        await db.prepare('SELECT * FROM _r2_files WHERE path = ?').bind('/d1write/tier/rollback.txt').first()
      ).toBeNull();
      expect(
        await db.prepare('SELECT * FROM _r2_contents WHERE path = ?').bind('/d1write/tier/rollback.txt').first()
      ).toBeNull();
    });
  });
});
