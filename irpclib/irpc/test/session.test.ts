import { describe, expect, it, vi } from 'vitest';
import { withContext } from '../src/context.js';
import { SessionStore } from '../src/session.js';
import { IRPC_STORE } from '../src/store.js';

const KEY = 'session-id';

/** A store reading the session ID under `KEY`. */
function createStore() {
  const store = new SessionStore();
  store.key(KEY);
  return store;
}

/** Runs `fn` as a call of the given session. */
const inSession = <R>(id: string, fn: () => R) => withContext([[KEY, id]], fn);

describe('SessionStore', () => {
  it('delivers a broadcast to every member of the calling session only', async () => {
    const store = createStore();
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    await inSession('s1', () => store.join(a));
    await inSession('s1', () => store.join(b));
    await inSession('s2', () => store.join(other));

    await inSession('s1', () => store.broadcast({ path: '/a.json' }));

    expect(a).toHaveBeenCalledWith({ path: '/a.json' });
    expect(b).toHaveBeenCalledWith({ path: '/a.json' });
    expect(other).not.toHaveBeenCalled();
  });

  it('delivers a member’s broadcast to everyone but itself, without a context of its own', async () => {
    const store = createStore();
    const self = vi.fn();
    const peer = vi.fn();
    const member = await inSession('s1', () => store.join(self));
    await inSession('s1', () => store.join(peer));

    member.broadcast('saved');

    expect(self).not.toHaveBeenCalled();
    expect(peer).toHaveBeenCalledWith('saved');
  });

  it('keeps a member’s broadcast inside its own session', async () => {
    const store = createStore();
    const peer = vi.fn();
    const other = vi.fn();
    const member = await inSession('s1', () => store.join(vi.fn()));
    await inSession('s1', () => store.join(peer));
    await inSession('s2', () => store.join(other));

    member.broadcast('saved');

    expect(peer).toHaveBeenCalledWith('saved');
    expect(other).not.toHaveBeenCalled();
  });

  it('broadcasts to a session with no members without failing', async () => {
    const store = createStore();

    await expect(inSession('empty', () => store.broadcast('x'))).resolves.toBeUndefined();
  });

  it('treats one listener joined twice as two members', async () => {
    const store = createStore();
    const listener = vi.fn();
    const first = await inSession('s1', () => store.join(listener));
    await inSession('s1', () => store.join(listener));

    first.broadcast('hi');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops delivering to a member that left, and to a session whose members all left', async () => {
    const store = createStore();
    const a = vi.fn();
    const b = vi.fn();
    const first = await inSession('s1', () => store.join(a));
    const second = await inSession('s1', () => store.join(b));

    first.leave();
    await inSession('s1', () => store.broadcast(1));
    second.leave();
    second.leave();
    await inSession('s1', () => store.broadcast(2));

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('delivers to a member that joins after its session was dropped', async () => {
    const store = createStore();
    const later = vi.fn();
    const first = await inSession('s1', () => store.join(vi.fn()));
    first.leave();

    await inSession('s1', () => store.join(later));
    await inSession('s1', () => store.broadcast('back'));

    expect(later).toHaveBeenCalledWith('back');
  });

  it('delivers a broadcast to everyone who was a member when it was sent', async () => {
    const store = createStore();
    const later = vi.fn();
    // The first member makes a later one leave mid-broadcast: that one still gets this broadcast.
    await inSession('s1', () => store.join(() => member.leave()));
    const member = await inSession('s1', () => store.join(later));

    await inSession('s1', () => store.broadcast('x'));
    await inSession('s1', () => store.broadcast('y'));

    expect(later.mock.calls).toEqual([['x']]);
  });

  it('reports a failing listener and still delivers to the rest', async () => {
    const store = createStore();
    const logged = vi.spyOn(IRPC_STORE, 'error').mockImplementation(() => {});
    const after = vi.fn();
    await inSession('s1', () =>
      store.join(() => {
        throw new Error('boom');
      })
    );
    await inSession('s1', () => store.join(after));

    await inSession('s1', () => store.broadcast('x'));

    expect(after).toHaveBeenCalledWith('x');
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), [{ session: 's1' }]);
    logged.mockRestore();
  });

  it('refuses to join or broadcast outside a session, or before it has a key', async () => {
    const store = createStore();
    await expect(withContext(() => store.join(() => {}))).rejects.toThrow('No session in the current context');
    await expect(withContext(() => store.broadcast('x'))).rejects.toThrow('No session in the current context');

    const keyless = new SessionStore();
    await expect(inSession('s1', () => keyless.join(() => {}))).rejects.toThrow('call SESSION_STORE.key() first');
    await expect(inSession('s1', () => keyless.broadcast('x'))).rejects.toThrow('call SESSION_STORE.key() first');
  });
});
