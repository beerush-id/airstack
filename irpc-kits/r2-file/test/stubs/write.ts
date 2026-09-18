import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { IRPCFile } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { createFs } from '../../src/fs/index.js';
import { FS_CONFIG, write } from '../../src/index.js';
import { expectDenial, withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/write: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/write: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('write stub — multi-tenant system, options entrance', () => {
  it('writes a text string and returns FileInfo with the canonical path, mount invisible', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await write('~/w-tenant/notes.txt', 'hello');

      expect(info.path).toBe('/users/alice/w-tenant/notes.txt');
      expect(info.name).toBe('notes.txt');
      expect(info.size).toBe(5);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
      expect(info.mtime).toBeInstanceOf(Date);
    });
  });

  it('writes a JSON object with no options and types it as application/json', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await write('~/w-tenant/config.json', { retries: 3 });

      expect(info.path).toBe('/users/alice/w-tenant/config.json');
      expect(info.name).toBe('config.json');
      expect(info.type).toBe('application/json');
      expect(info.isDirectory).toBe(false);
    });
  });

  it('types an array input as application/json when no explicit type is given', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await write('~/w-tenant/list.json', [1, 2, 3]);

      expect(info.path).toBe('/users/alice/w-tenant/list.json');
      expect(info.name).toBe('list.json');
      expect(info.type).toBe('application/json');
      expect(info.isDirectory).toBe(false);
    });
  });

  it('writes binary bytes encapsulated in IRPCFile', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
      const file = new IRPCFile({ name: 'avatar.png', size: blob.size, type: 'image/png' }, blob);

      const info = await write('~/w-tenant/avatar.png', file);

      expect(info.path).toBe('/users/alice/w-tenant/avatar.png');
      expect(info.name).toBe('avatar.png');
      expect(info.size).toBe(4);
      expect(info.type).toBe('image/png');
    });
  });

  it('persists caller metadata on the returned FileInfo', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db, mountPoint: '/tenants/acme' });

      const info = await write('~/w-tenant/tagged.txt', 'hello', { metadata: { tag: 'invoice' } });

      expect(info.path).toBe('/users/alice/w-tenant/tagged.txt');
      expect(info.metadata).toEqual({ tag: 'invoice' });
    });
  });
});

describe('write stub — user-scoped system', () => {
  it('writes to a shared canonical path when an access rule allows it', async () => {
    await withFs(
      { ownerId: 'bob', homeDir: '/users/bob', accessRules: [{ path: '/shared/**', allow: ['write', 'read'] }] },
      async () => {
        implement({ bucket, indexer: db });

        const info = await write('/shared/w-user/team-notes.txt', 'hello team');

        expect(info.path).toBe('/shared/w-user/team-notes.txt');
        expect(info.size).toBe(10);
      }
    );
  });

  it('denies a write outside home with no matching rule — EACCES across the wire', async () => {
    await withFs({ ownerId: 'bob', homeDir: '/users/bob', accessRules: [] }, async () => {
      implement({ bucket, indexer: db });

      await expectDenial(
        () => write('/private/w-user/carol-secret.txt', 'stolen'),
        'EACCES',
        'accessRules',
        '/private/w-user/carol-secret.txt'
      );
    });
  });
});

describe('write stub — open system', () => {
  it('expands ~ to the default home with no identity configured', async () => {
    await withFs({}, async () => {
      implement({ bucket });

      const info = await write('~/w-open/notes.txt', 'hello');

      expect(info.path).toBe('/home/w-open/notes.txt');
      expect(info.size).toBe(5);
    });
  });
});

describe('write stub — wiring variations carry the same contract', () => {
  it('serves the identical contract over R2-only wiring', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket });

      const info = await write('~/w-r2only/notes.txt', 'hello');

      expect(info.path).toBe('/users/alice/w-r2only/notes.txt');
      expect(info.size).toBe(5);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
    });
  });

  it('serves through a caller-built adapter handed to the adapter entrance', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      const adapter = createFs({ bucket, indexer: db });
      implement({ adapter });

      const info = await write('~/w-adapter/notes.txt', 'hello');

      expect(info.path).toBe('/users/alice/w-adapter/notes.txt');
      expect(info.size).toBe(5);
      expect(info.type).toBe('text/plain');
      expect(info.isDirectory).toBe(false);
    });
  });
});

