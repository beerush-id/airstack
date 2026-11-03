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
  if (!found) throw new Error('remove.test: no R2Bucket binding found in resolveBinding() env');
  bucket = found;
  if (!env.DB) throw new Error('remove.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
  ROOT = '/fsremove';
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

describe('fs remove purge', () => {
  it('purges a file by default on R2-only', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/purge/r2/gone.txt`, 'bye', { type: 'text/plain' });
      const removed = await fsR2.remove(`${ROOT}/purge/r2/gone.txt`);

      expect(removed).toBe(true);
      expect(await fsR2.exists(`${ROOT}/purge/r2/gone.txt`)).toBe(false);

      return;
    });
  });

  it('purges a file by default on the index', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const bytes = new Uint8Array([9, 8, 7, 6]);
      const input = new IRPCFile({ name: 'gone.bin', size: 4, type: 'application/octet-stream' }, new Blob([bytes]));
      await fsIndexed.write(`${ROOT}/purge/idx/gone.bin`, input, { type: 'application/octet-stream' });
      const removed = await fsIndexed.remove(`${ROOT}/purge/idx/gone.bin`);

      expect(removed).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/purge/idx/gone.bin`)).toBe(false);

      return;
    });
  });

  it('seals false for an absent target on R2-only', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsR2 = createFs({ bucket });

      const removed = await fsR2.remove(`${ROOT}/purge/r2/ghost.txt`);

      expect(removed).toBe(false);

      return;
    });
  });

  it('seals false for an absent target on the index', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });

      const removed = await fsIndexed.remove(`${ROOT}/purge/idx/ghost.txt`);

      expect(removed).toBe(false);

      return;
    });
  });

  it('removes a tree recursively on R2-only', () => {
    return withFs({}, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/purge/tree/child.txt`, 'child', { type: 'text/plain' });

      const removed = await fsR2.remove(`${ROOT}/purge/tree`, { recursive: true });

      expect(removed).toBe(true);
      expect(await fsR2.exists(`${ROOT}/purge/tree/child.txt`)).toBe(false);

      return;
    });
  });

  it('removes a tree recursively on the index', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/purge/itree/child.txt`, 'child', { type: 'text/plain' });

      const removed = await fsIndexed.remove(`${ROOT}/purge/itree`, { recursive: true });

      expect(removed).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/purge/itree/child.txt`)).toBe(false);

      return;
    });
  });
});

describe('fs remove strict matrix', () => {
  it('blocks strict removal without enforcement on R2-only', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsR2 = createFs({ bucket });
      const fsStrict = createFs({ bucket, strict: true });
      await fsR2.write(`${ROOT}/strict/r2guarded/child.txt`, 'child', { type: 'text/plain' });

      await expectDenial(
        () => fsStrict.remove(`${ROOT}/strict/r2guarded`, { recursive: true }),
        'ENOTEMPTY',
        `${ROOT}/strict/r2guarded`
      );

      return;
    });
  });

  it('blocks strict removal without enforcement on the index', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const fsStrict = createFs({ bucket, indexer: db, strict: true });
      await fsIndexed.write(`${ROOT}/strict/guarded/child.txt`, 'child', { type: 'text/plain' });

      await expectDenial(
        () => fsStrict.remove(`${ROOT}/strict/guarded`, { recursive: true }),
        'ENOTEMPTY',
        `${ROOT}/strict/guarded`
      );

      return;
    });
  });

  it('authorizes strict removal under enforcement', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob', enforced: true }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const fsStrict = createFs({ bucket, indexer: db, strict: true });
      await fsIndexed.write(`${ROOT}/strict/enforced/child.txt`, 'child', { type: 'text/plain' });

      const removed = await fsStrict.remove(`${ROOT}/strict/enforced`, { recursive: true });

      expect(removed).toBe(true);
      expect(await fsIndexed.exists(`${ROOT}/strict/enforced/child.txt`)).toBe(false);

      return;
    });
  });

  it('still blocks strict removal when force is set', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const fsStrict = createFs({ bucket, indexer: db, strict: true });
      await fsIndexed.write(`${ROOT}/strict/forced/child.txt`, 'child', { type: 'text/plain' });

      await expectDenial(
        () => fsStrict.remove(`${ROOT}/strict/forced`, { recursive: true, force: true }),
        'ENOTEMPTY',
        `${ROOT}/strict/forced`
      );

      return;
    });
  });

  it('passes strict removal for an empty directory', () => {
    return withFs({}, async () => {
      const fsStrict = createFs({ bucket, indexer: db, strict: true });
      await fsStrict.mkdir(`${ROOT}/strict/emptydir`);

      const removed = await fsStrict.remove(`${ROOT}/strict/emptydir`);

      expect(removed).toBe(true);

      return;
    });
  });
});

describe('fs remove soft trash restore', () => {
  it('stamps trash hiding the file from active lookups', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      await fsSoft.write(`${ROOT}/trash/soft.txt`, 'trash me', { type: 'text/plain' });
      const removed = await fsSoft.remove(`${ROOT}/trash/soft.txt`);
      const trashed = await fsSoft.list(`${ROOT}/trash`, { trash: true });

      expect(removed).toBe(true);
      expect(await fsSoft.exists(`${ROOT}/trash/soft.txt`)).toBe(false);
      expect(await fsSoft.stat(`${ROOT}/trash/soft.txt`)).toBeUndefined();
      expect(trashed.entries.map((entry) => entry.name)).toContain('soft.txt');

      return;
    });
  });

  it('stamps trash per operation with soft override', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/trash/perop.txt`, 'per op', { type: 'text/plain' });
      const removed = await fsR2.remove(`${ROOT}/trash/perop.txt`, { soft: true });
      const trashed = await fsR2.list(`${ROOT}/trash`, { trash: true });

      expect(removed).toBe(true);
      expect(await fsR2.exists(`${ROOT}/trash/perop.txt`)).toBe(false);
      expect(trashed.entries.map((entry) => entry.name)).toContain('perop.txt');

      return;
    });
  });

  it('restores a soft-deleted file to active state', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      await fsSoft.write(`${ROOT}/trash/back.txt`, 'come back', { type: 'text/plain' });
      await fsSoft.remove(`${ROOT}/trash/back.txt`);
      const restored = await fsSoft.restore(`${ROOT}/trash/back.txt`);

      expect(restored.path).toBe(`${ROOT}/trash/back.txt`);
      expect(await fsSoft.exists(`${ROOT}/trash/back.txt`)).toBe(true);

      return;
    });
  });

  it('halts restore with ENOENT outside the trash', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });

      await expectDenial(() => fsIndexed.restore(`${ROOT}/trash/never.txt`), 'ENOENT', `${ROOT}/trash/never.txt`);

      return;
    });
  });

  it('purges permanently with force bypassing soft trash', () => {
    return withFs({ ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      await fsSoft.write(`${ROOT}/trash/force.txt`, 'force me', { type: 'text/plain' });
      const removed = await fsSoft.remove(`${ROOT}/trash/force.txt`, { force: true });
      const trashed = await fsSoft.list(`${ROOT}/trash`, { trash: true });

      expect(removed).toBe(true);
      expect(await fsSoft.exists(`${ROOT}/trash/force.txt`)).toBe(false);
      expect(trashed.entries.map((entry) => entry.name)).not.toContain('force.txt');

      return;
    });
  });

  it('halts bare remove with EIO', () => {
    return withFs({}, async () => {
      const fsBare = createFs();

      await expectDenial(() => fsBare.remove(`${ROOT}/trash/bare.txt`), 'EIO', 'remove');

      return;
    });
  });

  it('halts bare restore with EIO', () => {
    return withFs({}, async () => {
      const fsBare = createFs();

      await expectDenial(() => fsBare.restore(`${ROOT}/trash/bare.txt`), 'EIO', 'restore');

      return;
    });
  });
});

