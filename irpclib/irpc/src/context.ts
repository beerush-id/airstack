import { AsyncStore, createContext, getContext, setAsyncScope, setContext, withIsolation } from '@airlib/core';
import { IRPC_BASE_CONTEXT } from './enum.js';
import type { DeferredHook } from './router.ts';
import type { IRPCContext, IRPCContextProvider } from './types.js';

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
 * Executes a function with the provided context.
 * If a context store is available, it runs the function within that context.
 * Otherwise, it executes the function directly.
 * @param ctx - The context to run the function with
 * @param fn - The function to execute
 * @returns The result of the executed function
 */
export function withContext<R>(ctx: IRPCContext<string | symbol, unknown>, fn: () => R) {
  return withIsolation(fn, true, ctx);
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
