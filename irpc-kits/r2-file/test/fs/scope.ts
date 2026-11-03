import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
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
  throw new Error('scope.test: no R2Bucket binding found in resolveBinding() env');
}

const ALICE = 'fs-scope-alice';
const ALICE_HOME = '/users/fs-scope-alice';
const BOB = 'fs-scope-bob';
const BOB_HOME = '/users/fs-scope-bob';

let bucket!: R2Bucket;
let db!: D1Database;

type Fs = ReturnType<typeof createFs>;

let fsR2!: Fs;
let fsIndexed!: Fs;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  bucket = findBucket(env);
  if (!env.DB) throw new Error('scope.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
  fsR2 = createFs({ bucket });
  fsIndexed = createFs({ bucket, indexer: db });

  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/fsscope%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/fsscope%').run();
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/users/fs-scope-alice%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/users/fs-scope-alice%').run();
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/home/scope-%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/home/scope-%').run();

  for (const prefix of ['fsscope', 'users/fs-scope-alice', 'home/scope-']) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor });
      if (page.objects.length > 0) {
        await bucket.delete(page.objects.map((object) => object.key));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor !== undefined);
  }
}, 120_000);

afterAll(async () => {
  if (typeof bucket !== 'undefined') {
    for (const prefix of ['fsscope', 'users/fs-scope-alice', 'home/scope-']) {
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, cursor });
        if (page.objects.length > 0) {
          await bucket.delete(page.objects.map((object) => object.key));
        }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor !== undefined);
    }
  }
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/fsscope%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/fsscope%').run();
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/users/fs-scope-alice%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/users/fs-scope-alice%').run();
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/home/scope-%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/home/scope-%').run();
});

describe('fs home scoping', () => {
  it('tilde expands to the active custom homeDir', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      await fsR2.write('~/scope-tilde.txt', 'tilde-content', { type: 'text/plain' });
      const info = await fsR2.stat('/users/fs-scope-alice/scope-tilde.txt');
      const text = await fsR2.read('~/scope-tilde.txt', { encoding: 'text' });

      expect(info?.path).toBe('/users/fs-scope-alice/scope-tilde.txt');
      expect(text).toBe('tilde-content');
    });
  });

  it('tilde falls back to /home on the open system without a homeDir', () => {
    return withFs({}, async () => {
      await fsR2.write('~/scope-home-default.txt', 'default-home-content', { type: 'text/plain' });
      const info = await fsR2.stat('/home/scope-home-default.txt');

      expect(info?.path).toBe('/home/scope-home-default.txt');
    });
  });
});

