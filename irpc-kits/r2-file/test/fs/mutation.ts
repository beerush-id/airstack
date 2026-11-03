import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFs } from '../../src/fs/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;
let ROOT!: string;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  let found: R2Bucket | undefined;
  for (const value of Object.values(env)) {
    const candidate = value as Record<string, unknown> | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.put === 'function' &&
      typeof candidate.get === 'function' &&
      typeof candidate.head === 'function' &&
      typeof candidate.delete === 'function' &&
      typeof candidate.list === 'function'
    ) {
      found = value as R2Bucket;
      break;
    }
  }
  if (!found) throw new Error('mutation.test: no R2Bucket binding found in resolveBinding() env');
  bucket = found;
  if (!env.DB) throw new Error('mutation.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
  ROOT = '/fsmutation';
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind(`${ROOT}%`).run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind(`${ROOT}%`).run();
  const prefix = ROOT.slice(1);
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    if (page.objects.length > 0) {
      await bucket.delete(page.objects.map((object) => object.key));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined' || typeof ROOT === 'undefined' || typeof db === 'undefined') return;
  const prefix = ROOT.slice(1);
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    if (page.objects.length > 0) {
      await bucket.delete(page.objects.map((object) => object.key));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind(`${ROOT}%`).run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind(`${ROOT}%`).run();
});

describe('fs copy', () => {
  it('round-trips bytes on R2-only keeping the source', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/copy/r2/src.txt`, 'copy me', { type: 'text/plain' });
      const copied = await fsR2.copy(`${ROOT}/copy/r2/src.txt`, `${ROOT}/copy/r2/dst.txt`);
      const text = await fsR2.read(`${ROOT}/copy/r2/dst.txt`, { encoding: 'text' });

      expect(copied).toBe(true);
      expect(await fsR2.exists(`${ROOT}/copy/r2/src.txt`)).toBe(true);
      expect(await fsR2.exists(`${ROOT}/copy/r2/dst.txt`)).toBe(true);
      expect(text).toBe('copy me');

      return;
    });
  });

  it('round-trips bytes on the index keeping the source', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/copy/idx/src.txt`, 'copy me', { type: 'text/plain' });
      const copied = await fsIndexed.copy(`${ROOT}/copy/idx/src.txt`, `${ROOT}/copy/idx/dst.txt`);
      const text = await fsIndexed.read(`${ROOT}/copy/idx/dst.txt`, { encoding: 'text' });

      expect(copied).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/copy/idx/src.txt`)).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/copy/idx/dst.txt`)).toBe(true);
      expect(text).toBe('copy me');

      return;
    });
  });

  it('preserves metadata on copy across both media', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/copy/meta/src.txt`, 'meta bytes', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      const copied = await fsIndexed.copy(`${ROOT}/copy/meta/src.txt`, `${ROOT}/copy/meta/dst.txt`);
      const info = await fsIndexed.stat(`${ROOT}/copy/meta/dst.txt`);

      expect(copied).toBe(true);
      expect(info?.metadata).toMatchObject({ author: 'alice' });

      return;
    });
  });

  it('duplicates inlined text without touching R2 blobs', () => {
    return withFs({}, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/copy/inlined/src.txt`, 'hello', { type: 'text/plain' });
      const copied = await fsIndexed.copy(`${ROOT}/copy/inlined/src.txt`, `${ROOT}/copy/inlined/dst.txt`);
      const text = await fsIndexed.read(`${ROOT}/copy/inlined/dst.txt`, { encoding: 'text' });

      expect(copied).toBe(true);
      expect(text).toBe('hello');

      return;
    });
  });

  it('duplicates binary blobs byte-exact on the index', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const bytes = new Uint8Array(512).map((_, i) => i % 256);
      const input = new IRPCFile({ name: 'img.png', size: 512, type: 'image/png' }, new Blob([bytes]));
      await fsIndexed.write(`${ROOT}/copy/binary/src.png`, input, { type: 'image/png' });
      const copied = await fsIndexed.copy(`${ROOT}/copy/binary/src.png`, `${ROOT}/copy/binary/dst.png`);
      const info = await fsIndexed.stat(`${ROOT}/copy/binary/dst.png`);

      expect(copied).toBe(true);
      expect(info?.size).toBe(512);
      expect(await fsIndexed.exists(`${ROOT}/copy/binary/src.png`)).toBe(true);

      return;
    });
  });

  it('halts copy with ENOENT leaving no destination residue', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });

      await expectDenial(
        () => fsIndexed.copy(`${ROOT}/copy/ghost/src.txt`, `${ROOT}/copy/ghost/dst.txt`),
        'ENOENT',
        `${ROOT}/copy/ghost/src.txt`
      );
      const leaked = await fsIndexed.exists(`${ROOT}/copy/ghost/dst.txt`);

      expect(leaked).toBe(false);

      return;
    });
  });

  it('copies a directory marker across media', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.mkdir(`${ROOT}/copy/dir/src-dir`);
      const copied = await fsIndexed.copy(`${ROOT}/copy/dir/src-dir`, `${ROOT}/copy/dir/dst-dir`);
      const stat = await fsIndexed.stat(`${ROOT}/copy/dir/dst-dir`);

      expect(copied).toBe(true);
      expect(stat?.isDirectory).toBe(true);
      expect(stat?.size).toBe(0);

      return;
    });
  });

  it('halts copy with ENOENT when source is soft-deleted', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      await fsSoft.write(`${ROOT}/copy/soft/src.txt`, 'trashed', { type: 'text/plain' });
      await fsSoft.remove(`${ROOT}/copy/soft/src.txt`);

      await expectDenial(
        () => fsSoft.copy(`${ROOT}/copy/soft/src.txt`, `${ROOT}/copy/soft/dst.txt`),
        'ENOENT',
        `${ROOT}/copy/soft/src.txt`
      );

      return;
    });
  });

  it('halts bare copy with EIO', () => {
    return withFs({}, async () => {
      const fsBare = createFs();

      await expectDenial(() => fsBare.copy(`${ROOT}/copy/bare/src.txt`, `${ROOT}/copy/bare/dst.txt`), 'EIO', 'copy');

      return;
    });
  });
});

