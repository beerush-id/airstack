import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { DriverContext, FileInfo } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/sequence.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1warm%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1warm%').run();
});

describe('D1Driver shared instance sequence', () => {
  let normalize!: NormalizerDriver;
  let warm!: D1Driver;

  beforeAll(async () => {
    normalize = new NormalizerDriver();
    warm = new D1Driver(db);
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1warm%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1warm%').run();
  });

  afterAll(async () => {
    await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1warm%').run();
    await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1warm%').run();
  });

  it('writes and reads through one instance', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const first: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(first, '/d1warm/note.txt', 'v1', { type: 'text/plain' });
      await warm.write(first, '/d1warm/note.txt', 'v1', { type: 'text/plain' });

      const read: DriverContext<string> = createDriverCtx();
      await normalize.read(read, '/d1warm/note.txt', { encoding: 'text' });
      await warm.read(read, '/d1warm/note.txt', { encoding: 'text' });

      expect(read.result).toBe('v1');
    });
  });

  it('serves the overwrite, never the stale bytes', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const second: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(second, '/d1warm/note.txt', 'version two', { type: 'text/plain' });
      await warm.write(second, '/d1warm/note.txt', 'version two', { type: 'text/plain' });

      const read: DriverContext<string> = createDriverCtx();
      await normalize.read(read, '/d1warm/note.txt', { encoding: 'text' });
      await warm.read(read, '/d1warm/note.txt', { encoding: 'text' });

      expect(read.result).toBe('version two');

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/d1warm/note.txt');
      await warm.stat(stat, '/d1warm/note.txt');

      expect((stat.result as FileInfo).size).toBe(11);
    });
  });

  it('confirms absence after removal through the same instance', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob' }, async () => {
      const removed: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removed, '/d1warm/note.txt');
      await warm.remove(removed, '/d1warm/note.txt');

      expect(removed.result).toBe(true);

      const stat: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stat, '/d1warm/note.txt');
      await warm.stat(stat, '/d1warm/note.txt');

      expect('result' in stat).toBe(false);
    });
  });
});
