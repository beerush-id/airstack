import type { D1Database } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { D1Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import type { FileInfo } from '../../../src/types.js';
import { expectDenial, withFs } from '../../helpers.js';

let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>();
  if (!env.DB) throw new Error('d1/base.test: missing D1 binding DB from resolveBinding');
  db = env.DB;
}, 120_000);

afterAll(async () => {
  if (typeof db === 'undefined') return;
  await db.prepare('DELETE FROM _r2_contents WHERE path LIKE ?').bind('/d1base%').run();
  await db.prepare('DELETE FROM _r2_files WHERE path LIKE ?').bind('/d1base%').run();
});

describe('D1Driver identity and lifecycle contract', () => {
  let normalize!: NormalizerDriver;
  let driver!: D1Driver;

  beforeEach(() => {
    normalize = new NormalizerDriver();
    driver = new D1Driver(db);
  });

  it('exposes every lifecycle operation', () => {
    expect(typeof driver.mkdir).toBe('function');
    expect(typeof driver.write).toBe('function');
    expect(typeof driver.read).toBe('function');
    expect(typeof driver.stat).toBe('function');
    expect(typeof driver.exists).toBe('function');
    expect(typeof driver.list).toBe('function');
    expect(typeof driver.search).toBe('function');
    expect(typeof driver.copy).toBe('function');
    expect(typeof driver.move).toBe('function');
    expect(typeof driver.link).toBe('function');
    expect(typeof driver.remove).toBe('function');
    expect(typeof driver.restore).toBe('function');
  });

  it('leaves accessRules gating to the pipeline head', async () => {
    const ctx = createDriverCtx<FileInfo>();

    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      return normalize.write(ctx, '/d1base/identity/direct.txt', 'x', { type: 'text/plain' });
    });
    await withFs(
      { ownerId: 'alice', homeDir: '/users/alice', accessRules: [{ path: '/elsewhere/**', allow: ['write'] }] },
      async () => {
        return driver.write(ctx, '/d1base/identity/direct.txt', 'x', { type: 'text/plain' });
      }
    );

    expect('result' in ctx).toBe(true);
  });

  it('rejects paths outside accessRules at the pipeline head', async () => {
    await withFs(
      { ownerId: 'alice', homeDir: '/users/alice', accessRules: [{ path: '/teams/**', allow: ['write'] }] },
      async () => {
        const ctx = createDriverCtx<FileInfo>();

        await expectDenial(
          () => {
            return normalize.write(ctx, '/d1base/denied/a.txt', 'x', { type: 'text/plain' });
          },
          'EACCES',
          '/d1base/denied/a.txt'
        );

        expect('result' in ctx).toBe(false);
      }
    );
  });
});

describe('D1Driver tenancy and schema migration', () => {
  let normalize!: NormalizerDriver;

  beforeEach(() => {
    normalize = new NormalizerDriver();
  });

  it('binds the owner identity to the configured column', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const keyed = new D1Driver(db, { ownerKey: 'tenant_id' });
      const ctx = createDriverCtx<FileInfo>();

      await normalize.write(ctx, '/d1base/identity/owned.txt', 'x', { type: 'text/plain' });
      await keyed.write(ctx, '/d1base/identity/owned.txt', 'x', { type: 'text/plain' });

      const row = await db
        .prepare('SELECT tenant_id AS owner FROM _r2_files WHERE path = ?')
        .bind('/d1base/identity/owned.txt')
        .first<{ owner: unknown }>();

      expect(row?.owner).toBe('alice');
    });
  });

  it('prefers onBehalf over ownerId when recording tenancy', async () => {
    await withFs({ ownerId: 'alice', onBehalf: 'tenant-42', homeDir: '/users/alice' }, async () => {
      const keyed = new D1Driver(db, { ownerKey: 'tenant_id' });
      const ctx = createDriverCtx<FileInfo>();

      await normalize.write(ctx, '/d1base/identity/behalf.txt', 'x', { type: 'text/plain' });
      await keyed.write(ctx, '/d1base/identity/behalf.txt', 'x', { type: 'text/plain' });

      const row = await db
        .prepare('SELECT tenant_id AS owner FROM _r2_files WHERE path = ?')
        .bind('/d1base/identity/behalf.txt')
        .first<{ owner: unknown }>();

      expect(row?.owner).toBe('tenant-42');
    });
  });

  it('initializes cleanly without ownerKey column', async () => {
    const unkeyed = new D1Driver(db, { ownerKey: '' });
    const ctx = createDriverCtx<FileInfo>();
    await normalize.write(ctx, '/d1base/identity/unkeyed.txt', 'unkeyed', { type: 'text/plain' });
    await unkeyed.write(ctx, '/d1base/identity/unkeyed.txt', 'unkeyed', { type: 'text/plain' });
    expect(ctx.result?.path).toBe('/d1base/identity/unkeyed.txt');
  });

  it('handles repeated ensureSchema calls and existing columns idempotently', async () => {
    const d1 = new D1Driver(db, { ownerKey: 'user_id' });
    const ctx = createDriverCtx<FileInfo>();
    await normalize.mkdir(ctx, '/d1base/identity/idemp');
    await d1.mkdir(ctx, '/d1base/identity/idemp');
    expect(ctx.result?.path).toBe('/d1base/identity/idemp');
  });
});

describe('D1Driver resilience and error propagation', () => {
  it('handles concurrent ensureSchema and write calls without race conditions', async () => {
    const normalize = new NormalizerDriver();
    const freshDriver = new D1Driver(db, { ownerKey: 'tenant_id' });
    const paths = Array.from({ length: 10 }, (_, i) => `/d1base/concurrent/file-${i}.txt`);

    await Promise.all(
      paths.map(async (p, idx) => {
        const ctx = createDriverCtx<FileInfo>();
        await normalize.write(ctx, p, `payload ${idx}`, { type: 'text/plain' });
        await freshDriver.write(ctx, p, `payload ${idx}`, { type: 'text/plain' });
        expect(ctx.result?.path).toBe(p);
      })
    );

    const check = await db
      .prepare('SELECT count(*) AS total FROM _r2_files WHERE path LIKE ?')
      .bind('/d1base/concurrent%')
      .first<{ total: number }>();
    expect(check?.total).toBe(10);
  });

  it('propagates underlying database query failures as catchable errors', async () => {
    const failingDb = {
      prepare() {
        return {
          bind() {
            return this;
          },
          first: async () => {
            throw new Error('D1_SIMULATED_FAILURE: disk I/O error');
          },
          all: async () => {
            throw new Error('D1_SIMULATED_FAILURE: disk I/O error');
          },
          run: async () => {
            throw new Error('D1_SIMULATED_FAILURE: disk I/O error');
          },
        };
      },
    } as unknown as D1Database;

    const brokenDriver = new D1Driver(failingDb);
    const ctx = createDriverCtx<FileInfo>();

    await expect(brokenDriver.write(ctx, '/d1base/fail/write.txt', 'content', { type: 'text/plain' })).rejects.toThrow(
      'D1_SIMULATED_FAILURE'
    );
  });
});
