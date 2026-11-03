import {
  $do,
  anchor,
  mutable,
  onCleanup,
  replay,
  type StateSubscriber,
  type StateUnsubscribe,
  subscribe,
} from '@airlib/core';
import { getAbortSignal } from './context.js';
import { IRPC_STATUS } from './enum.js';
import { IRPC_ERROR_TYPE, IRPCError } from './error.js';
import type { IRPCData, IRPCQueryMap, IRPCReadable, IRPCStatus, StreamConstructor } from './types.js';

export type IRPCAskBridge = (type: string, args: IRPCData[]) => Promise<unknown>;
export type IRPCAnswerFn = (...args: never[]) => unknown;

/**
 * A reactive state wrapper that implements the standard Promise interface.
 *
 * RemoteState acts as a dual-layer abstraction:
 * 1. For asynchronous execution, it operates as a `Promise<T>` that resolves upon completion or rejects upon failure.
 * 2. For reactive environments, it exposes an `.subscribe()` method to react to intermediate data mutations.
 *
 * @template T - The type of data held by the state.
 * @template Q - The duplex query map type for bi-directional ask/answer operations.
 */
export class RemoteState<T, Q extends IRPCQueryMap = IRPCQueryMap> extends Promise<T> {
  readonly #state: IRPCReadable<T>;
  readonly #accept: (value: T) => void;
  readonly #reject: (error: Error) => void;

  #pipes = new Set<StateUnsubscribe>();
  #answers = new Map<string, IRPCAnswerFn>();
  #answerBridge?: IRPCAskBridge;
  #inflightAsks = new Set<(value?: undefined) => void>();
  #askQueue: Array<{ type: string; args: IRPCData[]; resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
  #askBridge?: IRPCAskBridge;
  #destroyHandlers = new Set<() => void>();
  #closed = false;
  #locked?: this['then'];

  public get state(): IRPCReadable<T> {
    return this.#state;
  }