describe('fs move', () => {
  it('relocates bytes on R2-only removing the source', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/move/r2/src.txt`, 'move me', { type: 'text/plain' });
      const moved = await fsR2.move(`${ROOT}/move/r2/src.txt`, `${ROOT}/move/r2/dst.txt`);
      const text = await fsR2.read(`${ROOT}/move/r2/dst.txt`, { encoding: 'text' });

      expect(moved).toBe(true);
      expect(await fsR2.exists(`${ROOT}/move/r2/dst.txt`)).toBe(true);
      expect(await fsR2.exists(`${ROOT}/move/r2/src.txt`)).toBe(false);
      expect(text).toBe('move me');

      return;
    });
  });

  it('relocates bytes on the index removing the source', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/move/idx/src.txt`, 'move me', { type: 'text/plain' });
      const moved = await fsIndexed.move(`${ROOT}/move/idx/src.txt`, `${ROOT}/move/idx/dst.txt`);
      const text = await fsIndexed.read(`${ROOT}/move/idx/dst.txt`, { encoding: 'text' });

      expect(moved).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/move/idx/dst.txt`)).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/move/idx/src.txt`)).toBe(false);
      expect(text).toBe('move me');

      return;
    });
  });

  it('preserves metadata on move across both media', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/move/meta/src.txt`, 'meta bytes', {
        type: 'text/plain',
        metadata: { author: 'bob' },
      });
      const moved = await fsIndexed.move(`${ROOT}/move/meta/src.txt`, `${ROOT}/move/meta/dst.txt`);
      const info = await fsIndexed.stat(`${ROOT}/move/meta/dst.txt`);

      expect(moved).toBe(true);
      expect(info?.metadata).toMatchObject({ author: 'bob' });

      return;
    });
  });

  it('moves a directory marker across media', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.mkdir(`${ROOT}/move/dir/src-dir`);
      const moved = await fsIndexed.move(`${ROOT}/move/dir/src-dir`, `${ROOT}/move/dir/dst-dir`);
      const stat = await fsIndexed.stat(`${ROOT}/move/dir/dst-dir`);

      expect(moved).toBe(true);
      expect(stat?.isDirectory).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/move/dir/src-dir`)).toBe(false);

      return;
    });
  });

  it('halts move with ENOENT when source is soft-deleted', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      await fsSoft.write(`${ROOT}/move/soft/src.txt`, 'trashed', { type: 'text/plain' });
      await fsSoft.remove(`${ROOT}/move/soft/src.txt`);

      await expectDenial(
        () => fsSoft.move(`${ROOT}/move/soft/src.txt`, `${ROOT}/move/soft/dst.txt`),
        'ENOENT',
        `${ROOT}/move/soft/src.txt`
      );

      return;
    });
  });

  it('halts move with ENOENT leaving no destination residue', () => {
    return withFs({ ownerId: 'fs-mut-bob', homeDir: '/users/fs-mut-bob' }, async () => {
      const fsR2 = createFs({ bucket });

      await expectDenial(
        () => fsR2.move(`${ROOT}/move/ghost/src.txt`, `${ROOT}/move/ghost/dst.txt`),
        'ENOENT',
        `${ROOT}/move/ghost/src.txt`
      );
      const leaked = await fsR2.exists(`${ROOT}/move/ghost/dst.txt`);

      expect(leaked).toBe(false);

      return;
    });
  });

  it('halts bare move with EIO', () => {
    return withFs({}, async () => {
      const fsBare = createFs();

      await expectDenial(() => fsBare.move(`${ROOT}/move/bare/src.txt`, `${ROOT}/move/bare/dst.txt`), 'EIO', 'move');

      return;
    });
  });
});

describe('fs mutation shared sequence', () => {
  it('copies then moves through one warm instance', () => {
    return withFs({ ownerId: 'fs-mut-alice', homeDir: '/users/fs-mut-alice' }, async () => {
      const fsShared = createFs({ bucket, indexer: db });
      await fsShared.write(`${ROOT}/shared/origin.txt`, 'shared bytes', { type: 'text/plain' });
      const copied = await fsShared.copy(`${ROOT}/shared/origin.txt`, `${ROOT}/shared/copied.txt`);
      const moved = await fsShared.move(`${ROOT}/shared/copied.txt`, `${ROOT}/shared/moved.txt`);
      const text = await fsShared.read(`${ROOT}/shared/moved.txt`, { encoding: 'text' });

      expect(copied).toBe(true);
      expect(moved).toBe(true);
      expect(text).toBe('shared bytes');
      expect(await fsShared.exists(`${ROOT}/shared/origin.txt`)).toBe(true);

      return;
    });
  });
});
