import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AsyncScope,
  AsyncStore,
  awaited,
  clearContextStore,
  createContext,
  createContextStore,
  getAllScopes,
  getAsyncScope,
  getContext,
  getContextStore,
  getRootStore,
  getScope,
  getScopeStore,
  isGlobalScope,
  setAsyncScope,
  setContext,
  setContextStore,
  setScope,
  sleep,
  withContext,
  withIsolation,
  withScope,
} from '../../src/index.js';

describe('Anchor - Async Scope', () => {
  describe('AsyncScope', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should get the active store', () => {
      expect(getScopeStore()).toBeInstanceOf(Map);
    });

    it('should detect global scope', () => {
      expect(isGlobalScope()).toBe(true);
    });

    it('should change the async scope', () => {
      const prevStore = getAsyncScope();
      const nextStore = new AsyncScope<AsyncStore>();

      expect(prevStore.store !== nextStore.store);
      setAsyncScope(nextStore);

      expect(getAsyncScope()).toBe(nextStore);
      expect(getAsyncScope().store).toBe(nextStore.store);
    });

    it('should store and retrieve values', () => {
      const store = new AsyncStore();
      store.set('key', 'value');
      expect(store.get('key')).toBe('value');
    });

    it('should fall back to parent store if key is missing', () => {
      const parent = new AsyncStore([['parentKey', 'parentVal']]);
      const child = new AsyncStore([], parent);

      child.set('childKey', 'childVal');

      expect(child.get('childKey')).toBe('childVal');
      expect(child.get('parentKey')).toBe('parentVal');
    });

    it('should shadow parent keys if overridden in child', () => {
      const parent = new AsyncStore([['key', 'parentVal']]);
      const child = new AsyncStore([['key', 'childVal']], parent);

      expect(child.get('key')).toBe('childVal');
    });
  });

  describe('Global Scope & Store Management', () => {
    let errSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      errSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should warn on global scope access', async () => {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('document', undefined);

      expect(getScope('any')).toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it('withScope provides a synchronous context scope', () => {
      withScope(() => {
        setScope('key', 'val');
        expect(getScope('key')).toBe('val');
      });

      expect(getScope('key')).toBeUndefined();
    });

    it('withScope inherits from parent scope', () => {
      withScope(() => {
        setScope('parentKey', 'parentVal');

        withScope(() => {
          setScope('childKey', 'childVal');
          expect(getScope('parentKey')).toBe('parentVal');
          expect(getScope('childKey')).toBe('childVal');
        });

        expect(getScope('childKey')).toBeUndefined();
      });
    });

    it('getAllScopes aggregates the active store hierarchy', () => {
      withScope(() => {
        setScope('l1', 'v1');

        withScope(() => {
          setScope('l2', 'v2');
          const stores = getAllScopes();
          expect(stores.length).toBeGreaterThanOrEqual(2);
          expect(stores[0].get('l2')).toBe('v2');
          expect(stores[1].get('l1')).toBe('v1');
        });
      });
    });

    it('global awaited behaves like Context.awaited: native await detaches to parent, explicit awaited maintains', async () => {
      setScope('globalAwaitedKey', 'globalVal');

      await withScope(async () => {
        setScope('localAwaitedKey', 'localVal');

        await awaited(() => Promise.resolve());

        expect(getScope('localAwaitedKey')).toBe('localVal');
        expect(getScope('globalAwaitedKey')).toBe('globalVal');
      });

      expect(getScope('localAwaitedKey')).toBeUndefined();
    });
  });

  describe('Security: withIsolation Boundaries', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should restore global store in a strict isolation', async () => {
      await withIsolation(async () => {
        setScope('isolated', 'val');
        expect(getScope('isolated')).toBe('val');

        await awaited(() => Promise.resolve());

        expect(getScope('isolated')).toBe('val');
      });

      expect(getScope('isolated')).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('withIsolation operates normally when properly awaited', async () => {
      await withIsolation(async () => {
        setScope('base', 'val');

        await withScope(async () => {
          expect(getScope('base')).toBe('val');
          setScope('isolated', 'val2');

          await awaited(() => Promise.resolve());
          expect(getScope('isolated')).toBe('val2');
        });

        expect(getScope('isolated')).toBeUndefined();
      }, false);
    });

    it('withIsolation warns if a floating Awaited promise accesses the boundary after destruction', async () => {
      vi.useFakeTimers();

      await withIsolation(async () => {
        setScope('foo', 'bar');

        awaited(() => new Promise((resolve) => setTimeout(resolve, 10))).then(() => {
          expect(getScope('foo')).toBe('bar');
        });
      }, false);

      vi.runAllTimers();

      // The Awaited.fork wrapper should have detected the detached access and fired the warning.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(getScopeStore()).toBe(getRootStore());

      vi.useRealTimers();
    });

    it('should throw if a floating promises detected in an strict isolated context', async () => {
      vi.useFakeTimers();

      await expect(async () => {
        return withIsolation(async () => {
          awaited(() => new Promise((resolve) => setTimeout(resolve, 10)));
        });
      }).rejects.toThrow();

      vi.runAllTimers();
      vi.useRealTimers();

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('Deep Concurrency & Edge Cases', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should protect against race conditions when multiple async contexts overlap', async () => {
      vi.useFakeTimers();
      // 5 concurrent operations with different execution delays
      const operations = [10, 20, 5, 15, 0].map((delay, index) => {
        const id = index + 1;
        return withScope(async () => {
          setScope('task_id', id);

          // Sleep to force the event loop to interleave with other operations
          await awaited(() => new Promise((r) => setTimeout(r, delay)));

          // Verify the context hasn't been polluted by the other concurrent tasks
          const currentId = getScope('task_id');
          expect(currentId).toBe(id);

          return currentId;
        });
      });

      // Advance time incrementally to explicitly force event loop interleaving
      await vi.advanceTimersByTimeAsync(5); // Flushes 0ms and 5ms tasks
      await vi.advanceTimersByTimeAsync(5); // Flushes 10ms tasks
      await vi.advanceTimersByTimeAsync(5); // Flushes 15ms tasks
      await vi.advanceTimersByTimeAsync(5); // Flushes 20ms tasks

      const results = await Promise.all(operations);
      expect(results).toEqual([1, 2, 3, 4, 5]);
      vi.useRealTimers();
    });

    it('should safely restore context even when deep awaited chains reject', async () => {
      await withScope(async () => {
        setScope('safe', true);

        try {
          await awaited(async () => {
            setScope('deep', true);

            await awaited(async () => {
              setScope('deepest', true);
              throw new Error('Deep Boom');
            });
          });
        } catch (error) {
          // The error should be rethrown
          expect((error as Error).message).toBe('Deep Boom');
        }

        // Context must still be safely bound after the try/catch unwinds
        expect(getScope('safe')).toBe(true);
        expect(getScope('deep')).toBe(true);
        expect(getScope('deepest')).toBe(true);
      });

      expect(getScope('safe')).toBeUndefined();
      expect(getScope('deep')).toBeUndefined();
      expect(getScope('deepest')).toBeUndefined();
    });

    it('should handle complex nested hierarchies with interleaved concurrency', async () => {
      vi.useFakeTimers();

      await withScope(async () => {
        setScope('layer', 'root');

        const p1 = withScope(async () => {
          setScope('layer', 'branch_1');
          await awaited(() => new Promise((r) => setTimeout(r, 10)));
          expect(getScope('layer')).toBe('branch_1');
        });

        const p2 = withScope(async () => {
          setScope('layer', 'branch_2');
          await awaited(() => new Promise((r) => setTimeout(r, 5)));
          expect(getScope('layer')).toBe('branch_2');
        });

        expect(getScope('layer')).toBe('root');

        // Interleave
        await vi.advanceTimersByTimeAsync(5); // p2 finishes
        await vi.advanceTimersByTimeAsync(5); // p1 finishes

        await awaited(() => Promise.all([p1, p2]));

        expect(getScope('layer')).toBe('root');
      });

      vi.useRealTimers();
    });

    it('should prevent withIsolations from leaking into each other during massive concurrent execution', async () => {
      vi.useFakeTimers();
      const promises = Array.from({ length: 10 }).map((_, index) => {
        const id = `iso_${index}`;
        return withIsolation(async () => {
          setScope('iso_id', id);
          // Stagger timeouts from 1ms to 10ms
          await awaited(() => new Promise((r) => setTimeout(r, (index % 10) + 1)));
          expect(getScope('iso_id')).toBe(id);
          return id;
        }, false);
      });

      // Explicitly step through the microtask queue 1ms at a time
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(1);
      }

      const results = await Promise.all(promises);
      expect(results).toEqual(Array.from({ length: 10 }).map((_, i) => `iso_${i}`));
      vi.useRealTimers();
    });

    it('should gracefully handle returning a native Promise directly from an awaited function block', async () => {
      await withScope(async () => {
        setScope('boundary', 'active');

        // If we just return a native promise from awaited, it should still wrap the resolution
        const result = await awaited(() => new Promise((r) => setTimeout(() => r('ok'), 5)));

        expect(result).toBe('ok');
        expect(getScope('boundary')).toBe('active');
      });
    });
  });

  describe('Complex Execution Boundaries & Memory Traps', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('requires explicit context binding for non-promise event-driven callbacks (simulated Event Emitter)', async () => {
      // If a system uses callbacks (like DOM events or Node Emitters), the context is naturally lost
      // because the event loop executes the callback detached from any Promise chain.
      let capturedOutside = false;
      let capturedInside = false;

      const emitter = {
        listeners: [] as (() => void)[],
        on(fn: () => void) {
          this.listeners.push(fn);
        },
        emit() {
          this.listeners.forEach((fn) => fn());
        },
      };

      withScope(() => {
        setScope('event_key', 'bound');

        // 1. Raw callback -> Loses context when emitted later
        emitter.on(() => {
          if (getScope('event_key') === undefined) capturedOutside = true;
        });

        // 2. Bound callback -> Captures current context store and forces it into the callback closure
        const currentStore = getAllScopes()[0]; // Capture active store
        emitter.on(() => {
          withScope(() => {
            if (getScope('event_key') === 'bound') capturedInside = true;
          }, currentStore);
        });
      });

      // Fire events completely outside the original context block's execution phase
      emitter.emit();

      expect(capturedOutside).toBe(true);
      expect(capturedInside).toBe(true);
    });

    it('maintains strict lateral shadow independence across deeply branched parallel yields', async () => {
      vi.useFakeTimers();

      const treePromise = withScope(async () => {
        setScope('tree', 'root');

        const leftBranch = awaited(async () => {
          return withScope(async () => {
            setScope('tree', 'left'); // shadows root
            await awaited(() => new Promise((r) => setTimeout(r, 5))); // Internal yield
            setScope('left_data', 'L1'); // sets exclusively on left store
            return (getScope('tree') as string) + getScope('left_data');
          });
        });

        const rightBranch = awaited(async () => {
          return withScope(async () => {
            setScope('tree', 'right'); // shadows root
            await awaited(() => new Promise((r) => setTimeout(r, 5))); // Internal yield
            expect(getScope('left_data')).toBeUndefined(); // strictly isolated from left sibling
            return getScope('tree');
          });
        });

        const results = await Promise.all([leftBranch, rightBranch]);

        expect(results).toEqual(['leftL1', 'right']);
        expect(getScope('tree')).toBe('root'); // root remains totally unpolluted
        expect(getScope('left_data')).toBeUndefined();
      });

      // Advance both branches concurrently
      await vi.advanceTimersByTimeAsync(5);
      await treePromise;

      vi.useRealTimers();
    });

    it('protects against multiple interleaved race conditions with alternating yields', async () => {
      vi.useFakeTimers();

      await withScope(async () => {
        setScope('outer', 'root');

        // T=0
        const opA = withScope(async () => {
          setScope('inner', 'A1'); // A -> set context
          await awaited(() => new Promise((r) => setTimeout(r, 10))); // A -> awaited (resumes at T=10)

          // T=10
          expect(getScope('inner')).toBe('A1'); // A -> resume context, inner must survive
          setScope('inner', 'A2'); // A -> set context
          await awaited(() => new Promise((r) => setTimeout(r, 10))); // A -> awaited (resumes at T=20)

          // T=20
          expect(getScope('inner')).toBe('A2'); // A -> resume context
        });

        // T=0
        const opB = withScope(async () => {
          setScope('inner', 'B1'); // B -> set context
          await awaited(() => new Promise((r) => setTimeout(r, 15))); // B -> awaited (resumes at T=15)

          // T=15
          expect(getScope('inner')).toBe('B1'); // B -> resume context, inner must survive
          setScope('inner', 'B2'); // B -> set context
          await awaited(() => new Promise((r) => setTimeout(r, 10))); // B -> awaited (resumes at T=25)

          // T=25
          expect(getScope('inner')).toBe('B2'); // B -> resume context
        });

        // We now explicitly step time forward to trigger the exact A-B-A-B-A-B alternating resumption trace

        await vi.advanceTimersByTimeAsync(10); // Advances T=0 to T=10 -> A resumes, sets A2, awaits 10ms
        await vi.advanceTimersByTimeAsync(5); // Advances T=10 to T=15 -> B resumes, sets B2, awaits 10ms
        await vi.advanceTimersByTimeAsync(5); // Advances T=15 to T=20 -> A resumes, finishes
        await vi.advanceTimersByTimeAsync(5); // Advances T=20 to T=25 -> B resumes, finishes

        await Promise.all([opA, opB]);

        // Outer context must restored
        expect(getScope('outer')).toBe('root');
        expect(getScope('inner')).toBeUndefined();
      });

      vi.useRealTimers();
    });
  });

  describe('Context System', () => {
    beforeEach(() => {
      clearContextStore();
    });

    it('should handle getContext and setContext in global scope', () => {
      expect(getContext('foo')).toBeUndefined();
      setContext('foo', 'bar');
      expect(getContext('foo')).toBe('bar');
    });

    it('should handle getContext and setContext in an isolated scope', async () => {
      await withIsolation(async () => {
        expect(getContext('foo')).toBeUndefined();
        setContext('foo', 'baz');
        expect(getContext('foo')).toBe('baz');

        await awaited(sleep(0));

        expect(getContext('foo')).toBe('baz');
      });

      expect(getContext('foo')).toBeUndefined();
    });

    it('should override the currently active Context Store', () => {
      const prevStore = getContextStore();

      setContext('foo', 'bar');
      expect(getContext('foo')).toBe('bar');

      const nextStore = createContextStore([['foo', 'baz']]);

      setContextStore(nextStore);
      expect(getContext('foo')).toBe('baz');

      setContextStore(prevStore);
      expect(getContext('foo')).toBe('bar');

      setContextStore(createContextStore());
      expect(getContext('foo')).toBe('bar');

      setContextStore(prevStore);
    });

    it('should handle getContext and setContext in an isolated scope', async () => {
      await withContext(async () => {
        expect(getContext('foo')).toBeUndefined();
        setContext('foo', 'baz');
        expect(getContext('foo')).toBe('baz');

        await awaited(sleep(0));

        expect(getContext('foo')).toBe('baz');
      });

      expect(getContext('foo')).toBeUndefined();
    });

    it('should handle getContext and setContext in an isolated scope', async () => {
      await withContext([['foo', 'baz']], async () => {
        expect(getContext('foo')).toBe('baz');

        await awaited(sleep(0));

        expect(getContext('foo')).toBe('baz');
      });

      expect(getContext('foo')).toBeUndefined();
    });

    it('should handle getContext and setContext in an isolated scope', async () => {
      await withContext(createContextStore([['foo', 'baz']]), async () => {
        expect(getContext('foo')).toBe('baz');

        await awaited(sleep(0));

        expect(getContext('foo')).toBe('baz');
      });

      expect(getContext('foo')).toBeUndefined();
    });
  });

  describe('createContext', () => {
    beforeEach(() => {
      clearContextStore();
    });

    it('should create a reader that returns undefined without a fallback', () => {
      const ctx = createContext<string>();

      expect(ctx.get()).toBeUndefined();
    });

    it('should return the fallback when no value is set', () => {
      const ctx = createContext('default');

      expect(ctx.get()).toBe('default');
    });

    it('should set and get a value', () => {
      const ctx = createContext<string>();

      ctx.set('hello');
      expect(ctx.get()).toBe('hello');
    });

    it('should override the fallback after set', () => {
      const ctx = createContext('fallback');

      ctx.set('override');
      expect(ctx.get()).toBe('override');
    });

    it('should isolate values across withIsolation boundaries', async () => {
      const ctx = createContext('initial');

      await withIsolation(async () => {
        expect(ctx.get()).toBe('initial');
        ctx.set('isolated');
        expect(ctx.get()).toBe('isolated');
      });

      expect(ctx.get()).toBe('initial');
    });

    it('should use a custom key when provided', () => {
      const key = Symbol('custom');
      const ctx = createContext('fb', key);

      ctx.set('via-reader');
      expect(getContext(key)).toBe('via-reader');
    });

    it('should not collide between independent instances', () => {
      const ctxA = createContext('a');
      const ctxB = createContext('b');

      ctxA.set('A');
      ctxB.set('B');

      expect(ctxA.get()).toBe('A');
      expect(ctxB.get()).toBe('B');
    });

    it('should support reversed arguments', () => {
      const ctxA = createContext(Symbol('a'));
      const ctxB = createContext(Symbol('b'), 'b' as never);

      expect(ctxA.get()).toBeUndefined();
      expect(ctxB.get()).toBe('b');
    });
  });
});
