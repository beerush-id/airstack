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
  throw new Error('link.test: no R2Bucket binding found in resolveBinding() env');
}

const OWNER = 'fs-link-alice';
const HOME = '/fslink/home';
const ROOT = '/fslink';

let bucket!: R2Bucket;
let db!: D1Database;

type Fs = ReturnType<typeof createFs>;

let fsR2!: Fs;
let fsIndexed!: Fs;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  bucket = findBucket(env);
  if (!env.DB) throw new Error('link.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
  fsR2 = createFs({ bucket });
  fsIndexed = createFs({ bucket, indexer: db });

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
  if (typeof bucket !== 'undefined') {
    const prefix = ROOT.slice(1);
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor });
      if (page.objects.length > 0) {
        await bucket.delete(page.objects.map((object) => object.key));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor !== undefined);
  }
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind(`${ROOT}%`).run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind(`${ROOT}%`).run();
});

describe('fs link creation', () => {
  it('seals a symlink FileInfo on the R2-only topology', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsR2.write('/fslink/home/l1/target.txt', 'link-l1-content', { type: 'text/plain' });
      const info = await fsR2.link('/fslink/home/l1/target.txt', '/fslink/home/l1/alias.txt');

      expect(info.path).toBe('/fslink/home/l1/alias.txt');
      expect(info.link).toBe('/fslink/home/l1/target.txt');
      expect(info.type).toBe('inode/symlink');
      expect(info.isDirectory).toBe(false);
    });
  });

  it('stat through the alias resolves live target metadata on the index', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsIndexed.write('/fslink/home/l2/target.txt', 'link-l2-live-content', { type: 'text/plain' });
      await fsIndexed.link('/fslink/home/l2/target.txt', '/fslink/home/l2/alias.txt');
      const target = await fsIndexed.stat('/fslink/home/l2/target.txt');
      const alias = await fsIndexed.stat('/fslink/home/l2/alias.txt');

      expect(alias?.link).toBe('/fslink/home/l2/target.txt');
      expect(alias?.type).toBe('text/plain');
      expect(alias?.size).toBe(target?.size);
    });
  });

  it('rewriting the target refreshes alias metadata without stale reads', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsIndexed.write('/fslink/home/l3/target.txt', 'link-l3-version-one', { type: 'text/plain' });
      await fsIndexed.link('/fslink/home/l3/target.txt', '/fslink/home/l3/alias.txt');
      const stale = await fsIndexed.stat('/fslink/home/l3/alias.txt');
      await fsIndexed.write('/fslink/home/l3/target.txt', 'link-l3-version-two-extended', { type: 'text/plain' });
      const fresh = await fsIndexed.stat('/fslink/home/l3/alias.txt');
      const text = await fsIndexed.read('/fslink/home/l3/alias.txt', { encoding: 'text' });

      expect(fresh?.size).not.toBe(stale?.size);
      expect(fresh?.size).toBe((await fsIndexed.stat('/fslink/home/l3/target.txt'))?.size);
      expect(text).toBe('link-l3-version-two-extended');
    });
  });

  it('reads through the alias return target bytes on the R2-only topology', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsR2.write('/fslink/home/l4/target.txt', 'link-l4-readable-content', { type: 'text/plain' });
      await fsR2.link('/fslink/home/l4/target.txt', '/fslink/home/l4/alias.txt');
      const text = await fsR2.read('/fslink/home/l4/alias.txt', { encoding: 'text' });

      expect(text).toBe('link-l4-readable-content');
    });
  });

  it('directory listings on the index expose the alias as a link entry', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsIndexed.write('/fslink/home/l5/target.txt', 'link-l5-listed-content', { type: 'text/plain' });
      await fsIndexed.link('/fslink/home/l5/target.txt', '/fslink/home/l5/alias.txt');
      const result = await fsIndexed.list('/fslink/home/l5');

      expect(result.entries.map((entry) => entry.name).sort()).toEqual(['alias.txt', 'target.txt']);
      expect(result.entries.find((entry) => entry.name === 'alias.txt')?.link).toBe('/fslink/home/l5/target.txt');
    });
  });

  it('unlinking the alias keeps the target intact', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsR2.write('/fslink/home/l6/target.txt', 'link-l6-kept-content', { type: 'text/plain' });
      await fsR2.link('/fslink/home/l6/target.txt', '/fslink/home/l6/alias.txt');
      const removed = await fsR2.remove('/fslink/home/l6/alias.txt');

      expect(removed).toBe(true);
      expect(await fsR2.exists('/fslink/home/l6/alias.txt')).toBe(false);
      expect(await fsR2.stat('/fslink/home/l6/alias.txt')).toBeUndefined();
      expect(await fsR2.read('/fslink/home/l6/target.txt', { encoding: 'text' })).toBe('link-l6-kept-content');
    });
  });

  it('unlinking the alias on the index keeps the target intact', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await fsIndexed.write('/fslink/home/l6-idx/target.txt', 'link-l6-idx-content', { type: 'text/plain' });
      await fsIndexed.link('/fslink/home/l6-idx/target.txt', '/fslink/home/l6-idx/alias.txt');
      const removed = await fsIndexed.remove('/fslink/home/l6-idx/alias.txt');

      expect(removed).toBe(true);
      expect(await fsIndexed.exists('/fslink/home/l6-idx/alias.txt')).toBe(false);
      expect(await fsIndexed.stat('/fslink/home/l6-idx/alias.txt')).toBeUndefined();
      expect(await fsIndexed.read('/fslink/home/l6-idx/target.txt', { encoding: 'text' })).toBe('link-l6-idx-content');
    });
  });
});

describe('fs link boundaries', () => {
  it('denies EACCES when the alias path leaves the authorized scope', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/fslink/home/**'] }, async () => {
      await fsR2.write('/fslink/home/l7/target.txt', 'link-l7-content', { type: 'text/plain' });

      await expectDenial(
        () => fsR2.link('/fslink/home/l7/target.txt', '/fslink/l7/alias.txt'),
        'EACCES',
        "'/fslink/l7/alias.txt' outside accessRules",
        '/fslink/l7/alias.txt'
      );
    });
  });

  it('denies EACCES when the target leaves the authorized scope', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/fslink/home/**'] }, async () => {
      await expectDenial(
        () => fsR2.link('/fslink/l8/target.txt', '/fslink/home/l8/alias.txt'),
        'EACCES',
        "'/fslink/l8/target.txt' outside accessRules",
        '/fslink/l8/target.txt'
      );
    });
  });

  it('the bare adapter rejects link creation with EIO when no storage driver handles it', () => {
    return withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
      await expectDenial(
        () => createFs().link('/fslink/home/l9/target.txt', '/fslink/home/l9/alias.txt'),
        'EIO',
        'link'
      );
    });
  });
});