describe('fs canonical sharing', () => {
  it('alice publishes through a canonical absolute path governed by rules', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/fsscope/shared/**'] }, async () => {
      await fsR2.write('/fsscope/shared/spec.md', 'shared-v1', { type: 'text/plain' });
      const info = await fsR2.stat('/fsscope/shared/spec.md');
      const text = await fsR2.read('/fsscope/shared/spec.md', { encoding: 'text' });

      expect(info?.path).toBe('/fsscope/shared/spec.md');
      expect(text).toBe('shared-v1');
    });
  });

  it('bob consumes the canonical file alice published', () => {
    return withFs({ ownerId: BOB, homeDir: BOB_HOME, accessRules: ['/fsscope/shared/**'] }, async () => {
      const text = await fsR2.read('/fsscope/shared/spec.md', { encoding: 'text' });

      expect(text).toBe('shared-v1');
    });
  });
});

describe('fs relative resolution', () => {
  it('relative paths resolve against the explicit cwd option', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      await fsR2.write('scope-cwd-note.txt', 'cwd-content', {
        type: 'text/plain',
        cwd: '/users/fs-scope-alice/scope-cwddir',
      });
      const info = await fsR2.stat('/users/fs-scope-alice/scope-cwddir/scope-cwd-note.txt');

      expect(info?.path).toBe('/users/fs-scope-alice/scope-cwddir/scope-cwd-note.txt');
    });
  });

  it('relative paths fall back to homeDir when no cwd is given', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      await fsR2.write('scope-fallback.txt', 'fallback-content', { type: 'text/plain' });
      const info = await fsR2.stat('/users/fs-scope-alice/scope-fallback.txt');

      expect(info?.path).toBe('/users/fs-scope-alice/scope-fallback.txt');
    });
  });

  it('dot segments normalize before storage', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      await fsR2.write('scope-dots/sub/../dots.txt', 'dots-content', { type: 'text/plain' });
      const info = await fsR2.stat('/users/fs-scope-alice/scope-dots/dots.txt');

      expect(info?.path).toBe('/users/fs-scope-alice/scope-dots/dots.txt');
    });
  });

  it('traversal past home is preserved then gated with EACCES', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/users/fs-scope-alice/**'] }, async () => {
      await expectDenial(
        () => fsR2.write('~/../../scope-escape.txt', 'escape-content', { type: 'text/plain' }),
        'EACCES',
        "'/scope-escape.txt' outside accessRules",
        '/scope-escape.txt'
      );
    });
  });
});

describe('fs accessRules patterns', () => {
  it('exact paths match only themselves', () => {
    return withFs(
      {
        ownerId: ALICE,
        homeDir: ALICE_HOME,
        accessRules: [{ path: '/fsscope/scope-exact/only.txt', allow: ['write', 'read'] }],
      },
      async () => {
        await fsR2.write('/fsscope/scope-exact/only.txt', 'exact-content', { type: 'text/plain' });

        expect(await fsR2.read('/fsscope/scope-exact/only.txt', { encoding: 'text' })).toBe('exact-content');
        await expectDenial(
          () => fsR2.write('/fsscope/scope-exact/other.txt', 'other-content', { type: 'text/plain' }),
          'EACCES',
          "'/fsscope/scope-exact/other.txt' outside accessRules",
          '/fsscope/scope-exact/other.txt'
        );
      }
    );
  });

  it('shallow stars match immediate children only', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/fsscope/scope-shallow/*'] }, async () => {
      await fsR2.write('/fsscope/scope-shallow/child.txt', 'child-content', { type: 'text/plain' });

      expect(await fsR2.exists('/fsscope/scope-shallow/child.txt')).toBe(true);
      await expectDenial(
        () => fsR2.write('/fsscope/scope-shallow/nested/deep.txt', 'deep-content', { type: 'text/plain' }),
        'EACCES',
        "'/fsscope/scope-shallow/nested/deep.txt' outside accessRules",
        '/fsscope/scope-shallow/nested/deep.txt'
      );
    });
  });

  it('recursive stars match the directory and all descendants', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/fsscope/scope-deep/**'] }, async () => {
      await fsIndexed.mkdir('/fsscope/scope-deep');
      await fsIndexed.write('/fsscope/scope-deep/a/b/c.txt', 'deep-content', { type: 'text/plain' });
      const dir = await fsIndexed.stat('/fsscope/scope-deep');
      const nested = await fsIndexed.stat('/fsscope/scope-deep/a/b/c.txt');

      expect(dir?.path).toBe('/fsscope/scope-deep');
      expect(nested?.path).toBe('/fsscope/scope-deep/a/b/c.txt');
    });
  });

  it('the universal rule authorizes every canonical path', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/**'] }, async () => {
      await fsR2.write('/fsscope/scope-anywhere/deep.txt', 'anywhere-content', { type: 'text/plain' });
      const info = await fsR2.stat('/fsscope/scope-anywhere/deep.txt');

      expect(info?.path).toBe('/fsscope/scope-anywhere/deep.txt');
    });
  });

  it('operations outside the allow list deny even on matching paths', () => {
    return withFs(
      {
        ownerId: ALICE,
        homeDir: ALICE_HOME,
        accessRules: [{ path: '/fsscope/scope-ops/**', allow: ['write'] }],
      },
      async () => {
        const info = await fsR2.write('/fsscope/scope-ops/note.txt', 'ops-content', { type: 'text/plain' });

        expect(info.path).toBe('/fsscope/scope-ops/note.txt');
        await expectDenial(
          () => fsR2.read('/fsscope/scope-ops/note.txt', { encoding: 'text' }),
          'EACCES',
          "Operation 'read' not permitted",
          '/fsscope/scope-ops/note.txt'
        );
      }
    );
  });
});

describe('fs tenancy', () => {
  it('a tenant mount isolates storage and never leaks the mountPoint', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      const fsTenant = createFs({ bucket, mountPoint: '/tenants/acme' });
      await fsTenant.write('~/scope-tenant.txt', 'tenant-content', { type: 'text/plain' });
      const info = await fsTenant.stat('~/scope-tenant.txt');
      const leaked = await fsR2.stat('/users/fs-scope-alice/scope-tenant.txt');
      const removed = await fsTenant.remove('~/scope-tenant.txt');

      expect(info?.path).toBe('/users/fs-scope-alice/scope-tenant.txt');
      expect(leaked).toBeUndefined();
      expect(removed).toBe(true);
      expect(await fsTenant.exists('~/scope-tenant.txt')).toBe(false);
    });
  });

  it('two tenants run a full isolated cycle on the same canonical path', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME }, async () => {
      const fsAcme = createFs({ bucket, mountPoint: '/tenants/acme' });
      const fsGlobex = createFs({ bucket, mountPoint: '/tenants/globex' });
      await fsAcme.write('/fsscope/scope-mt/shared.txt', 'acme-data', { type: 'text/plain' });
      const text = await fsAcme.read('/fsscope/scope-mt/shared.txt', { encoding: 'text' });
      const foreign = await fsGlobex.stat('/fsscope/scope-mt/shared.txt');
      const removed = await fsAcme.remove('/fsscope/scope-mt/shared.txt');

      expect(text).toBe('acme-data');
      expect(foreign).toBeUndefined();
      expect(await fsGlobex.exists('/fsscope/scope-mt/shared.txt')).toBe(false);
      expect(removed).toBe(true);
    });
  });
});

describe('fs bare wiring', () => {
  it('the bare adapter gates scope before storage and returns safe query defaults', () => {
    return withFs({ ownerId: ALICE, homeDir: ALICE_HOME, accessRules: ['/users/fs-scope-alice/**'] }, async () => {
      const bare = createFs();
      await expectDenial(
        () => bare.write('/fsscope/scope-bare/escape.txt', 'escape-content', { type: 'text/plain' }),
        'EACCES',
        "'/fsscope/scope-bare/escape.txt' outside accessRules",
        '/fsscope/scope-bare/escape.txt'
      );
      const listing = await bare.list('/users/fs-scope-alice/scope-bare');
      const found = await bare.search('bare', { cwd: '/users/fs-scope-alice/scope-bare' });

      expect(listing).toEqual({ entries: [] });
      expect(found).toEqual({ entries: [] });
      expect(await bare.exists('/users/fs-scope-alice/scope-bare/nothing.txt')).toBe(false);
      expect(await bare.stat('/users/fs-scope-alice/scope-bare/nothing.txt')).toBeUndefined();
      expect(await bare.read('/users/fs-scope-alice/scope-bare/nothing.txt')).toBeUndefined();
    });
  });
});
