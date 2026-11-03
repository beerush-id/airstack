import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { createCredentials, envCtx, IRPC_BASE_CONTEXT, setContext } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { read, remove, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/security: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/security: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('security — homeDir scoping', () => {
  it('confines ~ writes to the acting identity home', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });

      const info = await write('~/sec-scope/notes.txt', 'alice private');

      expect(info.path).toBe('/users/alice/sec-scope/notes.txt');
    });
  });

  it('denies alice writing into another user home without a rule — EACCES', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => write('/users/bob/sec-scope/planted.txt', 'intruder'),
        'EACCES',
        'accessRules',
        '/users/bob/sec-scope/planted.txt'
      );
    });
  });
});

describe('security — identity isolation', () => {
  it('keeps one identity from reading another home without a rule — EACCES', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      await write('~/sec-iso/private.txt', 'alice private');
    });

    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => read('/users/alice/sec-iso/private.txt', { encoding: 'text' }),
        'EACCES',
        'accessRules',
        '/users/alice/sec-iso/private.txt'
      );
    });
  });

  it('grants read across homes only through an explicit rule', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      await write('~/sec-share/public.txt', 'alice shared');
    });

    await withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/users/alice/sec-share/**', allow: ['read'] }] },
      async () => {
        implement({ bucket, indexer: db });

        const result = await read('/users/alice/sec-share/public.txt', { encoding: 'text' });

        expect(result).toBe('alice shared');
      }
    );
  });

  it('gates per operation — a read-only rule still denies remove', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      await write('~/sec-op/public.txt', 'alice shared');
    });

    await withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/users/alice/sec-op/**', allow: ['read'] }] },
      async () => {
        implement({ bucket, indexer: db });

        await expectDenial(
          () => remove('/users/alice/sec-op/public.txt'),
          'EACCES',
          'not permitted',
          '/users/alice/sec-op/public.txt'
        );
      }
    );
  });
});

describe('security — API key perimeter', () => {
  it('rejects a mutation whose credential does not match FILE_API_KEY', async () => {
    await withFs({}, async () => {
      envCtx.set({ FILE_API_KEY: 'test-key' });
      setContext(IRPC_BASE_CONTEXT.CREDENTIALS, createCredentials([['apiKey', 'wrong-key']]));
      implement({ bucket, indexer: db });

      await expect(write('~/sec-key/notes.txt', 'hello')).rejects.toThrow('Unauthorized: Valid API key required');
    });
  });

  it('rejects a query whose credential does not match FILE_API_KEY — no read-shaped gap', async () => {
    await withFs({}, async () => {
      envCtx.set({ FILE_API_KEY: 'test-key' });
      setContext(IRPC_BASE_CONTEXT.CREDENTIALS, createCredentials([['apiKey', 'wrong-key']]));
      implement({ bucket, indexer: db });

      await expect(read('~/sec-key/notes.txt', { encoding: 'text' })).rejects.toThrow(
        'Unauthorized: Valid API key required'
      );
    });
  });

  it('accepts every call carrying the configured key', async () => {
    await withFs({}, async () => {
      envCtx.set({ FILE_API_KEY: 'test-key' });
      setContext(IRPC_BASE_CONTEXT.CREDENTIALS, createCredentials([['apiKey', 'test-key']]));
      implement({ bucket, indexer: db });

      const info = await write('~/sec-key/notes.txt', 'hello');
      const content = await read('~/sec-key/notes.txt', { encoding: 'text' });

      expect(info.path).toBe('/home/sec-key/notes.txt');
      expect(content).toBe('hello');
    });
  });
});
