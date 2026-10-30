import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import fs, {
  configure,
  copy,
  exists,
  link,
  list,
  mkdir,
  move,
  read,
  remove,
  restore,
  search,
  stat,
  transport,
  write,
} from '../../src/index.js';
import { withFs } from '../helpers.js';

let bucket!: R2Bucket;
let db!: D1Database;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/index: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/index: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
}, 120_000);

describe('client surface — completeness', () => {
  it('exports every lifecycle operation as a callable stub', () => {
    expect(typeof mkdir).toBe('function');
    expect(typeof write).toBe('function');
    expect(typeof read).toBe('function');
    expect(typeof stat).toBe('function');
    expect(typeof exists).toBe('function');
    expect(typeof list).toBe('function');
    expect(typeof search).toBe('function');
    expect(typeof copy).toBe('function');
    expect(typeof move).toBe('function');
    expect(typeof link).toBe('function');
    expect(typeof remove).toBe('function');
    expect(typeof restore).toBe('function');
    expect(typeof configure).toBe('function');
  });

  it('bundles the full lifecycle on the default export', () => {
    expect(typeof fs.configure).toBe('function');
    expect(typeof fs.mkdir).toBe('function');
    expect(typeof fs.write).toBe('function');
    expect(typeof fs.read).toBe('function');
    expect(typeof fs.stat).toBe('function');
    expect(typeof fs.exists).toBe('function');
    expect(typeof fs.list).toBe('function');
    expect(typeof fs.search).toBe('function');
    expect(typeof fs.copy).toBe('function');
    expect(typeof fs.move).toBe('function');
    expect(typeof fs.link).toBe('function');
    expect(typeof fs.remove).toBe('function');
    expect(typeof fs.restore).toBe('function');
  });
});

describe('client surface — configure', () => {
  it('accepts a full client config and leaves local execution intact', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      configure({ baseUrl: 'https://files.example.com', endpoint: '/irpc', apiKey: 'client-key' });
      implement({ bucket, indexer: db });

      await write('~/i-configure/notes.txt', 'hello');
      const result = await read('~/i-configure/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
    });
  });

  it('points the transport at the remote origin with trailing slashes stripped', () => {
    configure({ baseUrl: 'https://files.example.com///' });

    expect(transport.config.baseURL).toBe('https://files.example.com');
  });

  it('returns the transport to same-origin with an empty baseUrl', () => {
    configure({ baseUrl: '' });

    expect(transport.config.baseURL).toBe('');
  });

  it('overrides the RPC endpoint', () => {
    configure({ endpoint: '/rpc/files' });

    expect(transport.config.endpoint).toBe('/rpc/files');
  });

  it('keeps a lookup for its max age, and asks again once it is turned off', async () => {
    await withFs({ ownerId: 'alice', homeDir: '/users/alice' }, async () => {
      implement({ bucket, indexer: db });
      const path = '~/i-configure/kept.txt';
      await write(path, 'one');

      configure({ maxAge: { read: 60_000 } });
      expect(await read(path, { encoding: 'text' })).toBe('one');
      await write(path, 'two');
      // Kept: answered without asking the filesystem again.
      expect(await read(path, { encoding: 'text' })).toBe('one');

      configure({ maxAge: { read: 0 } });
      expect(await read(path, { encoding: 'text' })).toBe('two');
    });
  });
});
