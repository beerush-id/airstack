import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { createContextStore, withContext } from '@irpclib/irpc';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { implement } from '../src/constructor.js';
import { fsContext } from '../src/context.js';
import { copy, exists, list, mkdir, move, read, remove, stat, write } from '../src/index.js';

// Through the public API, as an app calls it: local R2 and D1, a home per test, and the hosts a
// URL is written from mocked. The size limit is small so a stream can run past it cheaply.

/** The largest file the tests' adapter accepts. */
const MAX_SIZE = 64 * 1024;

beforeAll(async () => {
  const env = await resolveBinding<{ DB?: D1Database } & Record<string, unknown>>(undefined, {
    remoteBindings: false,
  });
  const bucket = Object.values(env).find(
    (value) => typeof (value as R2Bucket | null)?.put === 'function' && typeof (value as R2Bucket).head === 'function'
  ) as R2Bucket;
  if (!bucket || !env.DB) throw new Error('url.test: missing the R2 or D1 binding');
  implement({ bucket: bucket as never, indexer: env.DB as never, maxSize: MAX_SIZE });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs `fn` in a home of its own. */
function inHome<T>(fn: () => Promise<T>): Promise<T> {
  const user = `u-${crypto.randomUUID().slice(0, 8)}`;
  return withContext(createContextStore(), () => {
    fsContext.set({ ownerId: user, homeDir: `/users/${user}` });
    return fn();
  });
}

/** Answers fetches by URL prefix, recording what was fetched. */
function mockHosts(routes: Record<string, () => Response>) {
  const fetched: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new Request(input instanceof Request ? input : String(input), init).url;
    fetched.push(url);
    const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    return route ? route[1]() : new Response('not found', { status: 404 });
  });
  return fetched;
}

/** A body of `size` bytes streamed in chunks, with no Content-Length: its size is only known by reading it. */
function streamOf(size: number, chunk = 8 * 1024): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= size) return controller.close();
      const length = Math.min(chunk, size - sent);
      controller.enqueue(new Uint8Array(length).fill(7));
      sent += length;
    },
  });
}

/** A path as long as real ones: a project folder, an asset folder, a file named by a UUID. */
const LONG = '~/Motions/Project A/assets/3f2a9c1e-5b7d-4c2a-9e8f-1a2b3c4d5e6f.jpg';

describe('writing a URL’s content', () => {
  it('stores what a hosted URL serves, typed as the host says', async () => {
    const fetched = mockHosts({
      'https://cdn.test/': () =>
        new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'Content-Type': 'image/jpeg' } }),
    });

    await inHome(async () => {
      const info = await write(LONG, 'https://cdn.test/1.jpg?sig=abc', { encoding: 'url' });

      expect(fetched).toEqual(['https://cdn.test/1.jpg?sig=abc']);
      expect(info).toMatchObject({ size: 4, type: 'image/jpeg' });
      expect(await read(LONG, { encoding: 'base64' })).toBe('AQIDBA==');
    });
  });

  it('stores a body whose length the host doesn’t say', async () => {
    mockHosts({
      'https://cdn.test/': () => new Response(streamOf(20 * 1024), { headers: { 'Content-Type': 'video/mp4' } }),
    });

    await inHome(async () => {
      await write('~/clip.mp4', 'https://cdn.test/clip', { encoding: 'url' });

      expect(await stat('~/clip.mp4')).toMatchObject({ size: 20 * 1024, type: 'video/mp4' });
    });
  });

  it('stores a data URL’s bytes as they are', async () => {
    await inHome(async () => {
      await write('~/pixel.png', 'data:image/png;base64,iVBORw0K', { encoding: 'url' });

      expect(await read('~/pixel.png', { encoding: 'base64' })).toBe('iVBORw0K');
      expect(await stat('~/pixel.png')).toMatchObject({ size: 6, type: 'image/png' });
    });
  });

  it('refuses a body larger than the size limit, even one whose length the host doesn’t say, and keeps nothing', async () => {
    mockHosts({
      'https://cdn.test/said': () =>
        new Response(new Uint8Array(MAX_SIZE + 1), { headers: { 'Content-Type': 'video/mp4' } }),
      'https://cdn.test/unsaid': () =>
        new Response(streamOf(MAX_SIZE + 1), { headers: { 'Content-Type': 'video/mp4' } }),
    });

    await inHome(async () => {
      await expect(write('~/big.mp4', 'https://cdn.test/said', { encoding: 'url' })).rejects.toMatchObject({
        code: 'EFBIG',
      });
      await expect(write('~/big.mp4', 'https://cdn.test/unsaid', { encoding: 'url' })).rejects.toMatchObject({
        code: 'EFBIG',
      });
      expect(await exists('~/big.mp4')).toBe(false);
    });
  });

  it('refuses a URL that isn’t https or data, without fetching it', async () => {
    const fetched = mockHosts({});

    await inHome(async () => {
      for (const url of ['http://cdn.test/1.jpg', 'file:///etc/passwd', 'ftp://cdn.test/1.jpg', 'not a url']) {
        await expect(write('~/x.jpg', url, { encoding: 'url' })).rejects.toMatchObject({ code: 'EINVAL' });
      }
      expect(fetched).toEqual([]);
      expect(await exists('~/x.jpg')).toBe(false);
    });
  });

  it('fails when the host does, and keeps nothing', async () => {
    mockHosts({ 'https://cdn.test/': () => new Response('expired', { status: 403 }) });

    await inHome(async () => {
      await expect(write('~/gone.jpg', 'https://cdn.test/1.jpg', { encoding: 'url' })).rejects.toThrow();
      expect(await exists('~/gone.jpg')).toBe(false);
    });
  });
});

describe('a data URL written with the data-url encoding', () => {
  it('keeps binary bytes as they are', async () => {
    await inHome(async () => {
      await write('~/pixel.png', 'data:image/png;base64,iVBORw0K', { encoding: 'data-url' });

      expect(await read('~/pixel.png', { encoding: 'base64' })).toBe('iVBORw0K');
    });
  });
});

describe('paths as long as real ones', () => {
  it('removes a file', async () => {
    await inHome(async () => {
      await write(LONG, 'x');
      await remove(LONG);

      expect(await exists(LONG)).toBe(false);
    });
  });

  it('removes, lists, moves and copies a folder', async () => {
    const folder = '~/Motions/Project A/assets/3f2a9c1e-5b7d-4c2a-9e8f';
    await inHome(async () => {
      // Folders are entries only once made: writing a file doesn't create the folders above it.
      await mkdir(folder);
      await mkdir(`${folder}/deeper`);
      await write(`${folder}/one.jpg`, 'x');
      await write(`${folder}/deeper/two.jpg`, 'y');

      const listed = await list(folder, { recursive: true });
      expect(listed.entries.map((entry) => entry.name).sort()).toEqual(['deeper', 'one.jpg', 'two.jpg']);

      await copy(folder, `${folder}-copy`);
      expect(await exists(`${folder}-copy/deeper/two.jpg`)).toBe(true);

      await move(`${folder}-copy`, `${folder}-moved`);
      expect(await exists(`${folder}-moved/deeper/two.jpg`)).toBe(true);
      expect(await exists(`${folder}-copy/deeper/two.jpg`)).toBe(false);

      await remove(folder, { recursive: true });
      expect(await exists(`${folder}/deeper/two.jpg`)).toBe(false);
    });
  });
});
