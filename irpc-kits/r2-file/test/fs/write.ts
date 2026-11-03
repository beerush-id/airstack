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
  throw new Error('write.test: no R2Bucket binding found in resolveBinding() env');
}

let bucket!: R2Bucket;
let db!: D1Database;
let ROOT!: string;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  bucket = findBucket(env);
  if (!env.DB) throw new Error('missing D1 binding DB');
  db = env.DB;
  ROOT = '/fswrite';
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

describe('fs write FileInput', () => {
  it('writes a string on R2-only sealing canonical FileInfo', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/str-r2.txt`;
      const info = await fs.write(canonical, 'hello', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(info.name).toBe('str-r2.txt');
      expect(info.size).toBe(5);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      return undefined;
    });
  });

  it('writes a string on D1+R2 sealing canonical FileInfo', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/write/str-indexed.txt`;
      const info = await fs.write(canonical, 'hello', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(info.size).toBe(5);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
      expect(await db.prepare('SELECT path FROM _r2_files WHERE path = ?').bind(canonical).first()).not.toBeNull();
      return undefined;
    });
  });

  it('writes an IRPCFile binary on R2-only with byte-exact size', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fs = createFs({ bucket });
      const bytes = new Uint8Array(512).map((_, i) => i % 256);
      const input = new IRPCFile(
        { name: 'bin-r2.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );
      const canonical = `${ROOT}/write/bin-r2.png`;
      const info = await fs.write(canonical, input, { type: 'image/png' });

      expect(info.path).toBe(canonical);
      expect(info.size).toBe(512);
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      expect((await bucket.head(canonical.slice(1)))?.size).toBe(512);
      return undefined;
    });
  });

  it('writes an IRPCFile binary on D1+R2 spilling to R2', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const bytes = new Uint8Array(256).map((_, i) => i % 256);
      const input = new IRPCFile(
        { name: 'bin-indexed.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );
      const canonical = `${ROOT}/write/bin-indexed.png`;
      const info = await fs.write(canonical, input, { type: 'image/png' });

      expect(info.path).toBe(canonical);
      expect(info.size).toBe(256);
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      expect(await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()).toBeNull();
      return undefined;
    });
  });

  it('writes a JSON object sealing application/json type', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/write/obj.json`;
      const info = await fs.write(canonical, { hello: 'world' }, { type: 'application/json' });

      expect(info.path).toBe(canonical);
      expect(info.type).toBe('application/json');
      expect(info.size).toBeGreaterThan(0);
      expect(info.isDirectory).toBe(false);
      return undefined;
    });
  });

  it('writes a JSON array sealing application/json type', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/arr.json`;
      const info = await fs.write(canonical, [1, 2, 3], { type: 'application/json' });

      expect(info.path).toBe(canonical);
      expect(info.type).toBe('application/json');
      expect(info.size).toBeGreaterThan(0);
      return undefined;
    });
  });
});

describe('fs write tiering', () => {
  it('caches small text in D1 and stores it canonically in R2', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/write/inlined.txt`;
      const info = await fs.write(canonical, 'hello inline', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(
        await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()
      ).not.toBeNull();
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      return undefined;
    });
  });

  it('spills binary to R2 skipping D1 contents', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const bytes = new Uint8Array(512).map((_, i) => i % 256);
      const input = new IRPCFile(
        { name: 'spilled.png', size: bytes.length, type: 'image/png' },
        new Blob([bytes], { type: 'image/png' })
      );
      const canonical = `${ROOT}/write/spilled.png`;
      const info = await fs.write(canonical, input, { type: 'image/png' });

      expect(info.path).toBe(canonical);
      expect(await db.prepare('SELECT path FROM _r2_files WHERE path = ?').bind(canonical).first()).not.toBeNull();
      expect(await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      return undefined;
    });
  });
});

describe('fs write options', () => {
  it('preserves metadata round-trip through stat', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/write/meta.txt`;
      await fs.write(canonical, 'a', { type: 'text/plain', metadata: { author: 'alice' } });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.metadata).toMatchObject({ author: 'alice' });
      return undefined;
    });
  });

  it('preserves public flag through stat', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/pub.txt`;
      await fs.write(canonical, 'pub', { type: 'text/plain', public: true });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.public).toBe(true);
      return undefined;
    });
  });

  it('preserves hidden flag through stat', async () => {
    return withFs({}, async () => {
      const fs = createFs({ bucket, indexer: db });
      const canonical = `${ROOT}/write/hid.txt`;
      await fs.write(canonical, 'hid', { type: 'text/plain', hidden: true });
      const seen = await fs.stat(canonical);

      expect(seen?.path).toBe(canonical);
      expect(seen?.hidden).toBe(true);
      return undefined;
    });
  });

  it('writes to nested paths without explicit mkdir', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/nested/deep/note.txt`;
      const info = await fs.write(canonical, 'deep', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(await bucket.head(canonical.slice(1))).not.toBeNull();
      return undefined;
    });
  });
});

