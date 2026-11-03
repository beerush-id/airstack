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
  throw new Error('read.test: no R2Bucket binding found in resolveBinding() env');
}

let bucket!: R2Bucket;
let db!: D1Database;
let ROOT!: string;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  bucket = findBucket(env);
  if (!env.DB) throw new Error('missing D1 binding DB');
  db = env.DB;
  ROOT = '/fsread';
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

describe('fs read consumption', () => {
  it('reads default blob round-trip on R2-only', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/read/r2.txt`;
      await fs.write(canonical, 'hello read', { type: 'text/plain' });
      const blob = await fs.read(canonical);

      expect(await blob?.text()).toBe('hello read');
      return undefined;
    });
  });

  it('reads default blob round-trip from D1 inline', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/read/inlined.txt`;
      await fs.write(canonical, 'inline bytes', { type: 'text/plain' });
      const blob = await fs.read(canonical);

      expect(await blob?.text()).toBe('inline bytes');
      return undefined;
    });
  });

  it('reads default blob round-trip spilled from R2', async () => {
    return withFs({ ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const bytes = new TextEncoder().encode('spilled-bytes');
      const input = new IRPCFile(
        { name: 'spill.bin', size: bytes.length, type: 'application/octet-stream' },
        new Blob([bytes], { type: 'application/octet-stream' })
      );
      const canonical = `${ROOT}/read/spill.bin`;
      await fs.write(canonical, input, { type: 'application/octet-stream' });
      const blob = await fs.read(canonical);

      expect(await blob?.text()).toBe('spilled-bytes');
      return undefined;
    });
  });

  it('returns undefined for a missing file on R2-only', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket });
      const seen = await fs.read(`${ROOT}/read/ghost-r2.txt`);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });

  it('returns undefined for a missing file on D1+R2', async () => {
    return withFs({ ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const seen = await fs.read(`${ROOT}/read/ghost-indexed.txt`);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });

  it('returns undefined for a directory', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/read/dir`;
      await fs.mkdir(canonical);
      const seen = await fs.read(canonical);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });

  it('returns undefined for a soft-deleted file on R2-only', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket, softDelete: true });
      const canonical = `${ROOT}/read/soft-r2.txt`;
      await fs.write(canonical, 'soft r2', { type: 'text/plain' });
      await fs.remove(canonical);
      const seen = await fs.read(canonical);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });

  it('returns undefined for a soft-deleted file on D1+R2', async () => {
    return withFs({ ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db, softDelete: true });
      const canonical = `${ROOT}/read/soft-idx.txt`;
      await fs.write(canonical, 'soft idx', { type: 'text/plain' });
      await fs.remove(canonical);
      const seen = await fs.read(canonical);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });

  it('returns undefined for a broken symlink', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket });
      const target = `${ROOT}/read/broken-target.txt`;
      const alias = `${ROOT}/read/broken-alias.txt`;
      await fs.link(target, alias);
      const seen = await fs.read(alias);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });
});

describe('fs read encodings', () => {
  it('decodes text encoding', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/read/text.txt`;
      await fs.write(canonical, 'hello text', { type: 'text/plain' });
      const seen = await fs.read(canonical, { encoding: 'text' });

      expect(seen).toBe('hello text');
      return undefined;
    });
  });

  it('decodes json encoding', async () => {
    return withFs({ ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/read/data.json`;
      await fs.write(canonical, { hello: 'world' }, { type: 'application/json' });
      const seen = await fs.read(canonical, { encoding: 'json' });

      expect(seen).toEqual({ hello: 'world' });
      return undefined;
    });
  });

  it('decodes base64 encoding', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/read/b64.txt`;
      await fs.write(canonical, 'hello', { type: 'text/plain' });
      const seen = await fs.read(canonical, { encoding: 'base64' });

      expect(seen).toBe('aGVsbG8=');
      return undefined;
    });
  });

  it('decodes data-url encoding with stored type prefix', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/read/url.txt`;
      await fs.write(canonical, 'hello', { type: 'text/plain' });
      const seen = await fs.read(canonical, { encoding: 'data-url' });

      expect(seen?.startsWith('data:text/plain;base64,')).toBe(true);
      expect(seen).toContain('aGVsbG8=');
      return undefined;
    });
  });

  it('keeps write and read encodings independent', async () => {
    return withFs({ ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/read/indep.json`;
      await fs.write(canonical, { v: 42 }, { type: 'application/json' });
      const asText = await fs.read(canonical, { encoding: 'text' });
      const asJson = await fs.read(canonical, { encoding: 'json' });

      expect(asText).toContain('42');
      expect(asJson).toEqual({ v: 42 });
      return undefined;
    });
  });
});

describe('fs read boundaries', () => {
  it('rejects encoded read exceeding maxEncodingSize while default stays open', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fsWriter = createFs({ bucket, indexer: db });
      const fsSmall = createFs({ bucket, indexer: db, maxEncodingSize: 8 });
      const canonical = `${ROOT}/read/big.txt`;
      await fsWriter.write(canonical, 'x'.repeat(64), { type: 'text/plain' });

      await expectDenial(
        () => {
          return fsSmall.read(canonical, { encoding: 'text' });
        },
        'EFBIG',
        '64'
      );

      expect(await (await fsSmall.read(canonical))?.text()).toBe('x'.repeat(64));
      return undefined;
    });
  });

  it('rejects read outside accessRules with EACCES', async () => {
    return withFs(
      { ownerId: 'fs-read-bob', homeDir: '/users/fs-read-bob', accessRules: [{ path: '/teams/**', allow: ['read'] }] },
      async () => {
        const fs = createFs({ bucket });
        const canonical = `${ROOT}/read/denied.txt`;

        await expectDenial(
          () => {
            return fs.read(canonical);
          },
          'EACCES',
          canonical
        );

        return undefined;
      }
    );
  });

  it('returns undefined on the bare adapter safe default', async () => {
    return withFs({}, async () => {
      const fsBare = createFs();
      const seen = await fsBare.read(`${ROOT}/read/bare.txt`);

      expect(seen).toBeUndefined();
      return undefined;
    });
  });
});

describe('fs read shared instance sequence', () => {
  it('reuses one instance across a write-read-encoded sequence', async () => {
    return withFs({ ownerId: 'fs-read-alice', homeDir: '/users/fs-read-alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/shared/seq.txt`;
      await fs.write(canonical, 'seq bytes', { type: 'text/plain' });
      const blob = await fs.read(canonical);
      const text = await fs.read(canonical, { encoding: 'text' });

      expect(await blob?.text()).toBe('seq bytes');
      expect(text).toBe('seq bytes');
      return undefined;
    });
  });
});
