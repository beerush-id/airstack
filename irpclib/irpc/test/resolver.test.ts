import { sleep } from '@airlib/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HandlerError, IRPC_STATUS, type IRPCHandler, IRPCRouter, IRPCTransport } from '../src/index.js';
import { createPackage } from '../src/package.js';
import { IRPCResolver } from '../src/resolver.js';
import { RemoteState } from '../src/state.js';

describe('IRPC Resolver', () => {
  describe('Resolve Request', () => {
    it('should resolve valid request', async () => {
      const rpc = createPackage();
      type TestFunc = (input: { name: string }) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });

      const handler: TestFunc = async (input) => `Hello ${input.name}`;
      rpc.construct(testFunc, handler);

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [{ name: 'World' }],
        },
        rpc
      );

      const result = await resolver.resolve();
      expect(result).toEqual({
        id: '1',
        name: 'testFunc',
        result: 'Hello World',
      });
    });

    it('should resolve valid RemoteState request', async () => {
      const rpc = createPackage();
      type TestFunc = (input: { name: string }) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });

      const handler: TestFunc = (input) => {
        const state = new RemoteState<string>(`Hello ${input.name}`);
        state.status = IRPC_STATUS.SUCCESS;
        return state;
      };
      rpc.construct(testFunc, handler);

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [{ name: 'World' }],
        },
        rpc
      );

      const result = await resolver.resolve();

      expect(result.id).toEqual('1');
      expect(result.name).toEqual('testFunc');
      expect((result.result as RemoteState<string>).status).toEqual(IRPC_STATUS.SUCCESS);
    });

    it('should resolve invalid RemoteState request', async () => {
      const rpc = createPackage();
      type TestFunc = (input: { name: string }) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({
        name: 'testFunc',
        seed: () => '',
        schema: {
          output: z.number(),
        },
      });

      const handler: TestFunc = (input) => {
        const state = new RemoteState<string>(`${input.name}`);
        state.status = IRPC_STATUS.SUCCESS;
        return state;
      };
      rpc.construct(testFunc, handler);

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [{ name: 'World' }],
        },
        rpc
      );

      const result = await resolver.resolve();

      expect(result.id).toEqual('1');
      expect(result.name).toEqual('testFunc');
      expect(result.error).toEqual({
        type: 'resolve',
        code: 'invalid_output',
        message: expect.any(String),
      });
      expect(result.result).toBeUndefined();
    });

    it('should return error for non-existent function', async () => {
      const rpc = createPackage();
      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'nonExistent',
          args: [],
        },
        rpc
      );

      const result = await resolver.resolve();
      expect(result).toEqual({
        id: '1',
        name: 'nonExistent',
        error: {
          type: 'resolve',
          code: 'not_found',
          message: 'IRPC "nonExistent" does not exist.',
        },
      });
    });

    it('should validate input against schema', async () => {
      const rpc = createPackage();
      type TestFunc = (name: string) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({
        name: 'testFunc',
        seed: () => '',
        schema: {
          input: [z.string()],
        },
      });

      const handler: TestFunc = async (name) => `Hello ${name}`;
      rpc.construct(testFunc, handler);

      // Valid input
      const resolver1 = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: ['World'],
        },
        rpc
      );

      const result1 = await resolver1.resolve();
      expect(result1).toEqual({
        id: '1',
        name: 'testFunc',
        result: 'Hello World',
      });

      // Invalid input
      const resolver2 = new IRPCResolver(
        {
          id: '2',
          name: 'testFunc',
          args: [123], // Number instead of string
        },
        rpc
      );

      const result2 = await resolver2.resolve();
      expect(result2).toEqual({
        id: '2',
        name: 'testFunc',
        error: {
          type: 'resolve',
          code: 'invalid_input',
          message: expect.any(String),
        },
      });

      // Invalid argument size
      const resolver3 = new IRPCResolver(
        {
          id: '3',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      const result3 = await resolver3.resolve();
      expect(result3).toEqual({
        id: '3',
        name: 'testFunc',
        error: {
          type: 'resolve',
          code: 'invalid_input',
          message: expect.any(String),
        },
      });
    });

    it('should validate output against schema', async () => {
      const rpc = createPackage();
      type TestFunc = () => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({
        name: 'testFunc',
        seed: () => '',
        schema: {
          output: z.string(),
        },
      });

      // Valid output
      const handler1: TestFunc = async () => 'Valid String';
      rpc.construct(testFunc, handler1);

      const resolver1 = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      const result1 = await resolver1.resolve();
      expect(result1).toEqual({
        id: '1',
        name: 'testFunc',
        result: 'Valid String',
      });

      // Invalid output
      type BadTestFunc = () => Promise<number>;
      const badHandler: BadTestFunc = async () => 123;
      rpc.construct(testFunc, badHandler as never); // Number instead of string

      const resolver2 = new IRPCResolver(
        {
          id: '2',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      const result2 = await resolver2.resolve();
      expect(result2).toEqual({
        id: '2',
        name: 'testFunc',
        error: {
          type: 'resolve',
          code: 'invalid_output',
          message: expect.any(String),
        },
      });
    });

    it('should handle function exceptions', async () => {
      const rpc = createPackage();
      const testFunc = rpc.declare<IRPCHandler>({
        name: 'testFunc',
      });

      rpc.construct(testFunc, async () => {
        throw new Error('Function error');
      });

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      const result = await resolver.resolve();
      expect(result).toEqual({
        id: '1',
        name: 'testFunc',
        error: {
          type: 'handler',
          code: 'error',
          message: 'Function error',
        },
      });
    });

    it('should keep the code of a handler error', async () => {
      const rpc = createPackage();
      type TestFunc = () => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });
      rpc.construct(testFunc, async () => {
        throw new HandlerError('usage_limit', 'Limit reached');
      });

      const resolver = new IRPCResolver({ id: '1', name: 'testFunc', args: [] }, rpc);

      expect(await resolver.resolve()).toEqual({
        id: '1',
        name: 'testFunc',
        error: { type: 'handler', code: 'usage_limit', message: 'Limit reached' },
      });
    });

    it('should resolve piped RemoteState from async handler', async () => {
      const rpc = createPackage();
      type TestFunc = (input: string) => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({ name: 'testFunc', seed: () => '' });

      const handler: TestFunc = async (input) => {
        const state = new RemoteState<string>(`Hello ${input}`);
        state.status = IRPC_STATUS.SUCCESS;
        return state.pipe() as any;
      };
      rpc.construct(testFunc, handler);

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: ['World'],
        },
        rpc
      );

      const result = await resolver.resolve();

      expect(result.id).toEqual('1');
      expect(result.name).toEqual('testFunc');
      expect(result.result).toBeInstanceOf(RemoteState);
      expect((result.result as RemoteState<string>).data).toEqual('Hello World');
      // Verify unpipe() was called — .then should be restored.
      expect((result.result as RemoteState<string>).then).toBeDefined();
    });

    it('should return error for piped RemoteState with invalid output schema', async () => {
      const rpc = createPackage();
      type TestFunc = () => Promise<string>;
      const testFunc = rpc.declare<TestFunc>({
        name: 'testFunc',
        seed: () => '',
        schema: {
          output: z.number(),
        },
      });

      const handler: TestFunc = async () => {
        const state = new RemoteState<string>('not-a-number');
        state.status = IRPC_STATUS.SUCCESS;
        return state.pipe() as any;
      };
      rpc.construct(testFunc, handler);

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      const result = await resolver.resolve();

      expect(result.id).toEqual('1');
      expect(result.name).toEqual('testFunc');
      expect(result.error).toEqual({
        type: 'resolve',
        code: 'invalid_output',
        message: expect.any(String),
      });
      expect(result.result).toBeUndefined();
    });
  });

  describe('Resolve Spec', () => {
    it('should get spec from module', () => {
      const rpc = createPackage();
      const testFunc = rpc.declare({
        name: 'testFunc',
        description: 'Test function',
      });

      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'testFunc',
          args: [],
        },
        rpc
      );

      expect(typeof testFunc).toBe('function');
      expect(resolver.spec).toBeDefined();
      expect(resolver.spec?.name).toBe('testFunc');
      expect(resolver.spec?.description).toBe('Test function');
    });

    it('should return undefined for non-existent spec', () => {
      const rpc = createPackage();
      const resolver = new IRPCResolver(
        {
          id: '1',
          name: 'nonExistent',
          args: [],
        },
        rpc
      );

      expect(resolver.spec).toBeUndefined();
    });

    it('should quit when call aborted during guard verification', async () => {
      const transport = new IRPCTransport();
      const rpc = createPackage();

      rpc.use(transport);
      rpc.guard(() => Promise.resolve());
      rpc.declare({ name: 'aborted' });

      const router = new IRPCRouter(transport);
      const resolver = new IRPCResolver({ id: '1', name: 'aborted', args: [] }, rpc);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        const result = await resolver.resolve();
        expect(result).toEqual({ id: '1', name: 'aborted' });
      }, controller);

      controller.abort();
      await promise;
    });

    it('should quit when call aborted during guard verification', async () => {
      const transport = new IRPCTransport();
      const rpc = createPackage();

      rpc.use(transport);
      rpc.guard(async () => {
        await sleep(5);
        return;
      });

      const fn = rpc.declare({ name: 'aborted' });
      rpc.hook(fn, async () => {
        await sleep(5);
        return;
      });

      const router = new IRPCRouter(transport);
      const resolver = new IRPCResolver({ id: '1', name: 'aborted', args: [] }, rpc);

      const controller = new AbortController();
      const promise = router.isolate(async () => {
        const result = await resolver.resolve();
        expect(result).toEqual({ id: '1', name: 'aborted' });
      }, controller);

      await vi.advanceTimersByTimeAsync(5);
      controller.abort();

      await vi.advanceTimersByTimeAsync(5);
      await promise;
    });
  });
});
