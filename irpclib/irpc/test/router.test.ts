import type { AnyType } from '@airlib/core';
import { describe, expect, it, vi } from 'vitest';
import { IRPC_PACKET_TYPE, IRPC_STATUS } from '../src/enum.js';
import { getRouterHooks, IRPCTransport } from '../src/index.js';
import { IRPCPackage } from '../src/package.js';
import { DeferredHook, IRPCRouter, UnhandledCall } from '../src/router.js';
import { IRPC_STORE } from '../src/store.js';
import type { IRPCRequest } from '../src/types.js';

function createMockRouter() {
  const module = new IRPCPackage();
  const transport = new IRPCTransport();

  // Prevent IRPC_STORE.route() from throwing by spying on it.
  const routeSpy = vi.spyOn(IRPC_STORE, 'route').mockImplementation(() => {});
  const router = new IRPCRouter(module, transport);
  routeSpy.mockRestore();

  return router;
}

describe('IRPCRouter', () => {
  describe('constructor', () => {
    it('should store module and transport references', () => {
      const module = new IRPCPackage();
      const transport = new IRPCTransport();
      const routeSpy = vi.spyOn(IRPC_STORE, 'route').mockImplementation(() => {});

      const router = new IRPCRouter(module, transport);

      expect(router.transport).toBe(transport);
      expect(router.transport.packages.size).toBe(0);
      routeSpy.mockRestore();
    });

    it('should register itself with the IRPC_STORE', () => {
      const routeSpy = vi.spyOn(IRPC_STORE, 'route').mockImplementation(() => {});

      const module = new IRPCPackage();
      const transport = new IRPCTransport();
      const router = new IRPCRouter(module, transport);

      expect(routeSpy).toHaveBeenCalledWith(router);
      routeSpy.mockRestore();
    });

    it('should initialize with an empty hooks array', () => {
      const router = createMockRouter();
      expect(router.hooks).toEqual([]);
    });

    it('should support single transport argument constructor', () => {
      const transport = new IRPCTransport();
      const routeSpy = vi.spyOn(IRPC_STORE, 'route').mockImplementation(() => {});

      const router = new IRPCRouter(transport);

      expect(router.transport).toBe(transport);
      routeSpy.mockRestore();
    });
  });

  describe('packages & packageOf', () => {
    it('should return packages from transport and resolve packageOf', () => {
      const transport = new IRPCTransport();
      const pkg1 = new IRPCPackage({ name: 'pkgA', version: '1.0.0' }).use(transport);
      const pkg2 = new IRPCPackage({ name: 'pkgB', version: '2.0.0' }).use(transport);
      const routeSpy = vi.spyOn(IRPC_STORE, 'route').mockImplementation(() => {});

      const router = new IRPCRouter(transport);

      pkg1.declare('test', () => 'test');

      expect(router.packages).toBe(transport.packages);
      expect(router.packageOf({ package: { name: 'pkgB', version: '2.0.0' } } as AnyType)).toBe(pkg2);
      expect(
        router.packageOf({ name: 'missing', package: { name: 'pkgMissing', version: '1.0.0' } } as AnyType)
      ).toBeUndefined();
      expect(router.packageOf({ name: 'test', args: [] } as AnyType)).toBe(pkg1);

      routeSpy.mockRestore();
    });
  });

  describe('use', () => {
    it('should add a hook function', () => {
      const router = createMockRouter();
      const hook = vi.fn();

      router.use(hook);

      expect(router.hooks).toContain(hook);
    });

    it('should support chaining', () => {
      const router = createMockRouter();
      const mw1 = vi.fn();
      const mw2 = vi.fn();

      const result = router.use(mw1).use(mw2);

      expect(result).toBe(router);
      expect(router.hooks).toEqual([mw1, mw2]);
    });

    it('should log error and return self when hook is not a function', () => {
      const router = createMockRouter();
      const errSpy = vi.spyOn(IRPC_STORE, 'error').mockImplementation(() => {});

      const result = router.use('not-a-function' as AnyType);

      expect(errSpy).toHaveBeenCalled();
      expect(result).toBe(router);
      expect(router.hooks).toHaveLength(0);

      errSpy.mockRestore();
    });
  });

  describe('resolveHooks', () => {
    it('should execute all hooks in order', async () => {
      const router = createMockRouter();
      const order: number[] = [];

      router.use(() => {
        order.push(1);
      });
      router.use(() => {
        order.push(2);
      });
      router.use(() => {
        order.push(3);
      });

      const req = { id: '1', name: 'test' } as IRPCRequest;
      const result = await router['resolveHooks'](req);

      expect(result).toBeUndefined();
      expect(order).toEqual([1, 2, 3]);
    });

    it('should execute async hook', async () => {
      const router = createMockRouter();
      const executed = vi.fn();

      router.use(async () => {
        executed();
      });

      const req = { id: '1', name: 'test' } as IRPCRequest;
      const result = await router['resolveHooks'](req);

      expect(result).toBeUndefined();
      expect(executed).toHaveBeenCalled();
    });

    it('should return error response when hook throws', async () => {
      const router = createMockRouter();
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      router.use(() => {
        throw new Error('Middleware failed');
      });

      const req = { id: '1', name: 'test' } as IRPCRequest;
      const result = await router['resolveHooks'](req);

      expect(result).toEqual({
        id: '1',
        name: 'test',
        type: IRPC_PACKET_TYPE.CLOSE,
        status: IRPC_STATUS.ERROR,
        error: {
          type: 'hook',
          code: 'error',
          message: 'Middleware failed',
        },
        createdAt: expect.any(Number),
      });

      errSpy.mockRestore();
    });

    it('should stop executing remaining hooks after one throws', async () => {
      const router = createMockRouter();
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const afterThrow = vi.fn();

      router.use(() => {
        throw new Error('Failure');
      });
      router.use(afterThrow);

      const req = { id: '1', name: 'test' } as IRPCRequest;
      await router['resolveHooks'](req);

      expect(afterThrow).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('should return error response when async hook rejects', async () => {
      const router = createMockRouter();
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      router.use(async () => {
        throw new Error('Async failure');
      });

      const req = { id: '1', name: 'test' } as IRPCRequest;
      const result = await router['resolveHooks'](req);

      expect(result).toEqual(
        expect.objectContaining({
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
        })
      );

      errSpy.mockRestore();
    });

    it('should return undefined when no hooks are registered', async () => {
      const router = createMockRouter();
      const req = { id: '1', name: 'test' } as IRPCRequest;

      const result = await router['resolveHooks'](req);
      expect(result).toBeUndefined();
    });
  });

  describe('isolate', () => {
    it('should return the handler result', async () => {
      const router = createMockRouter();
      const controller = new AbortController();

      const result = await router.isolate(() => 'hello', controller);

      expect(result).toBe('hello');
    });

    it('should return the async handler result', async () => {
      const router = createMockRouter();
      const controller = new AbortController();

      const result = await router.isolate(async () => 42, controller);

      expect(result).toBe(42);
    });

    it('should execute all hooks before the handler', async () => {
      const router = createMockRouter();
      const controller = new AbortController();
      const order: string[] = [];

      router.use(() => {
        order.push('hook-1');
      });
      router.use(async () => {
        order.push('hook-2');
      });

      await router.isolate(async () => {
        const hooks = getRouterHooks();
        await hooks?.verify();
        order.push('handler');
      }, controller);

      expect(order).toEqual(['hook-1', 'hook-2', 'handler']);
    });

    it('should propagate handler errors', async () => {
      const router = createMockRouter();
      const controller = new AbortController();

      await expect(
        router.isolate(() => {
          throw new Error('handler-boom');
        }, controller)
      ).rejects.toThrow('handler-boom');
    });

    it('should accept custom context entries', async () => {
      const router = createMockRouter();
      const controller = new AbortController();
      const customKey = Symbol('custom');

      const result = await router.isolate(() => 'ok', controller, [[customKey, 'custom-value']]);

      expect(result).toBe('ok');
    });

    it('should default context to empty array', async () => {
      const router = createMockRouter();
      const controller = new AbortController();

      const result = await router.isolate(() => 'default-ctx', controller);

      expect(result).toBe('default-ctx');
    });

    it('should execute preHook before router hooks (line 66)', async () => {
      const router = createMockRouter();
      const controller = new AbortController();
      const order: string[] = [];

      router.use(() => {
        order.push('hook');
      });

      const preHook = () => {
        order.push('preHook');
      };

      await router.isolate(
        async () => {
          const hooks = getRouterHooks();
          await hooks?.verify();
          order.push('handler');
        },
        controller,
        [],
        preHook
      );

      expect(order).toEqual(['preHook', 'hook', 'handler']);
    });

    it('should return cached promise on subsequent verify calls in DeferredHook', async () => {
      const hook = vi.fn().mockResolvedValue('ok');
      const deferred = new DeferredHook([hook]);

      await deferred.verify();
      await deferred.verify();

      expect(hook).toHaveBeenCalledTimes(1);
    });
  });
});

describe('UnhandledCall', () => {
  it('should be a 404 JSON response telling the caller the call could not be resolved', async () => {
    const response = new UnhandledCall();

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.text()).toBe('Unable to resolve call.');
  });
});
