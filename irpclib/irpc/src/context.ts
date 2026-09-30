import { AsyncStore, createContext, getContext, setAsyncScope, setContext, withIsolation } from '@airlib/core';
import { IRPC_BASE_CONTEXT } from './enum.js';
import type { DeferredHook } from './router.ts';
import type { AnyType, IRPCContext, IRPCContextProvider } from './types.js';

export { createContext, getContext, setContext };

/**
 * Sets the global context store for the IRPC system.
 * This store is used to manage context data across requests.
 * @param store - The context store implementation to use
 */
export function setContextProvider(store: IRPCContextProvider) {
  setAsyncScope(store);
}

/**
 * Executes a function within an fresh context.
 * @param fn - The function to execute
 * @returns The result of the executed function
 */
export function withContext<R>(fn: () => R): R;
/**
 * Creates a new context with the given initial values and executes a function within that context.
 * @param seed - An array of key-value pairs to initialize the context
 * @param fn - The function to execute within the context
 * @returns The result of the executed function
 */
export function withContext<R>(seed: Array<[string | symbol, AnyType]>, fn: () => R): R;
/**
 * Executes a function with the provided context.
 * If a context store is available, it runs the function within that context.
 * Otherwise, it executes the function directly.
 * @param store - The context to run the function with
 * @param fn - The function to execute
 * @returns The result of the executed function
 */
export function withContext<R>(store: IRPCContext<string | symbol, AnyType>, fn: () => R): R;
export function withContext<R>(
  ctx: IRPCContext<string | symbol, unknown> | Array<[string | symbol, AnyType]> | (() => R),
  fn?: () => R
) {
  if (typeof ctx === 'function') {
    return withIsolation(ctx, true);
  }

  const store = Array.isArray(ctx) ? createContextStore(ctx) : ctx;
  return withIsolation(fn as () => R, true, store);
}

/**
 * Creates a new context map with optional initial values.
 * @param init - Optional initial key-value pairs for the context
 * @returns A new Map instance representing the context
 */
export function createContextStore<K extends string | symbol, V>(init?: [K, V][]) {
  return new AsyncStore(init as [K, V][]);
}

export function getAbortSignal(): AbortSignal | undefined {
  return getContext(IRPC_BASE_CONTEXT.ABORT_SIGNAL);
}

export function getAbortController(): AbortController | undefined {
  return getContext(IRPC_BASE_CONTEXT.ABORT_CONTROLLER);
}

export function getRouterHooks() {
  return getContext<DeferredHook>(IRPC_BASE_CONTEXT.DEFERRED_HOOK);
}
