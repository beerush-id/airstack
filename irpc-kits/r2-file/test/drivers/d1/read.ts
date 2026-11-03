import type { D1Database } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { FileEncoding, FileInfo, FileInput } from '../../../src/types.js';
import { expectDenial, withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/read.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1read%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1read%').run();
});

describe('D1Driver read operations and wire decoding', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1read%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1read%').run();
  });

  it('reads inlined text content directly from SQLite without falling through', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/note.txt', 'hello direct', { type: 'text/plain' });
      await driver.write(seed, '/d1read/note.txt', 'hello direct', { type: 'text/plain' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/note.txt', { encoding: 'text' });
      await driver.read(ctx, '/d1read/note.txt', { encoding: 'text' });

      expect(ctx.result).toBe('hello direct');
    });
  });

  it('decodes an inlined JSON payload into a live object', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/doc.json', { a: 1, b: 'two' }, { type: 'application/json' });
      await driver.write(seed, '/d1read/doc.json', { a: 1, b: 'two' }, { type: 'application/json' });

      const ctx = createDriverCtx<{ a: number; b: string }>();
      await normalize.read(ctx, '/d1read/doc.json', { encoding: 'json' });
      await driver.read(ctx, '/d1read/doc.json', { encoding: 'json' });

      expect(ctx.result).toEqual({ a: 1, b: 'two' });
    });
  });

  it('passes through to next driver when reading a spilled file', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const file = new IRPCFile(
        { name: 'spilled.txt', size: bytes.length, type: 'application/octet-stream' },
        new Blob([bytes], { type: 'application/octet-stream' })
      );

      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/spilled.txt', file, { type: 'application/octet-stream' });
      await driver.write(seed, '/d1read/spilled.txt', file, { type: 'application/octet-stream' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/spilled.txt', { encoding: 'text' });
      await driver.read(ctx, '/d1read/spilled.txt', { encoding: 'text' });

      expect('result' in ctx).toBe(false);
    });
  });

  it('passes through when the path was never indexed', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const ctx = createDriverCtx<string>();

      await normalize.read(ctx, '/d1read/ghost.txt', { encoding: 'text' });
      await driver.read(ctx, '/d1read/ghost.txt', { encoding: 'text' });

      expect('result' in ctx).toBe(false);
    });
  });

  it('decodes inlined content as base64', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/encoded.b64', 'hello world', { type: 'text/plain' });
      await driver.write(seed, '/d1read/encoded.b64', 'hello world', { type: 'text/plain' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/encoded.b64', { encoding: 'base64' });
      await driver.read(ctx, '/d1read/encoded.b64', { encoding: 'base64' });

      expect(ctx.result).toBe(Buffer.from('hello world').toString('base64'));
    });
  });

  it('decodes inlined content as data-url with MIME type prefix', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/encoded.data', 'hello world', { type: 'text/plain' });
      await driver.write(seed, '/d1read/encoded.data', 'hello world', { type: 'text/plain' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/encoded.data', { encoding: 'data-url' });
      await driver.read(ctx, '/d1read/encoded.data', { encoding: 'data-url' });

      const expectedB64 = Buffer.from('hello world').toString('base64');
      expect(ctx.result).toBe(`data:text/plain;base64,${expectedB64}`);
    });
  });

  it('passes through when reading an inode directory without inlined content', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const dirCtx = createDriverCtx<FileInfo>();
      await normalize.mkdir(dirCtx, '/d1read/dir');
      await driver.mkdir(dirCtx, '/d1read/dir');

      const ctx = createDriverCtx<FileInput | undefined>();
      await normalize.read(ctx, '/d1read/dir', { encoding: 'text' });
      await driver.read(ctx, '/d1read/dir', { encoding: 'text' });

      expect('result' in ctx).toBe(false);
    });
  });

  it('passes a non-encoded read through to the canonical medium', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/raw-def.txt', 'raw text', { type: 'text/plain' });
      await driver.write(seed, '/d1read/raw-def.txt', 'raw text', { type: 'text/plain' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/raw-def.txt');
      await driver.read(ctx, '/d1read/raw-def.txt');

      // D1 caches text for encoded reads only; a blob request is not its capability.
      expect('result' in ctx).toBe(false);
    });
  });

  it('passes through when reading a soft-deleted file without trash access', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/trashed.txt', 'trash data', { type: 'text/plain' });
      await driver.write(seed, '/d1read/trashed.txt', 'trash data', { type: 'text/plain' });

      const remCtx = createDriverCtx<boolean>();
      await normalize.remove(remCtx, '/d1read/trashed.txt');
      await soft.remove(remCtx, '/d1read/trashed.txt');

      const readCtx = createDriverCtx<string>();
      await normalize.read(readCtx, '/d1read/trashed.txt', { encoding: 'text' });
      await driver.read(readCtx, '/d1read/trashed.txt', { encoding: 'text' });

      expect('result' in readCtx).toBe(false);
    });
  });

  it('falls back to raw string decoding when encoding is unknown', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/unknown-enc.txt', 'raw payload', { type: 'text/plain' });
      await driver.write(seed, '/d1read/unknown-enc.txt', 'raw payload', { type: 'text/plain' });

      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/unknown-enc.txt', { encoding: 'unsupported' as FileEncoding });
      await driver.read(ctx, '/d1read/unknown-enc.txt', { encoding: 'unsupported' as FileEncoding });

      expect(ctx.result).toBe('raw payload');
    });
  });

  it('rejects an encoded read exceeding maxEncodingSize with EFBIG', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1read/big.txt', 'x'.repeat(64), { type: 'text/plain' });
      await driver.write(seed, '/d1read/big.txt', 'x'.repeat(64), { type: 'text/plain' });

      const small = new D1Driver(db, { maxEncodingSize: 8 });
      const ctx = createDriverCtx<string>();
      await normalize.read(ctx, '/d1read/big.txt', { encoding: 'text' });

      await expectDenial(() => small.read(ctx, '/d1read/big.txt', { encoding: 'text' }), 'EFBIG', '64');
    });
  });
});
