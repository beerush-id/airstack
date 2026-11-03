import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { envCtx } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { exists, read, write } from '../src/index.js';
import { createWorker } from '../src/worker.js';
import { withFs } from './helpers.js';

// A worker is made once, at module level, before any request: a Worker only gets its bindings
// with a request, so the worker must find them in the call's environment.
createWorker();

let env!: { BUCKET: R2Bucket; DB: D1Database };

beforeAll(async () => {
  env = await resolveBinding<{ BUCKET: R2Bucket; DB: D1Database }>();
}, 120_000);

describe('worker made without bindings', () => {
  it('finds R2 and D1 in the call’s environment, so in-process calls work too', async () => {
    await withFs({ ownerId: 'erin', homeDir: '/users/erin' }, async () => {
      envCtx.set(env);

      await write('~/env/note.txt', 'from the request');

      expect(await exists('~/env/note.txt')).toBe(true);
      expect(await read('~/env/note.txt', { encoding: 'text' })).toBe('from the request');
    });
  });

  it('fails a call that carries no bindings, rather than writing nowhere', async () => {
    await withFs({ ownerId: 'erin', homeDir: '/users/erin' }, async () => {
      await expect(write('~/env/lost.txt', 'x')).rejects.toThrow(/No (BUCKET|DB) binding/);
    });
  });
});
