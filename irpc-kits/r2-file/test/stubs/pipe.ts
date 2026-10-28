import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { createContextStore, SESSION_STORE, withContext } from '@irpclib/irpc';
import { createLifecycle, mutable } from '@irpclib/irpc/core';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { beforeAll, describe, expect, it } from 'vitest';
import { implement } from '../../src/constructor.js';
import { fsContext } from '../../src/context.js';
import {
  createPipe,
  PERSIST_DELAY,
  type PersistentOptions,
  type PipeData,
  persistent,
  read,
  write,
} from '../../src/index.js';

let bucket!: R2Bucket;
let db!: D1Database;

/** The context key the tests keep the session ID under. */
const SESSION = 'pipe-test-session';

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket; DB?: D1Database } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('stubs/pipe: missing R2 binding BUCKET from resolveBinding');
  if (!env.DB) throw new Error('stubs/pipe: missing D1 binding DB from resolveBinding');
  bucket = env.BUCKET;
  db = env.DB;
  SESSION_STORE.key(SESSION);
}, 120_000);

/** A user unique to this run, so tests never share files, even with what local R2 kept. */
const newUser = () => `u-${crypto.randomUUID().slice(0, 8)}`;

/** Runs `fn` as one of the user's sessions, in their home. */
function inSession<T>(user: string, session: string, fn: () => T): Promise<T> {
  return withContext(createContextStore([[SESSION, session]]), async () => {
    fsContext.set({ ownerId: user, homeDir: `/users/${user}` });
    implement({ bucket, indexer: db });
    return fn();
  });
}

/**
 * Opens a live file in a session. Its context stays open until `close`, as a page's does while the
 * file is shown, then the file's scope is cleaned up and what it still sends is let through.
 */
async function open<T>(
  user: string,
  session: string,
  path: string,
  encoding?: 'text' | 'json',
  options?: PersistentOptions
) {
  let close!: () => void;
  const closed = new Promise<void>((resolve) => {
    close = resolve;
  });
  const file = await new Promise<PipeData<T>>((opened) => {
    void inSession(user, session, async () => {
      const life = createLifecycle();
      opened(life.run(() => persistent<T>(path, encoding, options)));
      await closed;
      life.destroy();
      await settle();
    });
  });
  return { file, close };
}

/** Waits until `check` holds, failing after `timeout` ms. */
async function until(check: () => boolean, timeout = 3000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Waits past the write delay, so whatever was scheduled has been written. */
const settle = () => new Promise((resolve) => setTimeout(resolve, PERSIST_DELAY + 200));

describe('persistent — a file kept as live state', () => {
  it('reads the file once, as JSON, and marks it ready', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/profile.json', { name: 'Ana' }));

    const { file, close } = await open<{ name: string }>(user, 's1', '~/profile.json', 'json');
    await until(() => file.ready === true);

    expect(file.content).toEqual({ name: 'Ana' });
    close();
  });

  it('reads as text by default, and is ready with no content when the file doesn’t exist yet', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/note.txt', 'hello'));

    const note = await open<string>(user, 's1', '~/note.txt');
    const missing = await open<string>(user, 's1', '~/missing.txt');
    await until(() => note.file.ready === true && missing.file.ready === true);

    expect(note.file.content).toBe('hello');
    expect(missing.file.content).toBeUndefined();
    note.close();
    missing.close();
  });

  it('writes the content once the changes stop, creating the file when it is new', async () => {
    const user = newUser();
    const { file, close } = await open<{ theme: string }>(user, 's1', '~/settings.json', 'json');
    await until(() => file.ready === true);

    // Changed outside the session's context, as a page would: the pipe still writes in the user's home.
    file.content = { theme: 'dark' };
    file.content.theme = 'glass';
    await settle();

    expect(await inSession(user, 's1', () => read('~/settings.json', { encoding: 'json' }))).toEqual({
      theme: 'glass',
    });
    close();
  });

  it('passes a change to every other live copy of the file in the session, and to no other session', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/shared.txt', 'v1'));
    const a = await open<string>(user, 's1', '~/shared.txt');
    const b = await open<string>(user, 's1', '~/shared.txt');
    const other = await open<string>(user, 's2', '~/shared.txt');
    const elsewhere = await open<string>(user, 's1', '~/elsewhere.txt');
    await until(() => [a, b, other, elsewhere].every(({ file }) => file.ready === true));

    a.file.content = 'v2';
    await until(() => b.file.content === 'v2');
    await settle();

    expect(other.file.content).toBe('v1');
    expect(elsewhere.file.content).toBeUndefined();
    for (const { close } of [a, b, other, elsewhere]) close();
  });

  it('passes a change only to copies kept in the same encoding', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/doc.json', { v: 1 }));
    const json = await open<{ v: number }>(user, 's1', '~/doc.json', 'json');
    const text = await open<string>(user, 's1', '~/doc.json', 'text');
    await until(() => json.file.ready === true && text.file.ready === true);
    const before = text.file.content;

    json.file.content = { v: 2 };
    await settle();

    expect(text.file.content).toBe(before);
    json.close();
    text.close();
  });

  it('never writes back a change it took from another copy', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/echo.txt', 'v1'));
    const a = await open<string>(user, 's1', '~/echo.txt');
    const b = await open<string>(user, 's1', '~/echo.txt');
    await until(() => a.file.ready === true && b.file.ready === true);

    a.file.content = 'v2';
    await until(() => b.file.content === 'v2');
    // Written around the pipes: an echo from b would overwrite it with v2.
    await inSession(user, 's1', () => write('~/echo.txt', 'v3'));
    await settle();

    expect(await inSession(user, 's1', () => read('~/echo.txt', { encoding: 'text' }))).toBe('v3');
    a.close();
    b.close();
  });

  it('writes a change still waiting when it closes', async () => {
    const user = newUser();
    const { file, close } = await open<string>(user, 's1', '~/flush.txt');
    await until(() => file.ready === true);

    file.content = 'last words';
    close();
    await settle();

    expect(await inSession(user, 's1', () => read('~/flush.txt', { encoding: 'text' }))).toBe('last words');
  });

  it('writes nothing before the file is read, or when nothing changed', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/quiet.txt', 'kept'));
    const { file, close } = await open<string>(user, 's1', '~/quiet.txt');
    await until(() => file.ready === true);
    await inSession(user, 's1', () => write('~/quiet.txt', 'changed around it'));
    await settle();

    expect(await inSession(user, 's1', () => read('~/quiet.txt', { encoding: 'text' }))).toBe('changed around it');
    close();
  });
});