describe('fs remove boundaries', () => {
  it('rejects remove outside accessRules with EACCES', () => {
    return withFs(
      { ownerId: 'fs-rem-bob', homeDir: '/users/fs-rem-bob', accessRules: [{ path: '/teams/**', allow: ['read'] }] },
      async () => {
        const fsR2 = createFs({ bucket });

        await expectDenial(() => fsR2.remove(`${ROOT}/denied/gone.txt`), 'EACCES', `${ROOT}/denied/gone.txt`);

        return;
      }
    );
  });
});

describe('fs remove shared sequence', () => {
  it('soft-deletes restores then purges through one warm instance', () => {
    return withFs({ ownerId: 'fs-rem-alice', homeDir: '/users/fs-rem-alice' }, async () => {
      const fsShared = createFs({ bucket, indexer: db, softDelete: true });
      await fsShared.write(`${ROOT}/shared/lifecycle.txt`, 'lifecycle', { type: 'text/plain' });
      await fsShared.remove(`${ROOT}/shared/lifecycle.txt`);
      const restored = await fsShared.restore(`${ROOT}/shared/lifecycle.txt`);
      const purged = await fsShared.remove(`${ROOT}/shared/lifecycle.txt`, { force: true });

      expect(restored.path).toBe(`${ROOT}/shared/lifecycle.txt`);
      expect(purged).toBe(true);
      expect(await fsShared.exists(`${ROOT}/shared/lifecycle.txt`)).toBe(false);

      return;
    });
  });
});
