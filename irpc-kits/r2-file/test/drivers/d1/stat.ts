import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/stat.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1stat%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1stat%').run();
});

describe('D1Driver stat and exists', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1stat%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1stat%').run();
  });

  it('stats a file with metadata intact', async () => {
    await withFs({}, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/active.txt', 'stat me', {
        type: 'text/plain',
        metadata: { author: 'charlie' },
      });
      await driver.write(seed, '/d1stat/active.txt', 'stat me', {
        type: 'text/plain',
        metadata: { author: 'charlie' },
      });

      const stat = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(stat, '/d1stat/active.txt');
      await driver.stat(stat, '/d1stat/active.txt');

      expect(stat.result).toBeDefined();
      expect((stat.result as FileInfo).path).toBe('/d1stat/active.txt');
      expect((stat.result as FileInfo).metadata).toEqual({ author: 'charlie' });
    });
  });

  it('resolves target metadata on symlink lookups', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const target = createDriverCtx<FileInfo>();
      await normalize.write(target, '/d1stat/origin.txt', 'hello symlink target', { type: 'text/plain' });
      await driver.write(target, '/d1stat/origin.txt', 'hello symlink target', { type: 'text/plain' });

      const link = createDriverCtx<FileInfo>();
      await normalize.link(link, '/d1stat/origin.txt', '/d1stat/alias.lnk');
      await driver.link(link, '/d1stat/origin.txt', '/d1stat/alias.lnk');

      const stat = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(stat, '/d1stat/alias.lnk');
      await driver.stat(stat, '/d1stat/alias.lnk');

      expect(stat.result).toBeDefined();
      expect((stat.result as FileInfo).size).toBe(20);
      expect((stat.result as FileInfo).type).toBe('text/plain');
      expect((stat.result as FileInfo).link).toBe('/d1stat/origin.txt');
    });
  });

  it('passes through with undefined on nonexistent path', async () => {
    await withFs({}, async () => {
      const stat = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(stat, '/d1stat/missing.txt');
      await driver.stat(stat, '/d1stat/missing.txt');

      expect('result' in stat).toBe(false);
    });
  });

  it('confirms file existence without loading attributes', async () => {
    await withFs({}, async () => {
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/exists.txt', 'check me', { type: 'text/plain' });
      await driver.write(seed, '/d1stat/exists.txt', 'check me', { type: 'text/plain' });

      const hit = createDriverCtx<boolean>();
      await normalize.exists(hit, '/d1stat/exists.txt');
      await driver.exists(hit, '/d1stat/exists.txt');

      expect(hit.result).toBe(true);

      const miss = createDriverCtx<boolean>();
      await normalize.exists(miss, '/d1stat/ghost.txt');
      await driver.exists(miss, '/d1stat/ghost.txt');

      expect('result' in miss).toBe(false);
    });
  });

  it('evaluates exists as false for soft-deleted entries', async () => {
    await withFs({}, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/exists-del.txt', 'bye', { type: 'text/plain' });
      await driver.write(seed, '/d1stat/exists-del.txt', 'bye', { type: 'text/plain' });

      const rem = createDriverCtx<boolean>();
      await normalize.remove(rem, '/d1stat/exists-del.txt');
      await soft.remove(rem, '/d1stat/exists-del.txt');

      const check = createDriverCtx<boolean>();
      await normalize.exists(check, '/d1stat/exists-del.txt');
      await driver.exists(check, '/d1stat/exists-del.txt');

      expect('result' in check).toBe(false);
    });
  });

  it('hides soft-deleted rows from active lookups', async () => {
    await withFs({}, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/trashed.txt', 'trash me', { type: 'text/plain' });
      await driver.write(seed, '/d1stat/trashed.txt', 'trash me', { type: 'text/plain' });

      const removed = createDriverCtx<boolean>();
      await normalize.remove(removed, '/d1stat/trashed.txt', {});
      await soft.remove(removed, '/d1stat/trashed.txt', {});

      expect(removed.result).toBe(true);

      const stat = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(stat, '/d1stat/trashed.txt');
      await driver.stat(stat, '/d1stat/trashed.txt');

      expect('result' in stat).toBe(false);
    });
  });

  it('reveals soft-deleted rows when trash option is explicitly set', async () => {
    await withFs({}, async () => {
      const soft = new D1Driver(db, { softDelete: true });
      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/revealed.txt', 'trash reveal', { type: 'text/plain' });
      await driver.write(seed, '/d1stat/revealed.txt', 'trash reveal', { type: 'text/plain' });

      const removed = createDriverCtx<boolean>();
      await normalize.remove(removed, '/d1suite/stat/revealed.txt', {});
      await soft.remove(removed, '/d1stat/revealed.txt', {});

      const stat = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(stat, '/d1stat/revealed.txt', { trash: true });
      await soft.stat(stat, '/d1stat/revealed.txt', { trash: true });

      expect(stat.result).toBeDefined();
      expect((stat.result as FileInfo).path).toBe('/d1stat/revealed.txt');
    });
  });

  it('resolves dangling and soft-deleted symlink targets falling back to link row attributes', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const soft = new D1Driver(db, { softDelete: true });

      const linkCtx = createDriverCtx<FileInfo>();
      await normalize.link(linkCtx, '/d1stat/broken-target.txt', '/d1stat/dangling.lnk');
      await driver.link(linkCtx, '/d1stat/broken-target.txt', '/d1stat/dangling.lnk');

      const statDangling = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(statDangling, '/d1stat/dangling.lnk');
      await driver.stat(statDangling, '/d1stat/dangling.lnk');

      expect(statDangling.result?.type).toBe('inode/symlink');
      expect(statDangling.result?.link).toBe('/d1stat/broken-target.txt');

      const seed = createDriverCtx<FileInfo>();
      await normalize.write(seed, '/d1stat/target-to-trash.txt', 'content', { type: 'text/plain' });
      await driver.write(seed, '/d1stat/target-to-trash.txt', 'content', { type: 'text/plain' });

      const linkToTrash = createDriverCtx<FileInfo>();
      await normalize.link(linkToTrash, '/d1stat/target-to-trash.txt', '/d1stat/link-to-trash.lnk');
      await driver.link(linkToTrash, '/d1stat/target-to-trash.txt', '/d1stat/link-to-trash.lnk');

      const remTarget = createDriverCtx<boolean>();
      await normalize.remove(remTarget, '/d1stat/target-to-trash.txt');
      await soft.remove(remTarget, '/d1stat/target-to-trash.txt');

      const statTrashLink = createDriverCtx<FileInfo | undefined>();
      await normalize.stat(statTrashLink, '/d1stat/link-to-trash.lnk');
      await driver.stat(statTrashLink, '/d1stat/link-to-trash.lnk');

      expect(statTrashLink.result?.type).toBe('inode/symlink');
    });
  });
});
