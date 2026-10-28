import { type AnyType, createLifecycle, isReactive, mutable, setReactive, sleep } from '@airlib/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContextStore, withContext } from '../src/context.js';
import { IRPC_BASE_CONTEXT, IRPC_PACKET_TYPE, IRPC_STATUS } from '../src/enum.js';
import {
  createPackage,
  IRPC_STORE,
  type IRPCCall,
  type IRPCPackage,
  type IRPCPackagePayload,
  IRPCRouter,
  IRPCTransport,
  stream,
} from '../src/index.js';
import { RemoteState } from '../src/state.js';

const pkg: IRPCPackagePayload = { name: 'irpc', version: '1.0.0' };

describe('IRPCPackage', () => {
  let rpc: IRPCPackage;

  beforeEach(() => {
    rpc = createPackage({
      name: 'test',
      version: '1.0.0',
    });
  });

  describe('Create Package', () => {
    it('should create a package with default config', () => {
      const pkg = createPackage({});
      expect(pkg.config.name).toBe('global');
      expect(pkg.config.version).toBe('1.0.0');
    });

    it('should create a package with custom config', () => {
      const pkg = createPackage({
        name: 'custom',
        version: '2.0.0',
        description: 'Test package',
      });

      expect(pkg.config.name).toBe('custom');
      expect(pkg.config.version).toBe('2.0.0');
      expect(pkg.config.description).toBe('Test package');
    });

    it('should throw error for invalid name', () => {
      expect(() => createPackage({ name: 'invalid name' })).toThrow();
      expect(() => createPackage({ name: 'valid_name123' })).not.toThrow();
    });

    it('should throw error for invalid version', () => {
      expect(() => createPackage({ version: '1.0' })).toThrow();
      expect(() => createPackage({ version: '1.0.0' })).not.toThrow();
    });

    it('should return a package href', () => {
      const pkg = createPackage({
        name: 'fs',
        version: '1.0.0',
      });

      expect(pkg.href).toBe('fs/1.0.0');
    });

    it('should return the package info', () => {
      const pkg = createPackage({
        name: 'fs',
        version: '1.0.0',
        description: 'A test package',
        timeout: 10000,
      });

      expect(pkg.info).toEqual({
        name: 'fs',
        version: '1.0.0',
        description: 'A test package',
      });
    });
  });

  describe('Declare Function', () => {
    it('should declare a new RPC function', () => {
      const testFunc = rpc.declare({
        name: 'testFunc',
        description: 'A test function',
      });

      expect(typeof testFunc).toBe('function');
      expect((rpc as AnyType).specs.has('testFunc')).toBe(true);

      const spec = rpc.get('testFunc');
      expect(spec?.name).toBe('testFunc');
      expect(spec?.description).toBe('A test function');
    });

    it('should warn when declaring duplicate function', () => {
      const warnSpy = vi.spyOn(console, 'error');
      rpc.declare({ name: 'duplicateFunc' });
      rpc.declare({ name: 'duplicateFunc' });
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should infer types', async () => {
      type TestFn = (name: string) => string;
      const testFn = rpc.declare<TestFn>({
        name: 'testFunc',
        seed: () => '',
      });

      const call = testFn('john');
      await expect(call).rejects.toThrow();
    });

    it('should handle init backward compat', () => {
      const call = rpc.declare({
        name: 'testFunc',
        description: 'A test function',
        init: () => 'test',
      } as AnyType);

      const reader = call.later();
      expect(reader.data).toBe('test');
    });

    it('should declare with (name, seed) shorthand', () => {
      type TestFn = (id: string) => Promise<string>;
      const stub = rpc.declare<TestFn>('shortSeed', () => '');

      expect(typeof stub).toBe('function');

      const spec = rpc.get('shortSeed');
      expect(spec?.name).toBe('shortSeed');
      expect(typeof spec?.seed).toBe('function');
    });

    it('should declare with (name, seed, config) shorthand', () => {
      type TestFn = (id: string) => Promise<string>;
      const stub = rpc.declare<TestFn>('shortSeedCfg', () => '', {
        description: 'with config',
        maxAge: 5000,
      });

      expect(typeof stub).toBe('function');

      const spec = rpc.get('shortSeedCfg');
      expect(spec?.name).toBe('shortSeedCfg');
      expect(spec?.description).toBe('with config');
      expect(spec?.maxAge).toBe(5000);
    });

    it('should declare with (name, config) shorthand', () => {
      type TestFn = (id: string) => Promise<string>;
      const stub = rpc.declare<TestFn>('shortCfg', {
        seed: () => '',
        description: 'config only',
      });

      expect(typeof stub).toBe('function');

      const spec = rpc.get('shortCfg');
      expect(spec?.name).toBe('shortCfg');
      expect(spec?.description).toBe('config only');
    });

    it('should declare with keepAlive', () => {
      const stub = rpc.declare('keepAlive', {
        keepAlive: true,
      });

      const spec = rpc.get('keepAlive')!;
      expect(typeof stub).toBe('function');
      expect(spec.stream).toBe(true);
      expect(spec.timeout).toBe(0);
    });
  });

  describe('Implement Function', () => {
    it('should associate handler with stub', () => {
      type TestFunc = (name: string) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });

      const handler: TestFunc = vi.fn((async (name) => `Hello ${name}`) as TestFunc);
      rpc.construct(testFunc, handler);

      const spec = (rpc as AnyType).stubs.get(testFunc);
      expect(spec?.handler).toBe(handler);
    });

    it('should throw error for invalid stub', () => {
      const handler = vi.fn();
      // @ts-expect-error - Testing invalid stub
      expect(() => rpc.construct('not-a-function', handler)).toThrow('Invalid stub.');
    });

    it('should throw error for invalid handler', () => {
      const testFunc = rpc.declare<() => void>({ name: 'testFunc' });
      expect(() => rpc.construct(testFunc, 'not-a-function' as never)).toThrow('Handler must be a function.');
    });

    it('should throw error for stub without spec', () => {
      const testFunc = () => {};
      const handler = () => {};
      expect(() => rpc.construct(testFunc as never, handler)).toThrow('No spec found for stub.');
    });
  });

  describe('Use Transport', () => {
    it('should set transport', () => {
      const transport = new IRPCTransport();
      rpc.use(transport);
      expect(rpc.transport).toBe(transport);
    });

    it('should throw error for invalid transport', () => {
      // @ts-expect-error - Testing invalid transport
      expect(() => rpc.use('not-transport')).toThrow('Invalid transport.');
    });

    it('should share transport for multi packages', () => {
      const pkgA = createPackage({ name: 'pkgA' });
      const pkgB = createPackage({ name: 'pkgB' });
      const transport = new IRPCTransport();

      pkgA.use(transport);

      expect(transport.registry.has(pkgA.config.name)).toBe(true);
      expect(transport.registry.has(pkgB.config.name)).toBe(false);

      pkgB.use(transport);
      expect(transport.registry.has(pkgA.config.name)).toBe(true);
    });

    it('should replace transport', () => {
      const transA = new IRPCTransport();
      const transB = new IRPCTransport();
      const pkg = createPackage({ name: 'pkg' });

      pkg.use(transA);
      expect(transA.registry.has(pkg.config.name));
      expect(transB.registry.has(pkg.config.name)).toBe(false);

      pkg.use(transB);
      expect(transA.registry.has(pkg.config.name)).toBe(true);
      expect(transB.registry.has(pkg.config.name)).toBe(true);

      transA.unregister(pkg);
      expect(transA.registry.has(pkg.config.name)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should update config', () => {
      rpc.configure({
        name: 'updated',
        version: '2.0.0',
        description: 'Updated description',
      });

      expect(rpc.config.name).toBe('updated');
      expect(rpc.config.version).toBe('2.0.0');
      expect(rpc.config.description).toBe('Updated description');
    });
  });

  describe('Get IRPC Spec', () => {
    it('should get spec by name', () => {
      const spec = { name: 'testFunc', description: 'Test function' };
      rpc.declare(spec);

      const result = rpc.get('testFunc');
      expect(result?.name).toBe(spec.name);
      expect(result?.description).toBe(spec.description);
    });

    it('should get spec by request object', () => {
      const spec = { name: 'testFunc' };
      rpc.declare(spec);

      const result = rpc.get({ name: 'testFunc', id: '1', args: [] });
      expect(result?.name).toBe(spec.name);
    });

    it('should return undefined for non-existent spec', () => {
      const result = rpc.get('nonExistent');
      expect(result).toBeUndefined();
    });
  });

  describe('Guards', () => {
    it('should register a guard on a package', () => {
      const rpc = createPackage();
      const guard = vi.fn();
      rpc.guard(guard);

      expect(rpc.guards.has(guard)).toBe(true);
    });

    it('should not register invalid guard', () => {
      const rpc = createPackage();

      expect(() => rpc.guard('invalid' as never)).toThrow();
      expect(rpc.guards.size).toBe(0);
    });

    it('should resolves valid guards', async () => {
      const rpc = createPackage();

      const guard1 = vi.fn();
      const guard2 = vi.fn();
      rpc.guard(guard1).guard(guard2);

      expect(rpc.guards.size).toBe(2);

      await expect(rpc.resolveGuards({} as never)).resolves.not.toThrow();

      expect(guard1).toHaveBeenCalled();
      expect(guard2).toHaveBeenCalled();
    });

    it('should reject throwing guards', async () => {
      const rpc = createPackage();

      const guard1 = vi.fn();
      const guard2 = vi.fn().mockImplementation(() => Promise.reject());
      rpc.guard(guard1).guard(guard2);

      expect(rpc.guards.size).toBe(2);

      await expect(rpc.resolveGuards({} as never)).rejects.toThrow();

      expect(guard1).toHaveBeenCalled();
      expect(guard2).toHaveBeenCalled();
    });
  });

  describe('Spec Hooks', () => {
    it('should register a hook on a valid stub', () => {
      const testFunc = rpc.declare<() => Promise<string>>({ name: 'hookTest', seed: () => '' });
      const hookFn = vi.fn();

      rpc.hook(testFunc, hookFn);

      const spec = (rpc as AnyType).stubs.get(testFunc)!;
      expect((rpc as AnyType).hooks.get(spec)!.has(hookFn)).toBe(true);
    });

    it('should support chaining when registering hooks', () => {
      const testFunc = rpc.declare<() => Promise<string>>({ name: 'hookChain', seed: () => '' });
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const result = rpc.hook(testFunc, hook1).hook(testFunc, hook2);

      expect(result).toBe(rpc);
      const spec = (rpc as AnyType).stubs.get(testFunc)!;
      expect((rpc as AnyType).hooks.get(spec)!.size).toBe(2);
    });

    it('should log error and return self when hooking an invalid stub', () => {
      const errSpy = vi.spyOn(IRPC_STORE, 'error').mockImplementation(() => {});
      const unknownStub = () => {};

      const result = rpc.hook(unknownStub, vi.fn());

      expect(errSpy).toHaveBeenCalled();
      expect(result).toBe(rpc);
      errSpy.mockRestore();
    });

    it('should reject call when hook rejects', async () => {
      const rpc = createPackage({ name: 'hook-api' });
      rpc.use(new IRPCTransport());

      const hello = rpc.declare<(name: string) => Promise<string | undefined>>({ name: 'helloHook' });
      rpc.hook(hello, async (_name) => Promise.reject(new Error('Hook Rejected')));

      await expect(hello('World')).rejects.toThrow('Hook Rejected');
    });

    it('should reject call when guard rejects', async () => {
      const rpc = createPackage({ name: 'hook-api' });
      const transport = new IRPCTransport();
      rpc.use(new IRPCTransport());
      rpc.guard(async () => {
        await sleep(5);
        throw new Error('Guard Rejected');
      });

      const router = new IRPCRouter(transport);
      router.use(async () => {
        await sleep(5);
      });

      const hello = rpc.declare<(name: string) => Promise<string>>({ name: 'helloHook', seed: () => '' });
      const handler = vi.fn();
      rpc.construct(hello, handler as AnyType);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        await expect(hello('World')).rejects.toThrow('Guard Rejected');
      }, controller);

      await vi.advanceTimersByTimeAsync(5);
      controller.abort();
      await vi.advanceTimersByTimeAsync(5);
      await promise;

      expect(handler).not.toHaveBeenCalled();
    });

    it('should reject call when router hook rejects', async () => {
      const rpc = createPackage({ name: 'hook-api' });
      const transport = new IRPCTransport();
      rpc.use(new IRPCTransport());

      const router = new IRPCRouter(transport);
      router.use(() => Promise.reject(new Error('Hook Rejected')));

      const hello = rpc.declare<(name: string) => Promise<string>>({ name: 'helloHook', seed: () => '' });
      const handler = vi.fn();
      rpc.construct(hello, handler as AnyType);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        await expect(hello('World')).rejects.toThrow('Hook Rejected');
      }, controller);

      controller.abort();
      await promise;

      expect(handler).not.toHaveBeenCalled();
    });

    it('should abort call when signal aborted during guard verification', async () => {
      const rpc = createPackage({ name: 'hook-api' });
      const transport = new IRPCTransport();
      rpc.use(new IRPCTransport());
      rpc.guard(async () => {
        await sleep(5);
      });

      const router = new IRPCRouter(transport);
      router.use(async () => {
        await sleep(5);
      });

      const hello = rpc.declare<(name: string) => Promise<string>>({ name: 'helloHook', seed: () => '' });
      const handler = vi.fn();
      rpc.construct(hello, handler as AnyType);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        await expect(hello('World')).resolves.not.toThrow('Guard Rejected');
      }, controller);

      await vi.advanceTimersByTimeAsync(5);
      controller.abort();
      await vi.advanceTimersByTimeAsync(5);
      await promise;

      expect(handler).not.toHaveBeenCalled();
    });

    it('should abort call when signal aborted during hook verification', async () => {
      const rpc = createPackage({ name: 'hook-api' });
      const transport = new IRPCTransport();
      rpc.use(new IRPCTransport());

      const router = new IRPCRouter(transport);
      router.use(() => Promise.resolve());

      const hello = rpc.declare<(name: string) => Promise<string>>({ name: 'helloHook', seed: () => '' });
      const handler = vi.fn();
      rpc.construct(hello, handler as AnyType);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        await expect(hello('World')).resolves.not.toThrow('Hook Rejected');
      }, controller);

      controller.abort();
      await promise;

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Resolve Hooks', () => {
    it('should execute all hooks in order for a valid spec', async () => {
      const testFunc = rpc.declare<(name: string) => Promise<string>>({ name: 'hookResolve', seed: () => '' });
      rpc.construct(testFunc, async (name) => `Hello ${name}`);

      const order: number[] = [];
      rpc.hook(testFunc, () => {
        order.push(1);
      });
      rpc.hook(testFunc, () => {
        order.push(2);
      });
      rpc.hook(testFunc, () => {
        order.push(3);
      });

      const req = { id: '1', name: 'hookResolve', package: pkg, args: ['World'] };
      await rpc.resolveHooks(req);

      expect(order).toEqual([1, 2, 3]);
      expect(() => rpc.hook(testFunc, undefined as never)).toThrow();
    });

    it('should pass the request to each hook', async () => {
      const testFunc = rpc.declare<(name: string) => Promise<string>>({ name: 'hookReq', seed: () => '' });
      rpc.construct(testFunc, async (name) => `Hello ${name}`);

      const hookFn = vi.fn();
      rpc.hook(testFunc, hookFn);

      const req = { id: '1', name: 'hookReq', package: pkg, args: ['World'] };
      await rpc.resolveHooks(req);

      expect(hookFn).toHaveBeenCalledWith(req);
    });

    it('should throw when resolving hooks for a non-existent spec', async () => {
      const req = { id: '1', name: 'nonExistent', package: pkg, args: [] };

      await expect(rpc.resolveHooks(req)).rejects.toThrow('No spec found for stub.');
    });

    it('should propagate errors thrown by hooks', async () => {
      const testFunc = rpc.declare<() => Promise<string>>({ name: 'hookError', seed: () => '' });
      rpc.construct(testFunc, async () => 'ok');

      rpc.hook(testFunc, () => {
        throw new Error('Hook denied');
      });

      const req = { id: '1', name: 'hookError', package: pkg, args: [] };
      await expect(rpc.resolveHooks(req)).rejects.toThrow('Hook denied');
    });

    it('should stop execution when a hook throws', async () => {
      const testFunc = rpc.declare<() => Promise<string>>({ name: 'hookStop', seed: () => '' });
      rpc.construct(testFunc, async () => 'ok');

      const afterThrow = vi.fn();

      rpc.hook(testFunc, () => {
        throw new Error('Stopped');
      });
      rpc.hook(testFunc, afterThrow);

      const req = { id: '1', name: 'hookStop', package: pkg, args: [] };
      await expect(rpc.resolveHooks(req)).rejects.toThrow('Stopped');
      expect(afterThrow).not.toHaveBeenCalled();
    });

    it('should await async hooks', async () => {
      const testFunc = rpc.declare<() => Promise<string>>({ name: 'hookAsync', seed: () => '' });
      rpc.construct(testFunc, async () => 'ok');

      const executed = vi.fn();
      rpc.hook(testFunc, async () => {
        executed();
      });

      const req = { id: '1', name: 'hookAsync', package: pkg, args: [] };
      await rpc.resolveHooks(req);

      expect(executed).toHaveBeenCalled();
    });
  });

  describe('Group Hooks (CRUD)', () => {
    it('should register a hook on all stubs in a group', () => {
      const grp = rpc.crud<{ id: string; name: string }>('hookGrp', () => ({ id: '', name: '' }));
      const hookFn = vi.fn();

      rpc.hook(grp, hookFn);

      for (const stub of Object.values(grp)) {
        const spec = (rpc as AnyType).stubs.get(stub)!;
        expect((rpc as AnyType).hooks.get(spec)!.has(hookFn)).toBe(true);
      }
    });

    it('should work with excluded CRUD stubs', () => {
      const grp = rpc.exclude(
        rpc.crud<{ id: string; name: string }>('hookExcl', () => ({ id: '', name: '' })),
        ['delete']
      );
      const hookFn = vi.fn();

      rpc.hook(grp, hookFn);

      for (const stub of Object.values(grp)) {
        const spec = (rpc as AnyType).stubs.get(stub)!;
        expect((rpc as AnyType).hooks.get(spec)!.has(hookFn)).toBe(true);
      }
    });

    it('should support chaining with group hooks', () => {
      const grp = rpc.crud<{ id: string }>('hookChainGrp', () => ({ id: '' }));
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const result = rpc.hook(grp, hook1).hook(grp, hook2);

      expect(result).toBe(rpc);

      const spec = (rpc as AnyType).stubs.get(grp.get)!;
      expect((rpc as AnyType).hooks.get(spec)!.size).toBe(2);
    });

    it('should skip non-function values in the group object', () => {
      const grp = rpc.crud<{ id: string }>('hookSkip', () => ({ id: '' }));
      const mixed = { ...grp, extra: 'not a function' } as AnyType;
      const hookFn = vi.fn();

      expect(() => rpc.hook(mixed, hookFn)).not.toThrow();
    });
  });

  describe('IRPC Call', () => {
    it('should call local implementation', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'hello',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      expect(await hello('World')).toBe('Hello World');
    });

    it('should call local synchronous implementation', async () => {
      const hello = rpc.declare<(name: string) => string>({
        name: 'hello',
        seed: () => '',
      });
      rpc.construct(hello, (name) => `Hello ${name}`);

      expect(await hello('World')).toBe('Hello World');
    });

    it('should call local RemoteState implementation', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<string>>({
        name: 'hello',
        stream: true,
        seed: () => '',
      });
      rpc.construct(hello, (name) =>
        stream((state, resolve) => {
          state.data = `Hello ${name}`;
          resolve();
        })
      );

      const result = hello('World');
      expect(result.status).toBe(IRPC_STATUS.PENDING);

      await result;
      expect(result.data).toBe('Hello World');
    });

    it('should call local RemoteState init implementation', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<string>>({
        name: 'hello',
        stream: true,
        seed: () => 'Stub init',
      });
      rpc.construct(hello, (name) => {
        return stream((_state, resolve) => {
          setTimeout(() => resolve(`Hello ${name}`), 10);
        }, 'Init');
      });

      const result = hello('World');

      await Promise.resolve();
      expect(result.data).toBe('Init');
      expect(result.status).toBe(IRPC_STATUS.PENDING);

      await vi.runAllTimersAsync();
      await result;

      expect(result.data).toBe('Hello World');
    });

    it('should auto-cleanup RemoteState on component unmount (lifecycle destroy)', () => {
      const hello = rpc.declare<(name: string) => RemoteState<string>>({
        name: 'helloAutoCleanup',
        stream: true,
        seed: () => 'Init',
      });
      rpc.construct(hello, (_name) => new RemoteState<string>());

      const lifecycle = createLifecycle();
      let result: ReturnType<typeof hello> | undefined;

      lifecycle.run(() => {
        result = hello('World');
      });

      expect(result?.status).toBe(IRPC_STATUS.PENDING);

      const closeSpy = vi.spyOn(result!, 'close');

      lifecycle.destroy();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle coalesce call', async () => {
      const irpc = createPackage({
        name: 'coalesce',
      });
      const hello = irpc.declare<(name: string) => Promise<{ message: string }>>('helloCoalesce', {
        seed: () => ({ message: '' }),
        coalesce: true,
      });
      irpc.construct(hello, async (name) => ({ message: `Hello ${name}` }));

      const promise1 = hello('World');
      const promise2 = hello('World');

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toEqual({ message: 'Hello World' });
      expect(result2).toEqual({ message: 'Hello World' });
      expect(result1).toBe(result2);
    });

    it('should handle non coalesce call', async () => {
      const irpc = createPackage({
        name: 'coalesce',
      });
      const hello = irpc.declare<(name: string) => Promise<{ message: string }>>({
        name: 'helloCoalesceFalse',
        coalesce: false,
        seed: () => ({ message: '' }),
      });
      irpc.construct(hello, async (name) => ({ message: `Hello ${name}` }));

      const promise1 = hello('World');
      const promise2 = hello('World');

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toEqual({ message: 'Hello World' });
      expect(result2).toEqual({ message: 'Hello World' });
      expect(result1).not.toBe(result2);
    });

    it('should call remote implementation', async () => {
      class OptimisticTransport extends IRPCTransport {
        async dispatch(calls: IRPCCall[]) {
          calls.forEach((call) => {
            call.enqueue({
              id: call.id,
              name: call.payload.name,
              type: IRPC_PACKET_TYPE.ANSWER,
              status: IRPC_STATUS.SUCCESS,
              data: 'Hello World',
              createdAt: Date.now(),
            });
          });
        }
      }
      const irpc = createPackage({
        name: 'optimistic',
        transport: new OptimisticTransport(),
      });
      const hello = irpc.declare<(name: string) => Promise<string>>({
        name: 'hello',
        seed: () => '',
      });

      const promise = hello('World');

      await Promise.resolve();
      await vi.runAllTimersAsync();

      expect(await promise).toBe('Hello World');
    });

    it('should call cached remote implementation', async () => {
      const dispatcher = vi.fn().mockImplementation((calls: IRPCCall[]) => {
        calls.forEach((call) => {
          call.enqueue({
            id: call.id,
            name: call.payload.name,
            type: IRPC_PACKET_TYPE.ANSWER,
            status: IRPC_STATUS.SUCCESS,
            data: call.payload.args[0],
            createdAt: Date.now(),
          });
        });
      });

      class OptimisticTransport extends IRPCTransport {
        async dispatch(calls: IRPCCall[]) {
          dispatcher(calls);
        }
      }

      const irpc = createPackage({
        name: 'optimistic',
        transport: new OptimisticTransport(),
      });

      const hello = irpc.declare<(name: string) => Promise<string>>({
        name: 'hello',
        maxAge: 1000,
        seed: () => '',
      });

      // Make sure invalidate unknown stub doesn't throw.
      irpc.invalidate(() => {});

      const promise = hello('Hello World 1');
      expect(await promise).toBe('Hello World 1');

      const promise2 = hello('Hello World 1');
      expect(await promise2).toBe('Hello World 1');
      expect(dispatcher).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();

      const now = Date.now;
      Date.now = () => now() + 1000;

      const promise3 = hello('Hello World 1');

      await Promise.resolve();
      await vi.runAllTimersAsync();

      expect(await promise3).toBe('Hello World 1');
      expect(dispatcher).toHaveBeenCalledTimes(2);

      Date.now = now;

      // With invalidate
      const promise4 = hello('Hello World 2');

      vi.advanceTimersByTime(2);
      await Promise.resolve();

      expect(await promise4).toBe('Hello World 2');
      expect(dispatcher).toHaveBeenCalledTimes(3);

      irpc.invalidate(hello, 'Hello World 2');

      await vi.runAllTimersAsync();
      await Promise.resolve();

      const promise5 = hello('Hello World 2');

      vi.advanceTimersByTime(2);
      await Promise.resolve();

      expect(await promise5).toBe('Hello World 2');
      expect(dispatcher).toHaveBeenCalledTimes(4);

      irpc.invalidate(hello);
    });

    it('should handle call error without transport', async () => {
      const irpc = createPackage({
        name: 'optimistic',
      });
      const hello = irpc.declare<(name: string) => Promise<string>>({
        name: 'helloOptimistic',
        seed: () => '',
      });

      await expect(hello('World')).rejects.toThrow('No transport configured.');
    });

    it('should handle call error without transport', async () => {
      const irpc = createPackage({
        name: 'optimistic',
      });
      const transport = new IRPCTransport();
      irpc.use(transport);

      const hello = irpc.declare<(name: string) => Promise<string | undefined>>('optimistic', {
        standalone: true,
      });

      await expect(hello('World')).rejects.toThrow();
    });
  });

  describe('Resolve Call', () => {
    it('should resolve local function call', async () => {
      type TestFunc = (input: { name: string }) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });

      const handler: TestFunc = async (input) => `Hello ${input.name}`;
      rpc.construct(testFunc, handler);

      const result = await rpc.resolve({
        id: '1',
        name: 'testFunc',
        args: [{ name: 'World' }],
      });

      expect(result).toBe('Hello World');
    });

    it('should reject for non-existent function', async () => {
      await expect(
        rpc.resolve({
          id: '1',
          name: 'nonExistent',
          args: [],
        })
      ).rejects.toThrow('IRPC "nonExistent" does not exist.');
    });

    it('should reject for function without implementation', async () => {
      rpc.declare({ name: 'unimplemented' });

      await expect(
        rpc.resolve({
          id: '1',
          name: 'unimplemented',
          args: [],
        })
      ).rejects.toThrow('IRPC "unimplemented" has no implementation.');
    });
  });

  describe('Local Call (intercept)', () => {
    it('should handle non promise that throws', async () => {
      const hello = rpc.declare<(name: string) => string>({
        name: 'hello',
        seed: () => '',
      });
      rpc.construct(hello, () => {
        throw new Error('Hello World');
      });

      await expect(() => hello('World')).rejects.toThrow('Hello World');
    });

    it('should handle promise that throws', async () => {
      const hello = rpc.declare({
        name: 'hello',
      });
      rpc.construct(hello, () => {
        return Promise.reject(new Error('Hello World'));
      });

      await expect(() => hello()).rejects.toThrow('Hello World');
    });

    it.each([
      [
        'rejects later',
        () => stream((_s, _resolve, reject) => void setTimeout(() => reject(new Error('Failed')), 5), {}),
      ],
      ['rejects at once', () => stream((_s, _resolve, reject) => reject(new Error('Failed')), {})],
      [
        'throws',
        () =>
          stream(() => {
            throw new Error('Failed');
          }, {}),
      ],
    ])('rejects the caller of a local stream that %s, with its error and status', async (name, handler) => {
      for (const keepAlive of [false, true]) {
        const failing = rpc.declare<() => RemoteState<Record<string, never>>>({
          name: `failingStream-${name}-${keepAlive}`,
          stream: true,
          keepAlive,
          seed: () => ({}),
        });
        rpc.construct(failing, handler as never);

        const call = failing();
        const failed = expect(call).rejects.toThrow('Failed');
        await vi.advanceTimersByTimeAsync(5);

        await failed;
        expect(call.status).toBe(IRPC_STATUS.ERROR);
      }
    });

    it('resolves the caller of a local stream that ends well, with its data', async () => {
      const done = rpc.declare<() => RemoteState<{ n: number }>>({
        name: 'endingStream',
        stream: true,
        seed: () => ({ n: 0 }),
      });
      rpc.construct(done, () =>
        stream<{ n: number }>(
          (state, resolve) => {
            setTimeout(() => {
              state.data.n = 2;
              resolve();
            }, 5);
          },
          { n: 1 }
        )
      );

      const call = done();
      await vi.advanceTimersByTimeAsync(5);

      await expect(call).resolves.toEqual({ n: 2 });
      expect(call.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should return an IRPCReader when handler is a local stream', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<{ message: string }>>({
        name: 'helloLocalStream',
        stream: true,
        seed: () => ({ message: '' }),
      });

      rpc.construct(hello, (name) => {
        const state = new RemoteState<{ message: string }>({ message: `Hello ${name}` });
        setTimeout(() => state.accept(), 10);
        return state;
      });

      const result = hello('World');

      // The result should have the init() value, not the handler value (not started yet).
      expect(result.data).toEqual({ message: '' });
      expect(result.status).toBe(IRPC_STATUS.PENDING);

      await Promise.resolve();
      expect(result.data).toEqual({ message: 'Hello World' });
    });

    it('should invoke handler and relay data mutations when start() is called', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<{ message: string }>>({
        name: 'helloStart',
        stream: true,
        seed: () => ({ message: '' }),
      });

      rpc.construct(hello, (name) => {
        const state = new RemoteState<{ message: string }>({ message: `Hello ${name}` });

        setTimeout(() => {
          state.data.message = 'Updated';
        }, 5);

        setTimeout(() => {
          state.accept();
        }, 10);

        return state;
      });

      const result = hello('World');

      await Promise.resolve();

      // After start, the handler's initial data should be assigned.
      expect(result.data.message).toBe('Hello World');

      // Advance to trigger the data mutation.
      vi.advanceTimersByTime(5);
      expect(result.data.message).toBe('Updated');

      // Advance to trigger accept (status -> SUCCESS), which unsubscribes.
      vi.advanceTimersByTime(5);
      expect(result.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should clean up abort listener on synchronous return with signal (line 452)', async () => {
      const hello = rpc.declare<(name: string) => string>({
        name: 'helloSyncSignal',
        seed: () => '',
      });
      rpc.construct(hello, (name) => `Hello ${name}`);

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, () => {
        reader = hello('World');
      });

      expect(reader.data).toBe('Hello World');
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should clean up abort listener on promise resolve with signal (line 465)', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloAsyncSignal',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, async () => {
        reader = hello('World');
        await reader;
      });

      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should clean up abort listener on RemoteState success with signal (line 480-481)', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<{ message: string }>>({
        name: 'helloStreamSignal',
        stream: true,
        seed: () => ({ message: '' }),
      });

      rpc.construct(hello, (name) => {
        const state = new RemoteState<{ message: string }>({ message: `Hello ${name}` });
        setTimeout(() => state.accept(), 5);
        return state;
      });

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, () => {
        reader = hello('World');
      });

      expect(reader.data.message).toBe('Hello World');

      vi.advanceTimersByTime(5);
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
    });

    it('should clean up abort listener on RemoteState error with signal (line 480)', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<{ message: string }>>({
        name: 'helloStreamErrorSignal',
        stream: true,
        seed: () => ({ message: '' }),
      });

      let source: RemoteState<{ message: string }>;
      rpc.construct(hello, (name) => {
        source = new RemoteState<{ message: string }>({ message: `Hello ${name}` });
        source.catch(() => {}); // Prevent unhandled rejection on source.
        setTimeout(() => source.reject(new Error('source failed')), 5);
        return source;
      });

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, () => {
        reader = hello('World');
        reader.catch(() => {}); // Prevent unhandled rejection on reader.
      });

      expect(reader.data.message).toBe('Hello World');

      vi.advanceTimersByTime(5);
      expect(reader.status).toBe(IRPC_STATUS.ERROR);
    });

    it('should clean up abort listener on handler throw with signal (line 501)', async () => {
      const hello = rpc.declare<(name: string) => string>({
        name: 'helloThrowSignal',
        seed: () => '',
      });
      rpc.construct(hello, () => {
        throw new Error('Boom');
      });

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      await withContext(ctx, async () => {
        await expect(() => hello('World')).rejects.toThrow('Boom');
      });
    });

    it('should abort reader immediately when signal is already aborted (line 440-442)', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloAbortPre',
        seed: () => '',
      });
      const handler = vi.fn(async (name: string) => `Hello ${name}`);
      rpc.construct(hello, handler);

      const controller = new AbortController();
      controller.abort();

      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, () => {
        reader = hello('World');
      });

      expect(handler).not.toHaveBeenCalled();
      expect(reader.status).toBe(IRPC_STATUS.ABORTED);
    });

    it('should unsubscribe and abort RemoteState when signal fires during subscription (line 492-495)', async () => {
      const hello = rpc.declare<(name: string) => RemoteState<{ message: string }>>({
        name: 'helloAbortStream',
        stream: true,
        seed: () => ({ message: '' }),
      });

      const source = new RemoteState<{ message: string }>({ message: 'Hello' });
      rpc.construct(hello, () => source);

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, async () => {
        reader = hello('World');

        await Promise.resolve();

        // Reader should have initial data from the source.
        expect(reader.data.message).toBe('Hello');

        // Abort while subscription is active.
        controller.abort();

        expect(reader.status).toBe(IRPC_STATUS.ABORTED);
        expect(source.status).toBe(IRPC_STATUS.ABORTED);
      });
    });

    it('should abort reader when signal fires during pending async handler (line 444)', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloAbortAsync',
        seed: () => '',
      });

      let resolve: (value: string) => void;
      rpc.construct(
        hello,
        () =>
          new Promise<string>((r) => {
            resolve = r;
          })
      );

      const controller = new AbortController();
      const ctx = createContextStore([
        [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
        [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller as never],
      ]);

      let reader: AnyType;
      await withContext(ctx, async () => {
        reader = hello('World');

        await Promise.resolve();

        // Abort while the promise is still pending.
        controller.abort();
      });

      expect(reader.status).toBe(IRPC_STATUS.ABORTED);

      // Resolve the dangling promise to prevent leaks.
      resolve!('late');
    });
  });

  describe('Browser Stubs', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should create reader with stub.once()', () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloOnce',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const lifecycle = createLifecycle();
      let result: AnyType;
      lifecycle.run(() => {
        result = hello.once('World');
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(IRPC_STATUS.PENDING);
      lifecycle.destroy();
    });

    it('should create reader with stub.with()', () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloWith',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const lifecycle = createLifecycle();
      let result1: AnyType;
      let result2: AnyType;
      lifecycle.run(() => {
        result1 = hello.with(() => ['World'], 10);
        result2 = hello.with(['World'] as never, 10);
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      lifecycle.destroy();
    });

    it('should defer reader with stub.when()', () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloWhen',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const lifecycle = createLifecycle();
      let result1: AnyType;
      let result2: AnyType;
      lifecycle.run(() => {
        result1 = hello.when(() => ['World'], 10);
        result2 = hello.when(['World'] as never, 10);
      });

      expect(result1).toBeDefined();
      expect(result1.status).toBe(IRPC_STATUS.IDLE);
      expect(result2).toBeDefined();
      expect(result2.status).toBe(IRPC_STATUS.IDLE);
      lifecycle.destroy();
    });

    it('should trigger observer and schedule dispatch on state change', async () => {
      const current = isReactive();
      setReactive(true);
      const state = new RemoteState<string>('World');
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloObserver',
        seed: () => '',
      });
      rpc.construct(hello, (_name) => new Promise(() => {})); // Never resolves

      const lifecycle = createLifecycle();
      let result: AnyType;
      lifecycle.run(() => {
        // reading state.data inside the getter tracks the observer
        result = hello.with(() => [state.data], 10);
      });

      // updating state triggers the observer callback (lines 237-238)
      // which calls dispatch() -> coalesce=true -> schedule() (lines 246-250)
      // Do this BEFORE the initial promise resolves, so result.status is still PENDING!
      state.data = 'Temp';
      vi.advanceTimersByTime(10);

      const p = sleep(10);
      vi.advanceTimersByTime(10);
      await p;

      state.data = 'Universe';

      // advance timers to flush the microtask schedule (debounce = 10)
      vi.advanceTimersByTime(10);

      expect(result).toBeDefined();
      expect(result.status).toBe(IRPC_STATUS.PENDING); // dispatch called!
      lifecycle.destroy();
      setReactive(current!);
    });
  });

  describe('Manual Stubs (later)', () => {
    it('should create reader with stub.later() without debounce', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloLater',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const reader = hello.later();
      expect(reader).toBeDefined();
      expect(reader.status).toBe(IRPC_STATUS.IDLE);
      expect(typeof reader.dispatch).toBe('function');

      let promise = reader.dispatch('World');
      expect(reader.status).toBe(IRPC_STATUS.PENDING);

      // Wait for async handler to resolve
      await promise;
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
      expect(reader.data).toBe('Hello World');

      // Dispatch again to test resumability
      promise = reader.dispatch('Universe');
      expect(reader.status).toBe(IRPC_STATUS.PENDING);

      await promise;
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
      expect(reader.data).toBe('Hello Universe');
    });

    it('should create reader with stub.later() with debounce', async () => {
      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloLaterDebounce',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => {
        await Promise.resolve();
        return `Hello ${name}`;
      });

      const reader = hello.later(10);
      expect(reader).toBeDefined();
      expect(reader.status).toBe(IRPC_STATUS.IDLE);
      expect(typeof reader.dispatch).toBe('function');

      let promise = reader.dispatch('World');
      expect(reader.status).toBe(IRPC_STATUS.IDLE);

      vi.advanceTimersByTime(10);
      expect(reader.status).toBe(IRPC_STATUS.PENDING);

      // Wait for async handler to resolve
      await promise;
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
      expect(reader.data).toBe('Hello World');

      // Dispatch again to test resumability
      promise = reader.dispatch('Universe');
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);

      vi.advanceTimersByTime(10);
      expect(reader.status).toBe(IRPC_STATUS.PENDING);

      await promise;
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
      expect(reader.data).toBe('Hello Universe');
    });

    it('should cancel debounced dispatch when scope is destroyed', async () => {
      vi.useFakeTimers();

      const hello = rpc.declare<(name: string) => Promise<string>>({
        name: 'helloLaterCancel',
        seed: () => '',
      });
      rpc.construct(hello, async (name) => `Hello ${name}`);

      const scope = createLifecycle();
      const reader: AnyType = scope.run(() => (hello as AnyType).later(10));

      expect(reader.status).toBe(IRPC_STATUS.IDLE);

      reader.dispatch('World');
      expect(reader.status).toBe(IRPC_STATUS.IDLE);

      // Destroy the scope before timers run
      scope.destroy();

      vi.advanceTimersByTime(10);
      await Promise.resolve();

      // In IRPC, scope disposal transitions the reader to SUCCESS
      expect(reader.status).toBe(IRPC_STATUS.SUCCESS);
      expect(reader.data).toBe(''); // The init value, not updated
    });

    it('should safely handle exclude with non-existent keys or raw functions', () => {
      const customStubs = {
        customMethod: () => 'custom',
      };
      const excluded = rpc.exclude(customStubs as any, ['nonExistent' as any, 'customMethod' as any]);
      expect(excluded).toEqual({});
    });

    it('should initialize and run reactive stubs when in browser environment', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
      vi.useFakeTimers();

      const browserHello = rpc.declare<(name: string) => Promise<string>>({
        name: 'browserHello',
        seed: () => '',
      });
      rpc.construct(browserHello, async (name) => `Hello ${name}`);

      const lc = createLifecycle();
      const state = mutable({ name: 'BrowserWorld' });
      let readerWith: any;
      let readerWhen: any;
      let readerOnce: any;
      let readerLater: any;

      lc.run(() => {
        readerWith = browserHello.with(() => [state.name]);
        readerWhen = browserHello.when(() => [state.name]);
        readerOnce = browserHello.once((() => [state.name]) as never);
        readerLater = (browserHello as any).later(10, () => [state.name]);
      });

      expect(readerWith).toBeDefined();
      expect(readerWhen).toBeDefined();
      expect(readerOnce).toBeDefined();
      expect(readerLater).toBeDefined();

      readerLater.dispatch('World');
      state.name = 'MutatedBrowser';
      vi.advanceTimersByTime(10);
      await Promise.resolve();

      lc.destroy();

      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('should abort reader if signal is aborted during guards in local stub', async () => {
      const rpcGuard = createPackage({ name: 'pkg-guard-abort' });
      const router = new IRPCRouter(new IRPCTransport());
      router.use(() => Promise.resolve());

      const controller = new AbortController();
      rpcGuard.guard(async () => {
        controller.abort();
      });

      const guarded = rpcGuard.declare<(name: string) => Promise<string>>({ name: 'guardedAbort', seed: () => '' });
      rpcGuard.construct(guarded, async (name) => `Hello ${name}`);

      await router.isolate(async () => {
        const reader = guarded('World');
        await expect(reader).resolves.toBe('');
        expect(reader.status).toBe(IRPC_STATUS.ABORTED);
      }, controller);

      expect(controller.signal.aborted).toBe(true);
    });
  });
});
