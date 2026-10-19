import { AsyncScope, type AsyncStore, getAsyncScope } from '@airlib/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createContextStore,
  envCtx,
  getContext,
  getEnv,
  setContext,
  setContextProvider,
  withContext,
} from '../src/context.js';
import type { IRPCContextProvider } from '../src/index.js';

describe('Context', () => {
  describe('Default Provider', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should set and get context within withContext', async () => {
      const result = await withContext(createContextStore(), () => {
        setContext('key', 'value');
        return getContext('key');
      });

      expect(result).toBe('value');
    });

    it('should isolate context between withContext calls', async () => {
      await withContext(createContextStore(), () => {
        setContext('key', 'first');
      });

      const result = await withContext(createContextStore(), () => {
        return getContext('key');
      });

      expect(result).toBeUndefined();
    });

    it('should return fallback when key is not set', async () => {
      const result = await withContext(createContextStore(), () => {
        return getContext('missing', 'fallback');
      });

      expect(result).toBe('fallback');
    });
  });

  describe('withContext Callback Only', () => {
    it('should run the callback in a fresh context when no store is given', async () => {
      const result = await withContext(() => {
        setContext('key', 'value');
        return getContext('key');
      });

      expect(result).toBe('value');
    });

    it('should not leak context written inside a callback-only invocation', async () => {
      await withContext(() => {
        setContext('key', 'first');
      });

      const result = await withContext(() => getContext('key'));

      expect(result).toBeUndefined();
    });

    it('should seed context from key-value pairs', async () => {
      const result = await withContext(
        [
          ['key1', 'value1'],
          ['key2', 'value2'],
        ],
        () => ({ key1: getContext('key1'), key2: getContext('key2') })
      );

      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('Environment Context', () => {
    it('should read env values from the active context', async () => {
      const result = await withContext([[envCtx.key, { API_KEY: 'secret', REGION: 'sg' }]], () => getEnv());

      expect(result).toEqual({ API_KEY: 'secret', REGION: 'sg' });
    });

    it('should let env values override the fallback and keep fallback-only keys', async () => {
      const result = await withContext([[envCtx.key, { API_KEY: 'secret' }]], () =>
        getEnv({ API_KEY: 'stale', REGION: 'us' })
      );

      expect(result).toEqual({ API_KEY: 'secret', REGION: 'us' });
    });

    it('should return fallback entries when no env is set in context', async () => {
      const result = await withContext(() => getEnv({ REGION: 'us' }));

      expect(result).toEqual({ REGION: 'us' });
    });

    it('should return empty object when neither env nor fallback exists', async () => {
      const result = await withContext(() => getEnv());

      expect(result).toEqual({});
    });
  });

  describe('Creating Context', () => {
    it('should create empty context', () => {
      const ctx = createContextStore();
      expect(ctx).toBeInstanceOf(Map);
      expect(ctx.size).toBe(0);
    });

    it('should create context with initial values', () => {
      const ctx = createContextStore([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
      expect(ctx).toBeInstanceOf(Map);
      expect(ctx.size).toBe(2);
      expect(ctx.get('key1')).toBe('value1');
      expect(ctx.get('key2')).toBe('value2');
    });
  });

  describe('Custom Provider', () => {
    it('set custom context provider', async () => {
      const prevProvider = getAsyncScope();
      const nextProvider = new AsyncScope<AsyncStore>();

      setContextProvider(nextProvider as IRPCContextProvider);
      expect(getAsyncScope()).toBe(nextProvider);
      expect(getAsyncScope()).not.toBe(prevProvider);
      setContextProvider(prevProvider as IRPCContextProvider);
    });
  });
});
