import { describe, expect, it, vi } from 'vitest';
import { withContext } from '../src/context.js';
import { SessionStore } from '../src/session.js';
import { IRPC_STORE } from '../src/store.js';

const KEY = 'session-id';

/** The topic most tests share. */
const TOPIC = 'fs.write';

/** A store reading the session ID under `KEY`. */
function createStore() {
  const store = new SessionStore();
  store.key(KEY);
  return store;
}

/** Runs `fn` as a call of the given session. */
const inSession = <R>(id: string, fn: () => R) => withContext([[KEY, id]], fn);

describe('SessionStore', () => {
  it('delivers a broadcast to every member of the topic in the calling session only', async () => {
    const store = createStore();
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    await inSession('s1', () => store.join(TOPIC, a));
    await inSession('s1', () => store.join(TOPIC, b));
    await inSession('s2', () => store.join(TOPIC, other));

    await inSession('s1', () => store.broadcast(TOPIC, { path: '/a.json' }));

    expect(a).toHaveBeenCalledWith({ path: '/a.json' });
    expect(b).toHaveBeenCalledWith({ path: '/a.json' });
    expect(other).not.toHaveBeenCalled();
  });

  it('keeps topics apart: a broadcast reaches only its own topic', async () => {
    const store = createStore();
    const writes = vi.fn();
    const notices = vi.fn();
    await inSession('s1', () => store.join(TOPIC, writes));
    await inSession('s1', () => store.join('notify', notices));

    await inSession('s1', () => store.broadcast('notify', 'saved'));

    expect(notices).toHaveBeenCalledWith('saved');
    expect(writes).not.toHaveBeenCalled();
  });

  it('takes a symbol as a topic, apart from a string topic of the same name', async () => {
    const store = createStore();
    const PRIVATE = Symbol(TOPIC);
    const byName = vi.fn();
    const bySymbol = vi.fn();
    await inSession('s1', () => store.join(TOPIC, byName));
    await inSession('s1', () => store.join(PRIVATE, bySymbol));

    await inSession('s1', () => store.broadcast(PRIVATE, 'private'));

    expect(bySymbol).toHaveBeenCalledWith('private');
    expect(byName).not.toHaveBeenCalled();
  });

  it('delivers a member’s broadcast to everyone but itself, without a context of its own', async () => {
    const store = createStore();
    const self = vi.fn();
    const peer = vi.fn();
    const member = await inSession('s1', () => store.join(TOPIC, self));
    await inSession('s1', () => store.join(TOPIC, peer));

    member.broadcast('saved');

    expect(self).not.toHaveBeenCalled();
    expect(peer).toHaveBeenCalledWith('saved');
  });

  it('keeps a member’s broadcast inside its own topic and session', async () => {
    const store = createStore();
    const peer = vi.fn();
    const otherTopic = vi.fn();
    const otherSession = vi.fn();
    const member = await inSession('s1', () => store.join(TOPIC, vi.fn()));
    await inSession('s1', () => store.join(TOPIC, peer));
    await inSession('s1', () => store.join('notify', otherTopic));
    await inSession('s2', () => store.join(TOPIC, otherSession));

    member.broadcast('saved');

    expect(peer).toHaveBeenCalledWith('saved');
    expect(otherTopic).not.toHaveBeenCalled();
    expect(otherSession).not.toHaveBeenCalled();
  });

  it('broadcasts to a topic or session with no members without failing', async () => {
    const store = createStore();
    await inSession('s1', () => store.join('notify', vi.fn()));

    await expect(inSession('s1', () => store.broadcast(TOPIC, 'x'))).resolves.toBeUndefined();
    await expect(inSession('empty', () => store.broadcast(TOPIC, 'x'))).resolves.toBeUndefined();
  });

  it('treats one listener joined twice as two members', async () => {
    const store = createStore();
    const listener = vi.fn();
    const first = await inSession('s1', () => store.join(TOPIC, listener));
    await inSession('s1', () => store.join(TOPIC, listener));

    first.broadcast('hi');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops delivering to a member that left, and to a topic whose members all left', async () => {
    const store = createStore();
    const a = vi.fn();
    const b = vi.fn();
    const first = await inSession('s1', () => store.join(TOPIC, a));
    const second = await inSession('s1', () => store.join(TOPIC, b));

    first.leave();
    await inSession('s1', () => store.broadcast(TOPIC, 1));
    second.leave();
    second.leave();
    await inSession('s1', () => store.broadcast(TOPIC, 2));

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('keeps the session’s other topics when one topic’s members all left', async () => {
    const store = createStore();
    const notices = vi.fn();
    const writer = await inSession('s1', () => store.join(TOPIC, vi.fn()));
    await inSession('s1', () => store.join('notify', notices));

    writer.leave();
    await inSession('s1', () => store.broadcast('notify', 'still here'));

    expect(notices).toHaveBeenCalledWith('still here');
  });

  it('delivers to a member that joins after its topic was dropped', async () => {
    const store = createStore();
    const later = vi.fn();
    const first = await inSession('s1', () => store.join(TOPIC, vi.fn()));
    first.leave();

    await inSession('s1', () => store.join(TOPIC, later));
    await inSession('s1', () => store.broadcast(TOPIC, 'back'));

    expect(later).toHaveBeenCalledWith('back');
  });

  it('delivers a broadcast to everyone who was a member when it was sent', async () => {
    const store = createStore();
    const later = vi.fn();
    // The first member makes a later one leave mid-broadcast: that one still gets this broadcast.
    await inSession('s1', () => store.join(TOPIC, () => member.leave()));
    const member = await inSession('s1', () => store.join(TOPIC, later));

    await inSession('s1', () => store.broadcast(TOPIC, 'x'));
    await inSession('s1', () => store.broadcast(TOPIC, 'y'));

    expect(later.mock.calls).toEqual([['x']]);
  });

  it('reports a failing listener and still delivers to the rest', async () => {
    const store = createStore();
    const logged = vi.spyOn(IRPC_STORE, 'error').mockImplementation(() => {});
    const after = vi.fn();
    await inSession('s1', () =>
      store.join(TOPIC, () => {
        throw new Error('boom');
      })
    );
    await inSession('s1', () => store.join(TOPIC, after));

    await inSession('s1', () => store.broadcast(TOPIC, 'x'));

    expect(after).toHaveBeenCalledWith('x');
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), [
      { session: 's1', topic: TOPIC },
    ]);
    logged.mockRestore();
  });

  it('refuses to join or broadcast outside a session, or before it has a key', async () => {
    const store = createStore();
    await expect(withContext(() => store.join(TOPIC, () => {}))).rejects.toThrow('No session in the current context');
    await expect(withContext(() => store.broadcast(TOPIC, 'x'))).rejects.toThrow('No session in the current context');

    const keyless = new SessionStore();
    await expect(inSession('s1', () => keyless.join(TOPIC, () => {}))).rejects.toThrow(
      'call SESSION_STORE.key() first'
    );
    await expect(inSession('s1', () => keyless.broadcast(TOPIC, 'x'))).rejects.toThrow(
      'call SESSION_STORE.key() first'
    );
  });
});
