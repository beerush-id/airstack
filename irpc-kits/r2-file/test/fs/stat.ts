import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFs } from '../../src/fs/index.js';
import { expectDenial, withFs } from '../helpers.js';

/**
 * Locates the live R2 bucket inside the platform proxy without hardcoding the env key.
 *
 * @param env - Resolved worker env proxy.
 * @returns Live R2Bucket binding.
 */
function findBucket(env: Record<string, unknown>): R2Bucket {
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
      return value as R2Bucket;
    }
  }
  throw new Error('stat.test: no R2Bucket binding found in resolveBinding() env');
}

let bucket!: R2Bucket;
let db!: D1Database;
let ROOT!: string;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  bucket = findBucket(env);
  if (!env.DB) throw new Error('missing D1 binding DB');
  db = env.DB;
  ROOT = '/fsstat';
  await db
    .prepare('DELETE FROM _r2_contents WHERE path LIKE ?')
    .bind(ROOT + '%')
    .run();
  await db
    .prepare('DELETE FROM _r2_files WHERE path LIKE ?')
    .bind(ROOT + '%')
    .run();
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
  await db
    .prepare('DELETE FROM _r2_contents WHERE path LIKE ?')
    .bind(ROOT + '%')
    .run();
  await db
    .prepare('DELETE FROM _r2_files WHERE path LIKE ?')
    .bind(ROOT + '%')
    .run();
});

describe('fs stat descriptors', () => {
  it('stats a file sealing canonical descriptor on R2-only', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/stat/a.txt`;
      await fs.write(canonical, 'hello', { type: 'text/plain' });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.name).toBe('a.txt');
      expect(seen?.size).toBe(5);
      expect(seen?.type).toBe('text/plain');
      expect(seen?.isDirectory).toBe(false);
      return undefined;
    });
  });

  it('stats a file on D1+R2 via the fast path without R2', async () => {
    return withFs({ ownerId: 'fs-stat-alice', homeDir: '/users/fs-stat-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/stat/b.txt`;
      await fs.write(canonical, 'hello', { type: 'text/plain' });
      await bucket.delete(canonical.slice(1));
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.size).toBe(5);
      expect(seen?.isDirectory).toBe(false);
      return undefined;
    });
  });

  it('stats an unindexed R2 object via storage fallback', async () => {
    return withFs({ ownerId: 'fs-stat-bob', homeDir: '/users/fs-stat-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/stat/raw.txt`;
      await bucket.put(canonical.slice(1), 'raw bytes', { httpMetadata: { contentType: 'text/plain' } });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.isDirectory).toBe(false);
      expect(seen?.size).toBe(9);
      return undefined;
    });
  });

  it('stats a directory sealing isDirectory', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/stat/dir`;
      await fs.mkdir(canonical);
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.isDirectory).toBe(true);
      expect(seen?.size).toBe(0);
      return undefined;
    });
  });

  it('stats a binary file sealing byte-exact size', async () => {
    return withFs({ ownerId: 'fs-stat-alice', homeDir: '/users/fs-stat-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const bytes = new Uint8Array(128).map((_, i) => i % 256);
      const input = new IRPCFile(
        { name: 'sized.bin', size: bytes.length, type: 'application/octet-stream' },
        new Blob([bytes], { type: 'application/octet-stream' })
      );
      const canonical = `${ROOT}/stat/sized.bin`;
      await fs.write(canonical, input, { type: 'application/octet-stream' });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.size).toBe(128);
      expect(seen?.isDirectory).toBe(false);
      return undefined;
    });
  });
});

describe('fs exists', () => {
  it('confirms existence true for a file on D1+R2', async () => {
    return withFs({ ownerId: 'fs-stat-alice', homeDir: '/users/fs-stat-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/stat/exists.txt`;
      await fs.write(canonical, 'x', { type: 'text/plain' });
      const seen = await fs.exists(canonical);

      expect(seen).toBe(true);
      return undefined;
    });
  });

  it('confirms existence false for a missing path on R2-only', async () => {
    return withFs({ ownerId: 'fs-stat-bob', homeDir: '/users/fs-stat-bob' }, async () => {
      const fs = createFs({ bucket });
      const seen = await fs.exists(`${ROOT}/stat/ghost.txt`);

      expect(seen).toBe(false);
      return undefined;
    });
  });

  it('confirms existence false for a missing path on D1+R2', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket, indexer: db });
      const seen = await fs.exists(`${ROOT}/stat/ghost2.txt`);

      expect(seen).toBe(false);
      return undefined;
    });
  });
});

describe('fs stat boundaries', () => {
  it('hides soft-deleted files from stat and exists', async () => {
    return withFs({ ownerId: 'fs-stat-alice', homeDir: '/users/fs-stat-alice' }, async () => {
      const fsSoft = createFs({ bucket, indexer: db, softDelete: true });
      const canonical = `${ROOT}/stat/soft.txt`;
      await fsSoft.write(canonical, 'soft', { type: 'text/plain' });
      await fsSoft.remove(canonical);
      const seen = await fsSoft.stat(canonical);
      const found = await fsSoft.exists(canonical);

      expect(seen).toBeUndefined();
      expect(found).toBe(false);
      return undefined;
    });
  });

  it('keeps mountPoint hidden in stat path', async () => {
    return withFs({ ownerId: 'fs-stat-bob', homeDir: '/users/fs-stat-bob' }, async () => {
      const fsMounted = createFs({ bucket, mountPoint: '/tenants/acme' });
      const canonical = `${ROOT}/stat/mounted.txt`;
      await fsMounted.write(canonical, 'acme', { type: 'text/plain' });
      const seen = await fsMounted.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.path).not.toContain('/tenants/acme');
      return undefined;
    });
  });

  it('rejects stat outside accessRules with EACCES', async () => {
    return withFs(
      {
        ownerId: 'fs-stat-alice',
        homeDir: '/users/fs-stat-alice',
        accessRules: [{ path: '/teams/**', allow: ['read'] }],
      },
      async () => {
        const fs = createFs({ bucket, indexer: db });
        const canonical = `${ROOT}/stat/denied.txt`;

        await expectDenial(
          () => {
            return fs.stat(canonical);
          },
          'EACCES',
          canonical
        );

        return undefined;
      }
    );
  });

  it('returns safe defaults on the bare adapter', async () => {
    return withFs({}, async () => {
      const fsBare = createFs();
      const seen = await fsBare.stat(`${ROOT}/stat/bare.txt`);
      const found = await fsBare.exists(`${ROOT}/stat/bare.txt`);

      expect(seen).toBeUndefined();
      expect(found).toBe(false);
      return undefined;
    });
  });
});

describe('fs stat shared instance sequence', () => {
  it('reuses one instance across a write-stat-exists sequence', async () => {
    return withFs({ ownerId: 'fs-stat-bob', homeDir: '/users/fs-stat-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/shared/s.txt`;
      await fs.write(canonical, 's', { type: 'text/plain' });
      const seen = await fs.stat(canonical);
      const found = await fs.exists(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.size).toBe(1);
      expect(found).toBe(true);
      return undefined;
    });
  });
});
