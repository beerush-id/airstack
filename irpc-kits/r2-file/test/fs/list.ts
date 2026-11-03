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
  if (!found) throw new Error('list.test: no R2Bucket binding found in resolveBinding() env');
  bucket = found;
  if (!env.DB) throw new Error('list.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
  ROOT = '/fslist';
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

describe('fs mkdir', () => {
  it('creates a directory on R2-only sealing FileInfo', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      const info = await fsR2.mkdir(`${ROOT}/mkdir/r2dir`);

      expect(info.path).toBe(`${ROOT}/mkdir/r2dir`);
      expect(info.isDirectory).toBe(true);
      expect(info.size).toBe(0);
      expect(await fsR2.exists(`${ROOT}/mkdir/r2dir`)).toBe(true);

      return;
    });
  });

  it('creates a directory on the index sealing FileInfo', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      const info = await fsIndexed.mkdir(`${ROOT}/mkdir/idxdir`);

      expect(info.path).toBe(`${ROOT}/mkdir/idxdir`);
      expect(info.isDirectory).toBe(true);
      expect(info.size).toBe(0);
      expect(await fsIndexed.exists(`${ROOT}/mkdir/idxdir`)).toBe(true);

      return;
    });
  });

  it('lists the created directory from its parent', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.mkdir(`${ROOT}/mkdir/listed`);

      const names = (await fsR2.list(`${ROOT}/mkdir`)).entries.map((entry) => entry.name);

      expect(names).toContain('listed');

      return;
    });
  });
});

