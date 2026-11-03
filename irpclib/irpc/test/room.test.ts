import { mutable } from '@airlib/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withContext } from '../src/context.js';
import {
  createPackage,
  type IRPCCall,
  IRPCResolver,
  IRPCRouter,
  IRPCStream,
  IRPCTransport,
  type RemoteState,
  stream,
} from '../src/index.js';
import { SessionStore } from '../src/session.js';
import { IRPC_STORE } from '../src/store.js';

// Rooms and live streams settle over real time; the shared setup fakes timers for every test.
beforeEach(() => {
  vi.useRealTimers();
});

const KEY = 'room-session';

/** A store reading the session ID under `KEY`. */
function createStore() {
  const store = new SessionStore();
  store.key(KEY);
  return store;
}

/** Runs `fn` as a call of the given session. */
const inSession = <R>(id: string, fn: () => R) => withContext([[KEY, id]], fn);

/** A chat-like room: messages, and a command that adds one. */
const chatRoom = (create = vi.fn()) => {
  return () => {
    create();
    const data = mutable({ messages: [] as string[] });
    return { data, commands: { add: (message: string) => void data.messages.push(message) } };
  };
};

describe('SessionStore rooms', () => {
  it('creates a room for the first call only, and gives every call the same data', async () => {
    const store = createStore();
    const create = vi.fn();
    const first = await inSession('s1', () => store.room('chat', chatRoom(create)));
    const second = await inSession('s1', () => store.room('chat', chatRoom(create)));

    expect(create).toHaveBeenCalledTimes(1);
    expect(second.data).toBe(first.data);

    second.ask('add', 'hi');
    expect(first.data.messages).toEqual(['hi']);
  });

  it('keeps rooms apart by session and by topic', async () => {
    const store = createStore();
    const a = await inSession('s1', () => store.room('chat', chatRoom()));
    const b = await inSession('s2', () => store.room('chat', chatRoom()));
    const c = await inSession('s1', () => store.room('notes', chatRoom()));

    expect(new Set([a.data, b.data, c.data]).size).toBe(3);
  });

  it('runs the room’s commands, and refuses an unknown one or one asked after leaving', async () => {
    const store = createStore();
    const member = await inSession('s1', () => store.room('chat', chatRoom()));

    expect(() => member.ask('nope' as never)).toThrow('The room has no command "nope"');
    member.leave();
    expect(() => member.ask('add', 'late')).toThrow('Not in the room any more');
  });

  it('closes with its last member, so the next call creates it afresh', async () => {
    const store = createStore();
    const close = vi.fn();
    const create = vi.fn();
    const make = () => ({ ...chatRoom(create)(), close });
    const first = await inSession('s1', () => store.room('chat', make));
    const second = await inSession('s1', () => store.room('chat', make));

    first.leave();
    first.leave();
    expect(close).not.toHaveBeenCalled();
    second.leave();
    expect(close).toHaveBeenCalledTimes(1);

    const third = await inSession('s1', () => store.room('chat', make));
    expect(create).toHaveBeenCalledTimes(2);
    expect(third.data).not.toBe(first.data);
  });

  it('stays open after its last member left while it holds a task, settled or failed', async () => {
    const store = createStore();
    const close = vi.fn();
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const member = await inSession('s1', () =>
      store.room('chat', ({ hold }) => {
        void hold(new Promise<void>((resolve) => (finish = resolve)));
        hold(new Promise<void>((_, reject) => (fail = reject))).catch(() => undefined);
        return { data: {}, close };
      })
    );

    member.leave();
    finish();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    fail(new Error('task failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves no room when create throws, and reports a close that throws', async () => {
    const store = createStore();
    await expect(
      inSession('s1', () =>
        store.room('chat', () => {
          throw new Error('no chat');
        })
      )
    ).rejects.toThrow('no chat');
    const create = vi.fn();
    await inSession('s1', () => store.room('chat', chatRoom(create)));
    expect(create).toHaveBeenCalledTimes(1);

    const logged = vi.spyOn(IRPC_STORE, 'error').mockImplementation(() => {});
    const member = await inSession('s2', () =>
      store.room('chat', () => ({
        data: {},
        close: () => {
          throw new Error('close failed');
        },
      }))
    );
    member.leave();
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'close failed' }), [
      { session: 's2', topic: 'chat' },
    ]);
    logged.mockRestore();
  });
});

/** Carries calls to a router in the same process, as a network transport would. */
class LoopbackTransport extends IRPCTransport {
  public router?: IRPCRouter;

  public async dispatch(calls: IRPCCall[]): Promise<void> {
    for (const call of calls) {
      const req = {
        id: call.id,
        name: call.payload.name,
        args: call.payload.args,
        package: call.payload.package,
        type: call.payload.type,
        callId: call.payload.callId,
      };
      const resolver = new IRPCResolver(req, this.router!.packageOf(req));
      new IRPCStream(req.id, req.name, () => resolver.resolve(), resolver.spec, this.router!).pipe((packet) =>
        call.enqueue(packet)
      );
    }
  }
}

/** Waits until `check` holds, failing after `timeout` ms. */
async function until(check: () => boolean, timeout = 2000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

type ChatData = { messages: string[] };
type ChatQueries = { add: (message: string) => boolean };

describe.each(['local', 'transport'] as const)('a room shared by live streams, %s', (mode) => {
  it('sends one change to every member’s caller, exactly once', async () => {
    const store = createStore();
    const transport = new LoopbackTransport();
    const irpc = createPackage({ name: `room-${mode}`, version: '1.0.0', bypassLocal: mode === 'transport' });
    irpc.use(transport);
    transport.router = new IRPCRouter(irpc, transport);

    const chat = irpc.declare<() => RemoteState<ChatData, ChatQueries>>({
      name: 'chat',
      stream: true,
      keepAlive: true,
      coalesce: false,
      seed: () => ({ messages: [] }),
    });
    irpc.construct(chat, () =>
      stream<ChatData, ChatQueries>(
        (state) => {
          const member = store.room('chat', chatRoom());
          // The room's own data: every member's stream holds the same object.
          state.data = member.data;
          state.answer('add', (message) => {
            member.ask('add', message);
            return true;
          });
          return () => member.leave();
        },
        { messages: [] }
      )
    );

    await inSession('s1', async () => {
      const first = chat();
      const second = chat();
      // Asked straight away, as a desktop sends the user's words as soon as it connects.
      await first.ask('add', 'hello');
      await until(() => second.data.messages.length > 0);
      await second.ask('add', 'there');
      await until(() => first.data.messages.length > 1);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(first.data.messages).toEqual(['hello', 'there']);
      expect(second.data.messages).toEqual(['hello', 'there']);
      first.close();
      second.close();
    });
  });
});