describe('write stub — client-side size gates reject before upload', () => {
  it('rejects an IRPCFile larger than FS_CONFIG.maxSize before upload', async () => {
    await withFs({}, async () => {
      const previous = FS_CONFIG.maxSize;
      FS_CONFIG.maxSize = 10;
      try {
        const blob = new Blob([new Uint8Array(20).fill(7)], { type: 'application/octet-stream' });
        const file = new IRPCFile({ name: 'big.bin', size: 20, type: 'application/octet-stream' }, blob);

        await expect(write('~/w-client-gate/big.bin', file)).rejects.toThrow('File size exceeds limit');
      } finally {
        FS_CONFIG.maxSize = previous;
      }
    });
  });

  it('accepts an IRPCFile exactly at FS_CONFIG.maxSize', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      const previous = FS_CONFIG.maxSize;
      FS_CONFIG.maxSize = 20;
      try {
        const blob = new Blob([new Uint8Array(20).fill(7)], { type: 'application/octet-stream' });
        const file = new IRPCFile({ name: 'edge.bin', size: 20, type: 'application/octet-stream' }, blob);

        const info = await write('~/w-client-gate/edge.bin', file);

        expect(info.path).toBe('/home/w-client-gate/edge.bin');
        expect(info.size).toBe(20);
      } finally {
        FS_CONFIG.maxSize = previous;
      }
    });
  });

  it('gates an IRPCFile by its declared size, not its actual bytes', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      const previous = FS_CONFIG.maxSize;
      FS_CONFIG.maxSize = 10;
      try {
        const blob = new Blob([new Uint8Array(20).fill(7)], { type: 'application/octet-stream' });
        const lyingFile = new IRPCFile({ name: 'lying.bin', size: 5, type: 'application/octet-stream' }, blob);

        const info = await write('~/w-client-gate/lying.bin', lyingFile);

        expect(info.path).toBe('/home/w-client-gate/lying.bin');
        expect(info.size).toBe(20);
      } finally {
        FS_CONFIG.maxSize = previous;
      }
    });
  });

  it('rejects a string larger than FS_CONFIG.maxEncodingSize before upload', async () => {
    await withFs({}, async () => {
      const previous = FS_CONFIG.maxEncodingSize;
      FS_CONFIG.maxEncodingSize = 10;
      try {
        await expect(write('~/w-client-gate/long.txt', '0123456789ABCDE')).rejects.toThrow('File size exceeds limit');
      } finally {
        FS_CONFIG.maxEncodingSize = previous;
      }
    });
  });

  it('accepts a string exactly at FS_CONFIG.maxEncodingSize', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      const previous = FS_CONFIG.maxEncodingSize;
      FS_CONFIG.maxEncodingSize = 15;
      try {
        const info = await write('~/w-client-gate/edge.txt', '012345678901234');

        expect(info.path).toBe('/home/w-client-gate/edge.txt');
        expect(info.size).toBe(15);
      } finally {
        FS_CONFIG.maxEncodingSize = previous;
      }
    });
  });

  it('gates a string by character length, letting multi-byte content through to the wire', async () => {
    await withFs({}, async () => {
      implement({ bucket, indexer: db });
      const previous = FS_CONFIG.maxEncodingSize;
      FS_CONFIG.maxEncodingSize = 16;
      try {
        const info = await write('~/w-client-gate/emoji.txt', '😀😀😀😀😀😀😀😀');

        expect(info.path).toBe('/home/w-client-gate/emoji.txt');
        expect(info.size).toBe(32);
      } finally {
        FS_CONFIG.maxEncodingSize = previous;
      }
    });
  });
});

describe('write stub — constraint gates reject before storage', () => {
  it('rejects an oversized payload with EFBIG when maxSize is configured', async () => {
    await withFs({}, async () => {
      implement({ bucket, maxSize: 10 });

      await expectDenial(() => write('~/w-big/notes.txt', '0123456789ABCDE'), 'EFBIG', 'exceeds maxSize');
    });
  });

  it('rejects an oversized encoded payload with EFBIG when maxEncodingSize is configured', async () => {
    await withFs({}, async () => {
      implement({ bucket, maxEncodingSize: 10 });

      await expectDenial(
        () => write('~/w-big/data.json', { payload: '0123456789ABCDEF' }),
        'EFBIG',
        'maxEncodingSize'
      );
    });
  });

  it('rejects a type outside allowedTypes with EINVAL', async () => {
    await withFs({}, async () => {
      implement({ bucket, allowedTypes: ['image/*'] });

      await expectDenial(
        () => write('~/w-type/notes.txt', 'hello'),
        'EINVAL',
        "Unsupported MIME type 'text/plain'"
      );
    });
  });
});