describe('persistent — autosave', () => {
  const readText = (user: string, path: string) => inSession(user, 's1', () => read(path, { encoding: 'text' }));

  it('writes nothing while autosave is off', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/draft.txt', 'v1'));
    const { file, close } = await open<string>(user, 's1', '~/draft.txt', 'text', { autosave: false });
    await until(() => file.ready === true);

    file.content = 'unsaved';
    await settle();

    expect(await readText(user, '~/draft.txt')).toBe('v1');
    close();
    await settle();
    expect(await readText(user, '~/draft.txt')).toBe('v1');
  });

  it('writes again from the next change once turned back on, never what changed while off', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/toggle.txt', 'v1'));
    const options = mutable<PersistentOptions>({ autosave: false });
    const { file, close } = await open<string>(user, 's1', '~/toggle.txt', 'text', options);
    await until(() => file.ready === true);

    file.content = 'while off';
    await settle();
    options.autosave = true;
    await settle();
    expect(await readText(user, '~/toggle.txt')).toBe('v1');

    file.content = 'after on';
    await settle();
    expect(await readText(user, '~/toggle.txt')).toBe('after on');
    close();
  });

  it('drops a write still waiting when turned off', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/late.txt', 'v1'));
    const options = mutable<PersistentOptions>({ autosave: true });
    const { file, close } = await open<string>(user, 's1', '~/late.txt', 'text', options);
    await until(() => file.ready === true);

    file.content = 'changed';
    options.autosave = false;
    await settle();

    expect(await readText(user, '~/late.txt')).toBe('v1');
    close();
  });

  it('writes after the delay it is given', async () => {
    const user = newUser();
    const { file, close } = await open<string>(user, 's1', '~/quick.txt', 'text', { autosave: 20 });
    await until(() => file.ready === true);

    file.content = 'quick';

    // Written well before the default delay would have let it.
    const started = Date.now();
    let written: string | undefined;
    while (written !== 'quick' && Date.now() - started < PERSIST_DELAY) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      written = await readText(user, '~/quick.txt');
    }
    expect(written).toBe('quick');
    close();
  });

  it('takes in no other copy’s write while autosave is off', async () => {
    const user = newUser();
    await inSession(user, 's1', () => write('~/shared-off.txt', 'v1'));
    const writer = await open<string>(user, 's1', '~/shared-off.txt');
    const reader = await open<string>(user, 's1', '~/shared-off.txt', 'text', { autosave: false });
    await until(() => writer.file.ready === true && reader.file.ready === true);

    writer.file.content = 'v2';
    await settle();

    expect(reader.file.content).toBe('v1');
    writer.close();
    reader.close();
  });
});

describe('createPipe — the live call behind persistent', () => {
  it('fails outside a session', async () => {
    const user = newUser();
    await withContext(createContextStore(), async () => {
      fsContext.set({ ownerId: user, homeDir: `/users/${user}` });
      implement({ bucket, indexer: db });
      await expect(createPipe('~/a.txt')).rejects.toThrow('No session in the current context');
    });
  });

  it('starts not ready, then carries the file’s content', async () => {
    const user = newUser();
    await inSession(user, 's1', async () => {
      await write('~/p.txt', 'piped');
      const pipe = createPipe('~/p.txt');

      expect((pipe.data as PipeData).ready).not.toBe(true);
      await until(() => {
        if (pipe.status === 'error') throw pipe.error;
        return pipe.data?.ready === true;
      });
      expect(pipe.data.content).toBe('piped');
      pipe.close();
    });
  });
});
