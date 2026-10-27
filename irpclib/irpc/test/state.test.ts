import { anchor } from '@airlib/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Context from '../src/context.js';
import { IRPC_STATUS } from '../src/enum.js';
import { RemoteState, stream } from '../src/state.js';

describe('RemoteState', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const state = new RemoteState('initial');
    expect(state.data).toBe('initial');
    expect(state.status).toBe(IRPC_STATUS.PENDING);
    expect(state.error).toBeUndefined();
  });

  it('should react to data changes via subscription', () => {
    const state = new RemoteState(0);
    const subscriber = vi.fn();

    state.subscribe(subscriber);

    // Anchor emits 'init' immediately upon subscribe
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber.mock.calls[0][1].type).toBe('init');

    state.data = 1;
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber.mock.calls[1][1].keys).toEqual(['data']);
    expect(subscriber.mock.calls[1][1].value).toBe(1);
  });

  it('should resolve as a Promise when status is SUCCESS', async () => {
    const state = new RemoteState('pending');

    setTimeout(() => {
      state.data = 'completed';
      state.status = IRPC_STATUS.SUCCESS;
    }, 10);

    const result = await state;
    expect(result).toBe('completed');
  });

  it('should reject as a Promise when status is ERROR', async () => {
    const state = new RemoteState('pending');

    setTimeout(() => {
      state.error = new Error('Test Failure');
      state.status = IRPC_STATUS.ERROR;
    }, 10);

    try {
      await state;
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toBe('Test Failure');
    }
  });

  it('should chain Promises correctly via [Symbol.species]', async () => {
    const state = new RemoteState('start');

    setTimeout(() => {
      state.data = 'finish';
      state.status = IRPC_STATUS.SUCCESS;
    }, 10);

    const chained = state.then((val) => val + 'ed');

    // The chained promise should NOT be an instance of RemoteState
    // due to static [Symbol.species] = Promise
    expect(chained instanceof RemoteState).toBe(false);
    expect(chained instanceof Promise).toBe(true);

    const result = await chained;
    expect(result).toBe('finished');
  });

  it('should explicitly clean up state via close()', () => {
    const state = new RemoteState('start');
    const destroySpy = vi.spyOn(state as any, 'destroy');
    state.close();
    expect(destroySpy).toHaveBeenCalled();
  });

  describe('stream utility factory', () => {
    it('should natively configure RemoteState pipeline', () => {
      const activeStream = stream((state) => {
        expect(state.data).toBe('seeded');
      }, 'seeded');

      expect(activeStream).toBeInstanceOf(RemoteState);
      expect(activeStream.data).toBe('seeded');
      expect(activeStream.status).toBe(IRPC_STATUS.PENDING);
    });

    it('should properly execute manual resolution via inner closure strictly', async () => {
      const activeStream = stream<string[]>((state, resolve) => {
        state.data.push('loaded');
        resolve();
      }, []);

      const result = await activeStream;

      expect(result).toEqual(['loaded']);
      expect(activeStream.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should capture exact sync crashes dynamically binding to reject pipe', async () => {
      const activeStream = stream(() => {
        throw new Error('Sync pipeline crash');
      });

      await expect(activeStream).rejects.toThrow('Sync pipeline crash');
      expect(activeStream.status).toBe(IRPC_STATUS.ERROR);
    });

    it('should securely accept optional payload mutations dynamically during terminal resolution', async () => {
      const activeStream = stream<string>((data, resolve) => {
        resolve('Terminal override');
      }, 'Initial data');

      const result = await activeStream;

      expect(result).toBe('Terminal override');
      expect(activeStream.data).toBe('Terminal override');
      expect(activeStream.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should hook strictly unto promise chains securing unhandled errors natively', async () => {
      const activeStream = stream(async () => {
        await Promise.resolve();
        throw new Error('Async pipeline failure');
      });

      await expect(activeStream).rejects.toThrow('Async pipeline failure');
      expect(activeStream.status).toBe(IRPC_STATUS.ERROR);
    });
    it('should invoke async cleanup cleanly if aborted before promise resolves natively', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      const futureCleanup = vi.fn();
      const activeStream = stream(async () => {
        return futureCleanup;
      });

      abortController.abort(); // Triggers abort during PENDING lifecycle

      await new Promise((resolve) => setTimeout(resolve, 10)); // Flush promises

      expect(futureCleanup).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should register abort listener for async cleanup if not yet aborted natively', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      const futureCleanup = vi.fn();
      let resolveCleanup: any;
      stream(async () => {
        await new Promise((r) => {
          resolveCleanup = r;
        });
        return futureCleanup;
      });

      resolveCleanup();
      await new Promise((resolve) => setTimeout(resolve, 0));

      abortController.abort();
      expect(futureCleanup).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it('should safely bind sync cleanup statically to abort hook pipeline', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      const syncCleanup = vi.fn();
      stream(() => {
        return syncCleanup;
      });

      abortController.abort();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(syncCleanup).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it('should fire sync cleanup dynamically if previously aborted', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      abortController.abort(); // Aborted before mapping

      const syncCleanup = vi.fn();
      stream(() => {
        return syncCleanup; // Cleanup runs instantly logically
      });

      expect(syncCleanup).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it('should remove abort listener when resolved with active abortSignal', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      const activeStream = stream<string>((_state, resolve) => {
        resolve('done');
      }, 'init');

      const result = await activeStream;
      expect(result).toBe('done');
      expect(activeStream.status).toBe(IRPC_STATUS.SUCCESS);

      vi.restoreAllMocks();
    });

    it('should remove abort listener when rejected with active abortSignal', async () => {
      const abortController = new AbortController();
      vi.spyOn(Context, 'getAbortSignal').mockReturnValue(abortController.signal);

      const activeStream = stream<string>((_state, _resolve, reject) => {
        reject(new Error('fail'));
      }, 'init');

      await expect(activeStream).rejects.toThrow('fail');
      expect(activeStream.status).toBe(IRPC_STATUS.ERROR);

      vi.restoreAllMocks();
    });
  });

  describe('closed state guards', () => {
    it('should ignore data setter after accept', () => {
      const state = new RemoteState('initial');
      state.accept('final');
      state.data = 'should-be-ignored';
      expect(state.data).toBe('final');
    });

    it('should ignore error setter after accept', () => {
      const state = new RemoteState('initial');
      state.accept();
      state.error = new Error('ignored');
      expect(state.error).toBeUndefined();
    });

    it('should ignore status setter after accept', () => {
      const state = new RemoteState('initial');
      state.accept();
      state.status = IRPC_STATUS.ERROR;
      expect(state.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should ignore second accept call', async () => {
      const state = new RemoteState('initial');
      state.accept('first');
      state.accept('second');
      expect(await state).toBe('first');
    });

    it('should ignore second reject call', async () => {
      const state = new RemoteState('initial');
      state.reject(new Error('first'));
      state.reject(new Error('second'));
      await expect(state).rejects.toThrow('first');
    });

    it('should ignore close after already closed', () => {
      const state = new RemoteState('initial');
      const destroySpy = vi.spyOn(state as any, 'destroy');
      state.close();
      state.close();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('should not destroy on resumable state', () => {
      const state = new RemoteState('initial', undefined, true);
      const destroySpy = vi.spyOn(anchor, 'destroy');

      state.status = IRPC_STATUS.SUCCESS;
      state.close();
      state.close();

      expect(destroySpy).not.toHaveBeenCalled();
      expect(state.status).toBe(IRPC_STATUS.SUCCESS);

      // Should allow resuming.
      (state as any).resume();
      state.status = IRPC_STATUS.PENDING;

      expect(state.status).toBe(IRPC_STATUS.PENDING);

      destroySpy.mockRestore();
    });

    it('should accept with implicit value (no args)', async () => {
      const state = new RemoteState('current');
      state.accept();
      expect(await state).toBe('current');
    });

    it('should reject with implicit error (no args)', async () => {
      const state = new RemoteState('current');
      state.reject();
      await expect(state).rejects.toThrow('Unknown error.');
    });

    it('should reject with the existing error message when no arg provided', async () => {
      const state = new RemoteState('current');
      state.error = new Error('Existing error');
      state.reject();
      await expect(state).rejects.toThrow('Existing error');
    });
  });

  describe('pipe and unpipe', () => {
    it('should remove .then after pipe()', () => {
      const state = new RemoteState('value');
      expect(state.then).toBeDefined();

      const returned = state.pipe();
      expect(returned).toBe(state);
      expect(state.then).toBeUndefined();
    });

    it('should prevent async unwrapping when piped', async () => {
      const state = new RemoteState('value');
      state.accept('resolved');
      state.pipe();

      // Returning a piped RemoteState from an async function
      // should yield the RemoteState itself, not its resolved value.
      const result = await (async () => {
        return state;
      })();

      expect(result).toBeInstanceOf(RemoteState);
      expect(result).toBe(state);
    });

    it('should resolve to the instance itself when directly awaited', async () => {
      const state = new RemoteState('value');
      state.accept('resolved');
      state.pipe();

      // await on a non-thenable (.then is undefined) resolves to the object.
      const result = await state;

      expect(result).toBe(state);
      expect((result as any).data).toBe('resolved');
    });

    it('should restore .then after unpipe()', async () => {
      const state = new RemoteState('value');
      const originalThen = state.then;

      state.pipe();
      expect(state.then).toBeUndefined();

      state.unpipe();
      expect(state.then).toBeDefined();
      expect(state.then).toBe(originalThen);

      // Should be awaitable again after unpipe.
      state.accept('done');
      const result = await state;
      expect(result).toBe('done');
    });

    it('should be safe to call unpipe() without pipe()', () => {
      const state = new RemoteState('value');
      const originalThen = state.then;

      state.unpipe();
      expect(state.then).toBe(originalThen);
    });

    it('should preserve data and status while piped', () => {
      const state = new RemoteState('initial');
      state.data = 'updated';
      state.pipe();

      expect(state.data).toBe('updated');
      expect(state.status).toBe(IRPC_STATUS.PENDING);
    });

    it('should pipe to target state', () => {
      const a = new RemoteState('a');
      const b = new RemoteState('b');

      a.pipeTo(b);
      expect(b.data).toBe('a');

      a.data = 'c';
      expect(b.data).toBe('c');

      b.data = 'd';
      expect(b.data).toBe('d');
      expect(a.data).toBe('c');

      a.data = 'e';
      expect(b.data).toBe('e');

      a.close();

      a.data = 'f';
      expect(b.data).toBe('e');
    });

    it('should deliver a push once when the target shares the array with the source', () => {
      const a = new RemoteState<{ chunks: string[] }>({ chunks: [] });
      const b = new RemoteState<{ chunks: string[] }>({ chunks: [] });
      const pushes: unknown[] = [];

      a.pipeTo(b);
      b.subscribe((_, event) => {
        if (event.type === 'push') pushes.push(event.value);
      });
      a.data.chunks.push('x');

      expect(a.data.chunks).toEqual(['x']);
      expect(b.data.chunks).toEqual(['x']);
      expect(pushes).toEqual([['x']]);
    });

    it('should deliver a push once after the source replaces its data object', () => {
      const a = new RemoteState<{ chunks?: string[] }>({});
      const b = new RemoteState<{ chunks?: string[] }>({});

      a.pipeTo(b);
      a.data = { chunks: [] };
      a.data.chunks!.push('x');
      a.data.chunks!.splice(0, 0, 'w');

      expect(a.data.chunks).toEqual(['w', 'x']);
      expect(b.data.chunks).toEqual(['w', 'x']);
    });

    it('should still replay onto a target that holds its own copy', () => {
      const a = new RemoteState<{ chunks: string[] }>({ chunks: [] });
      const b = new RemoteState<{ chunks: string[] }>({ chunks: [] });

      a.pipeTo(b);
      b.data = { chunks: [] };
      a.data.chunks.push('y');

      expect(a.data.chunks).toEqual(['y']);
      expect(b.data.chunks).toEqual(['y']);
      expect(b.data.chunks).not.toBe(a.data.chunks);
    });

    it('should handle async stream initializer resolving to non-function cleanup', async () => {
      const rs = stream(async (state) => {
        state.data = 'resolved';
      });

      await Promise.resolve();
      expect(rs.data).toBe('resolved');
    });
  });
});