  /**
   * The current data payload of the state.
   */
  public get data(): T {
    return this.#state.data;
  }
  public set data(data: T) {
    if (this.#closed) return;
    this.#state.data = data;
  }

  /**
   * The current error encountered by the state, if any.
   */
  public get error(): Error | undefined {
    return this.#state.error;
  }
  public set error(error: Error | undefined) {
    if (this.#closed) return;
    this.#state.error = error;
  }

  /**
   * The execution status of the state (PENDING, SUCCESS, ERROR).
   * Transitioning to a terminal status (SUCCESS or ERROR) will automatically resolve or reject the underlying Promise.
   */
  public get status(): IRPCStatus {
    return this.#state.status;
  }
  public set status(status: IRPCStatus) {
    if (this.#closed) return;

    this.state.status = status;

    if (status === IRPC_STATUS.ERROR) {
      this.reject();
    } else if (status === IRPC_STATUS.SUCCESS) {
      this.accept();
    }
  }

  /**
   * Initializes a new RemoteState with an optional initial payload.
   *
   * @param init - An optional starting value for the data payload.
   * @param status - The initial status of the state (PENDING, SUCCESS, ERROR).
   * @param resumable - Whether the state should be resumable after being closed.
   * @param controlled - Whether its owner closes it, rather than the lifecycle it's made in.
   */
  constructor(
    init?: T,
    status: IRPCStatus = IRPC_STATUS.PENDING,
    private resumable?: boolean,
    controlled?: boolean
  ) {
    let acceptFn: (value: T) => void;
    let rejectFn: (error: Error) => void;

    super((resolve, reject) => {
      if (resumable) resolve(init as never);
      acceptFn = resolve;
      rejectFn = reject;
    });

    this.#accept = acceptFn!;
    this.#reject = rejectFn!;

    this.#state = mutable({
      data: init as T,
      error: undefined,
      status,
    });

    if (!controlled) onCleanup(() => this.close());
  }

  /**
   * Transitions the state to SUCCESS and resolves the underlying Promise.
   *
   * @param value - Optional final value to resolve with.
   */
  public accept(value?: T): void;
  public accept(...args: [T]) {
    $do(() => {
      if (this.#closed) return;

      const value = args.length ? args[0] : this.data;

      this.#closed = true;
      this.#state.status = IRPC_STATUS.SUCCESS;
      this.#state.data = value;
      this.#accept(value);
      this.destroy();
    });
  }

  /**
   * Transitions the state to ERROR and rejects the underlying Promise.
   *
   * @param error - Optional error to reject with.
   */
  public reject(error?: Error): void;
  public reject(...args: [Error]) {
    $do(() => {
      if (this.#closed) return;

      if (args.length) {
        this.#state.error = args[0];
      }

      this.#closed = true;
      this.#state.status = IRPC_STATUS.ERROR;
      this.#reject(this.error ?? new IRPCError(IRPC_ERROR_TYPE.CALL, 'unknown', 'Unknown error.'));
      this.destroy();
    });
  }

  /**
   * Aborts the current execution, transitioning the status to ABORTED.
   */
  public abort() {
    $do(() => {
      this.#closed = true;
      this.#state.status = IRPC_STATUS.ABORTED;
      this.#accept(this.data);
      this.destroy();
    });
  }

  /**
   * Subscribes to changes emitted by the internal state.
   *
   * @param handler - A callback function invoked whenever the state mutates.
   * @returns An unsubscribe function to terminate the listener.
   */
  public subscribe(handler: StateSubscriber<IRPCReadable<T>>) {
    const unsubscribe = subscribe(this.state, handler);
    this.#pipes.add(unsubscribe);
    return unsubscribe;
  }

  /**
   * Closes the reactive state and terminates the underlying Promise.
   */
  public close() {
    if (this.#closed) return;

    this.#closed = true;
    this.#accept(this.data);
    this.destroy();
  }

  /**
   * Resumes a closed state if it was marked as resumable.
   */
  public resume() {
    $do(() => {
      this.#closed = false;
      this.error = undefined;
      this.status = IRPC_STATUS.PENDING;
    });
  }

  /**
   * Temporarily disables the `.then()` method to prevent automatic Promise chaining.
   *
   * @returns The current instance for chaining.
   */
  public pipe() {
    this.#locked = this.then;
    // biome-ignore lint/suspicious/noThenProperty: expect override
    // biome-ignore lint/suspicious/noExplicitAny: expect any
    (this as any).then = undefined;
    return this;
  }

  /**
   * Restores the `.then()` method if it was previously locked via `.pipe()`.
   *
   * @returns The current instance for chaining.
   */
  public unpipe() {
    if (!this.#locked) return this;

    // biome-ignore lint/suspicious/noThenProperty: expect override
    // biome-ignore lint/suspicious/noExplicitAny: expect any
    (this as any).then = this.#locked;
    this.#locked = undefined;

    return this;
  }

  /**
   * Sends a duplex query to the remote peer and resolves with its answer.
   * Resolves to `undefined` if the state is closed or the remote peer did not register an answer handler.
   *
   * @param type - The query identifier.
   * @param args - Arguments for the query handler.
   * @returns A Promise resolving to the remote peer's answer or `undefined`.
   */
  public ask<K extends keyof Q & string>(
    type: K,
    ...args: Parameters<Q[K]>
  ): Promise<Awaited<ReturnType<Q[K]>> | undefined> {
    if (this.#closed) return Promise.resolve(undefined);

    if (this.#askBridge) {
      return this.#dispatchAsk(type, args as IRPCData[]) as Promise<Awaited<ReturnType<Q[K]>> | undefined>;
    }

    return new Promise((resolve, reject) => {
      this.#askQueue.push({
        type,
        args: args as IRPCData[],
        resolve: resolve as (v: unknown) => void,
        reject,
      });
    });
  }

  #dispatchAsk(type: string, args: IRPCData[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const cancel = () => {
        this.#inflightAsks.delete(cancel);
        resolve(undefined);
      };

      this.#inflightAsks.add(cancel);

      this.#askBridge!(type, args).then(
        (res) => {
          this.#inflightAsks.delete(cancel);
          resolve(res);
        },
        (err) => {
          this.#inflightAsks.delete(cancel);
          reject(err);
        }
      );
    });
  }

  /**
   * Registers a handler to answer a specific duplex query type from the remote peer.
   *
   * @param type - The query identifier to handle.
   * @param handler - The callback invoked when the remote peer asks this query type.
   * @returns The current instance for chaining.
   */
  public answer<K extends keyof Q & string>(
    type: K,
    handler: (...args: Parameters<Q[K]>) => ReturnType<Q[K]> | Promise<Awaited<ReturnType<Q[K]>>>
  ): this {
    this.#answers.set(type, handler as IRPCAnswerFn);
    return this;
  }

  /**
   * Binds an outbound ask bridge and flushes any queued queries.
   *
   * @param bridge - The transport/stream bridge that dispatches outbound queries.
   */
  public bindAsk(bridge: IRPCAskBridge) {
    this.#askBridge = bridge;

    if (this.#askQueue.length) {
      const pending = this.#askQueue.splice(0, this.#askQueue.length);

      for (const item of pending) {
        this.#dispatchAsk(item.type, item.args).then(item.resolve, item.reject);
      }
    }
  }

  /**
   * Binds a fallback answer bridge to delegate incoming queries to a target state.
   *
   * @param bridge - The target answer dispatcher.
   */
  public bindAnswer(bridge: IRPCAskBridge) {
    this.#answerBridge = bridge;
  }

  /**
   * Executes the registered answer handler for an incoming duplex query.
   * Returns `undefined` if no handler is registered for the given type.
   *
   * @param type - The incoming query identifier.
   * @param args - The arguments provided by the remote caller.
   * @returns The handler's result or `undefined`.
   */
  public async dispatchAnswer(type: string, args: unknown[]): Promise<unknown> {
    const handler = this.#answers.get(type);
    if (typeof handler === 'function') {
      return await (handler as (...a: unknown[]) => unknown)(...args);
    }
    if (this.#answerBridge) {
      return await this.#answerBridge(type, args as IRPCData[]);
    }
    return undefined;
  }

  /**
   * Pipes all state mutations from this instance to a target RemoteState.
   *
   * @param target - The destination RemoteState to receive the updates.
   * @returns The current instance for chaining.
   */
  public pipeTo(target: RemoteState<T, Q>) {
    this.subscribe((_, event) => {
      if (event.type === 'init') {
        anchor.assign(target.state, this.state);
        return;
      }

      if (!anchor.has(target.state)) return;
      // Init and object sets hand the target the source's own objects. A change made inside a shared
      // object has already happened in the target; replaying it would apply a push or splice twice,
      // and the replay would re-emit on the source, forever.
      if (sharesMutated(this.state, target.state, event.keys)) return;
      replay(target.state, event);
    });

    return this;
  }

  /**
   * Registers a handler to run once when this state is torn down: closed, accepted, rejected or
   * aborted. Lets a stream release its resources however the call ends.
   *
   * @param handler - Runs once, before pending asks are settled.
   * @returns The current instance for chaining.
   */
  public onDestroy(handler: () => void): this {
    this.#destroyHandlers.add(handler);
    return this;
  }

  /**
   * Destroys the reactive state bindings.
   */
  protected destroy() {
    if (this.#destroyHandlers.size) {
      const handlers = Array.from(this.#destroyHandlers);
      this.#destroyHandlers.clear();
      for (const handler of handlers) handler();
    }

    if (this.#askQueue.length) {
      const pending = this.#askQueue.splice(0, this.#askQueue.length);
      for (const item of pending) {
        item.resolve(undefined);
      }
    }

    if (this.#inflightAsks.size) {
      for (const cancel of Array.from(this.#inflightAsks)) {
        cancel();
      }
      this.#inflightAsks.clear();
    }

    if (this.resumable) return;

    for (const unsubscribe of this.#pipes) {
      unsubscribe();
    }

    this.#pipes.clear();
    anchor.destroy(this.state);
  }

  /**
   * Ensures that chained Promise operations return standard Promises
   * rather than instantiating new RemoteState subclasses.
   */
  static get [Symbol.species]() {
    return Promise;
  }
}

/**
 * A utility factory to structurally instantiate an active `RemoteState` pipeline natively
 * decoupled from standard Promise chains. This elegantly captures constructor functions
 * pushing events into the state before terminating mechanically via secure internal hooks.
 *
 * @template T - The type of the streamed payload data.
 * @param construct - The isolated stream constructor callback that natively operates the pipeline.
 * @param seed - An optional initial value to prime the state payload inherently.
 * @returns A fully active RemoteState inherently bound to the callbacks executing natively.
 */
export function stream<T, Q extends IRPCQueryMap = IRPCQueryMap>(
  construct: StreamConstructor<T, Q>,
  seed?: NoInfer<T>
): RemoteState<T, Q> {
  const state = new RemoteState<T, Q>(seed);
  const abortSignal = getAbortSignal();

  const accept = ((...values: [T]) => {
    if (values.length > 0) {
      state.data = values[0];
    }

    state.status = IRPC_STATUS.SUCCESS;
    abortSignal?.removeEventListener('abort', abort);
  }) as (value?: T) => void;

  const reject = (error: Error) => {
    state.error = error;
    state.status = IRPC_STATUS.ERROR;
    abortSignal?.removeEventListener('abort', abort);
  };
  const abort = () => state.abort();

  abortSignal?.addEventListener('abort', abort, { once: true });

  try {
    const cleanup = construct(state, accept, reject);

    if (cleanup instanceof Promise) {
      cleanup
        .then((futureCleanup) => {
          if (typeof futureCleanup === 'function') registerCleanup(state, futureCleanup, abortSignal);
        })
        .catch(reject);
    } else if (typeof cleanup === 'function') {
      registerCleanup(state, cleanup, abortSignal);
    }
  } catch (error) {
    reject(error as Error);
  }

  return state;
}

/**
 * Whether the object a mutation changed is the very same object in both states: the value at the
 * event's path (an array that was pushed into), or its parent (an object whose key was set).
 *
 * @param source - The state the event came from.
 * @param target - The state it would be replayed onto.
 * @param keys - The event's path from the state root.
 * @returns True when the target already holds the changed object.
 */
function sharesMutated(source: unknown, target: unknown, keys: unknown[]): boolean {
  if (!keys.length) return false;
  const parentKeys = keys.slice(0, -1);
  const sameAt = (path: unknown[]) => {
    const fromSource = valueAt(source, path);
    return typeof fromSource === 'object' && fromSource !== null && fromSource === valueAt(target, path);
  };
  return sameAt(keys) || (parentKeys.length > 0 && sameAt(parentKeys));
}

/** Reads the value at a path, through plain objects, arrays and Maps. */
function valueAt(root: unknown, keys: unknown[]): unknown {
  let current = root;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = current instanceof Map ? current.get(key) : (current as Record<PropertyKey, unknown>)[key as PropertyKey];
  }
  return current;
}

/**
 * Runs a stream's cleanup exactly once, when its state is torn down: immediately if that already
 * happened, otherwise on whichever comes first, the abort signal or the state being destroyed
 * (closed by the caller, accepted, rejected or aborted).
 */
function registerCleanup<T, Q extends IRPCQueryMap>(
  state: RemoteState<T, Q>,
  cleanup: () => void,
  abortSignal?: AbortSignal
): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    abortSignal?.removeEventListener('abort', run);
    $do(cleanup);
  };

  if (abortSignal?.aborted || state.status !== IRPC_STATUS.PENDING) {
    run();
    return;
  }

  abortSignal?.addEventListener('abort', run, { once: true });
  state.onDestroy(run);
}