describe('fs list', () => {
  it('lists immediate children non-recursively on R2-only', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/list/flat/one.txt`, '1', { type: 'text/plain' });
      await fsR2.write(`${ROOT}/list/flat/two.txt`, '2', { type: 'text/plain' });
      await fsR2.write(`${ROOT}/list/flat/nested/deep.txt`, '3', { type: 'text/plain' });

      const names = (await fsR2.list(`${ROOT}/list/flat`)).entries.map((entry) => entry.name).sort();

      expect(names).toContain('one.txt');
      expect(names).toContain('two.txt');
      expect(names).not.toContain('deep.txt');

      return;
    });
  });

  it('lists descendants recursively on R2-only', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/list/tree/nested/deep.txt`, '3', { type: 'text/plain' });

      const paths = (await fsR2.list(`${ROOT}/list/tree`, { recursive: true })).entries.map((entry) => entry.path);

      expect(paths).toContain(`${ROOT}/list/tree/nested/deep.txt`);

      return;
    });
  });

  it('lists descendants recursively on the index', () => {
    return withFs({}, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/itree/nested/deep.txt`, '3', { type: 'text/plain' });

      const paths = (await fsIndexed.list(`${ROOT}/list/itree`, { recursive: true })).entries.map(
        (entry) => entry.path
      );

      expect(paths).toContain(`${ROOT}/list/itree/nested/deep.txt`);

      return;
    });
  });

  it('writes empty entries with nextCursor on R2-only', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.mkdir(`${ROOT}/list/empty-r2`);

      const result = await fsR2.list(`${ROOT}/list/empty-r2`);

      expect(result.entries).toEqual([]);
      expect(result.nextCursor).toBeUndefined();

      return;
    });
  });

  it('writes empty entries with nextCursor on the index', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.mkdir(`${ROOT}/list/empty-idx`);

      const result = await fsIndexed.list(`${ROOT}/list/empty-idx`);

      expect(result.entries).toEqual([]);
      expect(result.nextCursor).toBeUndefined();

      return;
    });
  });

  it('paginates through limit cursor and nextCursor on the index', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/paged/a.txt`, 'a', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/paged/b.txt`, 'b', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/paged/c.txt`, 'c', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/paged/d.txt`, 'd', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/paged/e.txt`, 'e', { type: 'text/plain' });
      const first = await fsIndexed.list(`${ROOT}/list/paged`, { limit: 2, sort: 'name' });
      const second = await fsIndexed.list(`${ROOT}/list/paged`, {
        limit: 2,
        cursor: first.nextCursor,
        sort: 'name',
      });
      const third = await fsIndexed.list(`${ROOT}/list/paged`, {
        limit: 2,
        cursor: second.nextCursor,
        sort: 'name',
      });

      expect(first.entries.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt']);
      expect(first.nextCursor).toBeDefined();
      expect(second.entries.map((entry) => entry.name)).toEqual(['c.txt', 'd.txt']);
      expect(second.nextCursor).toBeDefined();
      expect(third.entries.map((entry) => entry.name)).toEqual(['e.txt']);

      return;
    });
  });

  it('sorts by size descending on the index', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/sized/small.txt`, 'x', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/sized/big.txt`, 'x'.repeat(64), { type: 'text/plain' });

      const names = (await fsIndexed.list(`${ROOT}/list/sized`, { sort: '-size' })).entries.map((entry) => entry.name);

      expect(names).toEqual(['big.txt', 'small.txt']);

      return;
    });
  });

  it('filters by MIME type on the index', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/typed/a.txt`, 'a', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/typed/b.json`, { b: 1 }, { type: 'application/json' });

      const names = (await fsIndexed.list(`${ROOT}/list/typed`, { filter: { type: 'application/json' } })).entries.map(
        (entry) => entry.name
      );

      expect(names).toEqual(['b.json']);

      return;
    });
  });

  it('filters by size range on the index', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/ranged/small.txt`, 'x', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/ranged/big.txt`, 'x'.repeat(64), { type: 'text/plain' });

      const names = (await fsIndexed.list(`${ROOT}/list/ranged`, { filter: { size: { min: 32 } } })).entries.map(
        (entry) => entry.name
      );

      expect(names).toEqual(['big.txt']);

      return;
    });
  });

  it('filters by metadata match on the index', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsKeyed = createFs({ bucket, indexer: db, indexableKeys: ['author'] });
      await fsKeyed.write(`${ROOT}/list/meta/mine.txt`, 'a', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      await fsKeyed.write(`${ROOT}/list/meta/yours.txt`, 'b', {
        type: 'text/plain',
        metadata: { author: 'bob' },
      });

      const names = (
        await fsKeyed.list(`${ROOT}/list/meta`, { filter: { metadata: { author: 'alice' } } })
      ).entries.map((entry) => entry.name);

      expect(names).toEqual(['mine.txt']);

      return;
    });
  });

  it('hides hidden entries by default revealing them with all on R2-only', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/list/hidden/seen.txt`, 'a', { type: 'text/plain' });
      await fsR2.write(`${ROOT}/list/hidden/secret.txt`, 'b', { type: 'text/plain', hidden: true });
      const standard = (await fsR2.list(`${ROOT}/list/hidden`)).entries.map((entry) => entry.name);
      const all = (await fsR2.list(`${ROOT}/list/hidden`, { all: true })).entries.map((entry) => entry.name).sort();

      expect(standard).toEqual(['seen.txt']);
      expect(all).toEqual(['secret.txt', 'seen.txt']);

      return;
    });
  });

  it('hides hidden entries by default revealing them with all on the index', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/list/ihidden/seen.txt`, 'a', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/list/ihidden/secret.txt`, 'b', { type: 'text/plain', hidden: true });
      const standard = (await fsIndexed.list(`${ROOT}/list/ihidden`)).entries.map((entry) => entry.name);
      const all = (await fsIndexed.list(`${ROOT}/list/ihidden`, { all: true })).entries
        .map((entry) => entry.name)
        .sort();

      expect(standard).toEqual(['seen.txt']);
      expect(all).toEqual(['secret.txt', 'seen.txt']);

      return;
    });
  });

  it('lists the R2-only deployment through the standalone fallback', () => {
    return withFs({}, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/list/standalone/solo.txt`, 'solo', { type: 'text/plain' });
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const binary = new IRPCFile({ name: 'blob.bin', size: 4, type: 'application/octet-stream' }, new Blob([bytes]));
      await fsR2.write(`${ROOT}/list/standalone/blob.bin`, binary);

      const names = (await fsR2.list(`${ROOT}/list/standalone`)).entries.map((entry) => entry.name).sort();

      expect(names).toContain('solo.txt');
      expect(names).toContain('blob.bin');

      return;
    });
  });

  it('resolves an omitted path against cwd scope', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/list/cwdscoped/via-cwd.txt`, 'x', { type: 'text/plain' });

      const names = (await fsR2.list(undefined, { cwd: `${ROOT}/list/cwdscoped` })).entries.map((entry) => entry.name);

      expect(names).toContain('via-cwd.txt');

      return;
    });
  });

  it('returns empty entries on the bare adapter safe default', () => {
    return withFs({}, async () => {
      const fsBare = createFs();

      const listed = await fsBare.list(`${ROOT}/list/nothing`);
      const searched = await fsBare.search('nothing');

      expect(listed).toEqual({ entries: [] });
      expect(searched).toEqual({ entries: [] });

      return;
    });
  });
});

describe('fs search', () => {
  it('matches file names scoped to cwd on the index', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsIndexed = createFs({ bucket, indexer: db });
      await fsIndexed.write(`${ROOT}/search/names/quarterly-report.txt`, 'q', { type: 'text/plain' });
      await fsIndexed.write(`${ROOT}/search/names/essay.txt`, 'e', { type: 'text/plain' });

      const names = (await fsIndexed.search('quarterly', { cwd: `${ROOT}/search/names` })).entries.map(
        (entry) => entry.name
      );

      expect(names).toEqual(['quarterly-report.txt']);

      return;
    });
  });

  it('matches configured indexableKeys metadata', () => {
    return withFs({ ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob' }, async () => {
      const fsKeyed = createFs({ bucket, indexer: db, indexableKeys: ['author'] });
      await fsKeyed.write(`${ROOT}/search/keys/a.txt`, 'a', {
        type: 'text/plain',
        metadata: { author: 'carol' },
      });
      await fsKeyed.write(`${ROOT}/search/keys/b.txt`, 'b', {
        type: 'text/plain',
        metadata: { author: 'dave' },
      });

      const names = (await fsKeyed.search('carol', { cwd: `${ROOT}/search/keys` })).entries.map((entry) => entry.name);

      expect(names).toEqual(['a.txt']);

      return;
    });
  });

  it('resolves empty entries for R2-only search without capability', () => {
    return withFs({}, async () => {
      const fsR2 = createFs({ bucket });
      await fsR2.write(`${ROOT}/search/incapable/note.txt`, 'hello', { type: 'text/plain' });

      const result = await fsR2.search('note', { cwd: `${ROOT}/search/incapable` });

      expect(result).toEqual({ entries: [] });

      return;
    });
  });
});

describe('fs list boundaries', () => {
  it('rejects list outside accessRules with EACCES', () => {
    return withFs(
      { ownerId: 'fs-list-bob', homeDir: '/users/fs-list-bob', accessRules: [{ path: '/teams/**', allow: ['read'] }] },
      async () => {
        const fsR2 = createFs({ bucket });

        await expectDenial(() => fsR2.list(`${ROOT}/denied/dir`), 'EACCES', `${ROOT}/denied/dir`);

        return;
      }
    );
  });
});

describe('fs list shared sequence', () => {
  it('writes lists and searches through one warm instance', () => {
    return withFs({ ownerId: 'fs-list-alice', homeDir: '/users/fs-list-alice' }, async () => {
      const fsShared = createFs({ bucket, indexer: db, indexableKeys: ['author'] });
      await fsShared.write(`${ROOT}/shared/alpha.txt`, 'alpha', {
        type: 'text/plain',
        metadata: { author: 'alice' },
      });
      await fsShared.write(`${ROOT}/shared/beta.txt`, 'beta', { type: 'text/plain' });
      const listed = await fsShared.list(`${ROOT}/shared`, { sort: 'name' });
      const found = await fsShared.search('alpha', { cwd: `${ROOT}/shared` });

      expect(listed.entries.map((entry) => entry.name)).toEqual(['alpha.txt', 'beta.txt']);
      expect(found.entries.map((entry) => entry.name)).toEqual(['alpha.txt']);

      return;
    });
  });
});