describe('fs write denials', () => {
  it('rejects unapproved MIME with EINVAL leaving no residue', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fsGuarded = createFs({ bucket, indexer: db, allowedTypes: ['application/pdf'] });
      const canonical = `${ROOT}/write/denied-type.txt`;

      await expectDenial(
        () => {
          return fsGuarded.write(canonical, 'x', { type: 'text/plain' });
        },
        'EINVAL',
        'text/plain'
      );

      expect(await db.prepare('SELECT path FROM _r2_files WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await bucket.head(canonical.slice(1))).toBeNull();
      return undefined;
    });
  });

  it('rejects malformed MIME with EINVAL leaving no residue', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/bad-mime.txt`;

      await expectDenial(
        () => {
          return fs.write(canonical, 'x', { type: 'not-a-mime' });
        },
        'EINVAL',
        'not-a-mime'
      );

      expect(await bucket.head(canonical.slice(1))).toBeNull();
      return undefined;
    });
  });

  it('rejects oversized payload with EFBIG via maxSize leaving no residue', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fsTiny = createFs({ bucket, indexer: db, maxSize: 4 });
      const canonical = `${ROOT}/write/too-big.txt`;

      await expectDenial(
        () => {
          return fsTiny.write(canonical, 'x'.repeat(64), { type: 'text/plain' });
        },
        'EFBIG',
        '64'
      );

      expect(await db.prepare('SELECT path FROM _r2_files WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await bucket.head(canonical.slice(1))).toBeNull();
      return undefined;
    });
  });

  it('rejects encoded payload exceeding maxEncodingSize with EFBIG leaving no residue', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fsSmall = createFs({ bucket, indexer: db, maxEncodingSize: 8 });
      const canonical = `${ROOT}/write/too-encoded.txt`;

      await expectDenial(
        () => {
          return fsSmall.write(canonical, 'x'.repeat(64), { type: 'text/plain', encoding: 'text' });
        },
        'EFBIG',
        '64'
      );

      expect(await db.prepare('SELECT path FROM _r2_files WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await db.prepare('SELECT content FROM _r2_contents WHERE path = ?').bind(canonical).first()).toBeNull();
      expect(await bucket.head(canonical.slice(1))).toBeNull();
      return undefined;
    });
  });

  it('rejects write outside accessRules with EACCES', async () => {
    return withFs(
      { ownerId: 'alice', homeDir: '/users/alice', accessRules: [{ path: '/teams/**', allow: ['write'] }] },
      async () => {
        const fs = createFs({ bucket });
        const canonical = `${ROOT}/write/denied.txt`;

        await expectDenial(
          () => {
            return fs.write(canonical, 'x', { type: 'text/plain' });
          },
          'EACCES',
          canonical
        );

        expect(await bucket.head(canonical.slice(1))).toBeNull();
        return undefined;
      }
    );
  });

  it('rejects write with disallowed operation with EACCES', async () => {
    return withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/fswrite/**', allow: ['read'] }] },
      async () => {
        const fs = createFs({ bucket, indexer: db });
        const canonical = `${ROOT}/write/op-denied.txt`;

        await expectDenial(
          () => {
            return fs.write(canonical, 'x', { type: 'text/plain' });
          },
          'EACCES',
          canonical
        );

        return undefined;
      }
    );
  });

  it('rejects write on the bare adapter with EIO', async () => {
    return withFs({}, async () => {
      const fsBare = createFs();
      const canonical = `${ROOT}/write/bare.txt`;

      await expectDenial(
        () => {
          return fsBare.write(canonical, 'x', { type: 'text/plain' });
        },
        'EIO',
        'write'
      );

      return undefined;
    });
  });
});

describe('fs write boundaries', () => {
  it('keeps mountPoint hidden returning canonical path', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fsMounted = createFs({ bucket, mountPoint: '/tenants/acme' });
      const canonical = `${ROOT}/write/mounted.txt`;
      const info = await fsMounted.write(canonical, 'acme', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(info.path).not.toContain('/tenants/acme');
      expect(await bucket.head(`/tenants/acme${canonical}`.slice(1))).not.toBeNull();
      expect(await bucket.head(canonical.slice(1))).toBeNull();
      return undefined;
    });
  });

  it('overwrites an existing file sealing latest bytes', async () => {
    return withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const fs = createFs({ bucket });
      const canonical = `${ROOT}/write/over.txt`;
      await fs.write(canonical, 'v1', { type: 'text/plain' });
      const info = await fs.write(canonical, 'version two', { type: 'text/plain' });

      expect(info.path).toBe(canonical);
      expect(info.size).toBe(11);
      expect(await (await bucket.get(canonical.slice(1)))?.text()).toBe('version two');
      return undefined;
    });
  });
});

describe('fs write shared instance sequence', () => {
  it('reuses one instance across a write-write-stat sequence', async () => {
    return withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const fs = createFs({ bucket, indexer: db });
      const first = `${ROOT}/shared/a.txt`;
      const second = `${ROOT}/shared/b.txt`;
      const firstInfo = await fs.write(first, 'a', { type: 'text/plain' });
      const secondInfo = await fs.write(second, 'b', { type: 'text/plain' });
      const overwritten = await fs.write(first, 'aa', { type: 'text/plain' });
      const seen = await fs.stat(first);

      expect(firstInfo.path).toBe(first);
      expect(secondInfo.path).toBe(second);
      expect(overwritten.size).toBe(2);
      expect(seen?.path).toBe(first);
      expect(seen?.size).toBe(2);
      return undefined;
    });
  });
});
