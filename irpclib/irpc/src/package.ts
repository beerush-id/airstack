import {
  type AnyType,
  anchor,
  captureStack,
  createObserver,
  isBrowser,
  microtask,
  onCleanup,
  type StateUnsubscribe,
  uuid,
} from '@airlib/core';
import { IRPCCacher } from './cache.js';
import { getAbortSignal, getRouterHooks } from './context.js';
import { IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import { GuardError, HandlerError, HookError, ResolveError, StubError, TransportError } from './error.js';
import { IRPCReader } from './reader.js';
import { RemoteState } from './state.js';
import { IRPC_STORE } from './store.js';
import { IRPCTransport } from './transport.js';
import type {
  IRPCCallConfig,
  IRPCCrudMethod,
  IRPCCrudOptions,
  IRPCCrudStubs,
  IRPCData,
  IRPCDataSchema,
  IRPCDeclareArgs,
  IRPCDeclareConfig,
  IRPCDeclareInit,
  IRPCEntityId,
  IRPCFunction,
  IRPCHandler,
  IRPCInferInit,
  IRPCInputs,
  IRPCObject,
  IRPCOutput,
  IRPCPackageConfig,
  IRPCPackageInfo,
  IRPCQueryMap,
  IRPCReturnOf,
  IRPCSpec,
  IRPCSpecStore,
  IRPCStreamInit,
  IRPCStub,
  IRPCStubStore,
  IRPCSubRequest,
} from './types.js';

const DEFAULT_TIMEOUT = 20000;
const NAME_CONSTRAINT = /^[a-zA-Z0-9\-_]+$/;
const VERSION_CONSTRAINT = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export type IRPCHookArgs<F> = F extends (...args: infer A) => unknown
  ? { name: string; args: A }
  : { name: string; args: unknown[] };
export type IRPCSpecHook<F> = (req: IRPCHookArgs<F>) => void | Promise<void>;
export type IRPCGuard = (req: IRPCSubRequest) => void | Promise<void>;

/**
 * IRPCPackage represents a package containing multiple IRPC (Isomorphic-RPC) specifications
 * and their corresponding stubs. It manages the configuration, transport, and execution
 * of remote procedure calls.
 */
export class IRPCPackage<K extends string = 'id'> {
  /**
   * A map storing all IRPC specifications by their names
   */
  private specs: IRPCSpecStore = new Map();

  private hooks = new Map<IRPCSpec<IRPCInputs, IRPCDataSchema>, Set<IRPCSpecHook<IRPCHandler>>>();

  /**
   * A weak map linking stub functions to their corresponding specifications
   */
  private stubs: IRPCStubStore = new WeakMap();

  /**
   * A map storing caches for each IRPC Entry
   */
  private cache = new WeakMap<IRPCHandler, IRPCCacher>();

  /**
   * Configuration object for the IRPC package
   */
  public config: IRPCPackageConfig = {
    name: 'global',
    version: '1.0.0',
    key: 'id',
    timeout: DEFAULT_TIMEOUT,
  };
  public guards = new Set<IRPCGuard>();

  /**
   * Gets the href URL for this package in the format "name/version"
   */
  public get href(): string {
    return [this.config.name, this.config.version].join('/');
  }

  /**
   * Gets the package information (name, version, and optional description)
   */
  public get info(): IRPCPackageInfo {
    const { name, version, description } = this.config;
    return { name, version, description };
  }

  /**
   * Gets the transport mechanism used for remote calls
   */
  public get transport() {
    return this.config.transport;
  }

  /**
   * Creates a new IRPCPackage instance
   * @param config - Optional partial configuration for the package
   * @throws Error if the package name or version doesn't match the required format
   */
  constructor(config?: Partial<IRPCPackageConfig>) {
    this.configure({ ...config });
    IRPC_STORE.register(this);
  }

  /**
   * Declares a new IRPC specification and returns a callable stub.
   *
   * @param name - The unique name for the IRPC specification.
   * @param seedOrConfig - The initial data seed function, or configuration object.
   * @param config - Optional configuration (if seed was provided).
   * @returns A stub function that can be used to call the IRPC.
   * @throws Error if an IRPC with the same name already exists.
   */
  public declare<F, I extends IRPCInputs = IRPCInputs, O extends IRPCOutput = IRPCOutput>(
    name: string,
    ...args: IRPCDeclareArgs<F, I, O>
  ): IRPCFunction<F>;

  /**
   * Declares a new IRPC specification and returns a callable stub.
   *
   * @param options - The initialization object containing name, seed, and configuration.
   * @returns A stub function that can be used to call the IRPC.
   * @throws Error if an IRPC with the same name already exists.
   */
  public declare<F, I extends IRPCInputs = IRPCInputs, O extends IRPCOutput = IRPCOutput>(
    options: IRPCDeclareInit<F, I, O>
  ): IRPCFunction<F>;

  public declare<F, I extends IRPCInputs = IRPCInputs, O extends IRPCOutput = IRPCOutput>(
    nameOrOptions: string | IRPCDeclareInit<F, I, O>,
    seedOrConfig?: (() => IRPCReturnOf<F>) | (IRPCDeclareConfig<I, O> & IRPCInferInit<IRPCReturnOf<F>>),
    config?: IRPCDeclareConfig<I, O>
  ): IRPCFunction<F> {
    let options: IRPCDeclareInit<F, I, O>;

    if (typeof nameOrOptions === 'string') {
      if (typeof seedOrConfig === 'function') {
        options = { name: nameOrOptions, seed: seedOrConfig, ...config } as IRPCDeclareInit<F, I, O>;
      } else {
        options = { name: nameOrOptions, ...seedOrConfig } as IRPCDeclareInit<F, I, O>;
      }
    } else {
      options = nameOrOptions;
    }
    // @Todo: Remove init() once deprecated.
    const $options = options as IRPCStreamInit<IRPCInputs, IRPCOutput, IRPCData> & { init?: () => unknown };

    if (this.specs.has($options.name)) {
      const error = StubError.duplicate($options.name);
      captureStack.violation.general(
        'Duplicate function detected.',
        `Attempted to declare function "${$options.name}" more than once.`,
        error,
        [
          'Duplicated function lead to untraceable bugs.',
          `- Avoid to declare function with the same name in the same package.`,
          `- Feel free to ignore this if the warning is caused by HMR.`,
        ]
      );
    }

    if ($options.init && !$options.seed) $options.seed = $options.init as never;

    const spec = {
      seed: () => undefined,
      ...($options as object),
      package: { name: this.config.name, version: this.config.version },
    } as IRPCSpec<IRPCInputs, IRPCOutput>;

    if ($options.keepAlive) {
      spec.stream = true;
      spec.timeout = 0;
    }

    const calls = new Map<string, IRPCReader<IRPCData>>();
    const caches = new IRPCCacher();

    /* General stub for immediate execution */
    const stub = ((...args: IRPCData[]) => {
      return resolve(args, true);
    }) as IRPCStub<F, unknown[], IRPCData>;

    /** Browser only stub for single immediate execution **/
    stub.once = (...args: IRPCData[]) => {
      return prepare(() => args);
    };

    /* Browser-only stub with immediate execution */
    stub.with = (getArgs, debounce) => {
      return prepare(getArgs, false, debounce);
    };

    /* Browser-only stub with deferred execution */
    stub.when = (getArgs, debounce) => {
      return prepare(getArgs, true, debounce);
    };

    /* General stub for manual execution */
    stub.later = (debounce) => {
      const reader = new IRPCReader<IRPCData>(uuid(), spec.seed!(), IRPC_STATUS.IDLE, true) as AnyType;

      if (debounce) {
        let resolve: ((value?: unknown) => void) | undefined;
        const [schedule, cancel] = microtask(debounce);

        reader.dispatch = (...args: unknown[]) => {
          resolve?.();

          return new Promise((resolver) => {
            resolve = resolver;

            return schedule(() => {
              reader.resume();
              runAsync(args as IRPCData[], reader).then(resolver);
            });
          });
        };

        onCleanup(() => {
          cancel();
          resolve!();
        });
        return reader;
      }

      reader.dispatch = (...args: unknown[]) => {
        reader.resume();
        return runAsync(args as IRPCData[], reader);
      };

      return reader;
    };

    /**
     * A preparation utility to generate and schedule call on the browser environment.
     *
     * @param getArgs - A function that returns the arguments for the call.
     * @param deferred - A flag indicating whether the call should be deferred.
     * @param debounce - The debounce time in milliseconds.
     * @returns {IRPCReader<IRPCData>} - The reader for the call.
     */
    function prepare(getArgs: () => unknown[], deferred?: boolean, debounce = 0): IRPCReader<IRPCData> {
      if (typeof getArgs !== 'function') getArgs = (() => getArgs) as never;
      const reader = new IRPCReader<IRPCData>(uuid(), spec.seed!(), deferred ? IRPC_STATUS.IDLE : IRPC_STATUS.PENDING);

      /* istanbul ignore else */
      if (isBrowser()) {
        const cleanupHandlers = new Set<StateUnsubscribe>();
        const cleanup = () => {
          cleanupHandlers.forEach((clean) => clean());
        };

        const observer = createObserver(() => {
          // observer.reset();
          dispatch();
        });
        const [schedule, cancel] = microtask(debounce);
        const dispatch = (coalesce = true) => {
          const args = observer.run(getArgs);

          if (!coalesce) {
            cleanup();
            cleanupHandlers.add(resolveTo(reader, args));
            return;
          }

          schedule(() => {
            cleanup();
            reader.resume();
            cleanupHandlers.add(resolveTo(reader, args));
          });
        };

        if (deferred) {
          observer.run(getArgs);
        } else {
          dispatch(false);
        }

        onCleanup(() => {
          cancel();
          cleanup();
          observer.destroy();
        });
      }

      return reader;
    }

    function resolveTo(reader: IRPCReader<IRPCData>, args: unknown[]) {
      const bindSource = (src: IRPCReader<IRPCData>) => {
        void src.pipeTo(reader);
        reader.bindAsk((type, askArgs) => src.ask(type, ...askArgs));
        src.bindAnswer((type, askArgs) => reader.dispatchAnswer(type, askArgs));
      };

      let source = resolve(args, true);
      bindSource(source);

      let off: (() => void) | undefined;

      /* istanbul ignore start - Dev-only HMR signal handler */
      if (import.meta.hot) {
        const onInvalidate = (e: AnyType) => {
          if (e?.type !== 'irpc:invalidate-handler') return;

          source.close();
          source = resolve(args, true, true);
          bindSource(source);
        };

        import.meta.hot.on('custom', onInvalidate as AnyType);
        off = () => import.meta.hot?.off('custom', onInvalidate as AnyType);
      }
      /* istanbul ignore stop */

      return () => {
        /* istanbul ignore next */
        off?.();
        source.close();
      };
    }

    function resolve(args: unknown[], dispatch?: boolean, force?: boolean) {
      const callKey = JSON.stringify(args);
      const cached = !force && caches.get(callKey);

      if (cached) return cached.value!;
      if (spec.coalesce !== false && calls.has(callKey)) return calls.get(callKey)!;

      const reader = new IRPCReader<IRPCData>(uuid(), spec.seed!(), IRPC_STATUS.PENDING, false);

      if (spec.maxAge) caches.set(callKey, reader, spec.maxAge);
      if (spec.coalesce !== false) {
        calls.set(callKey, reader);
        const unsubscribe = reader.packetSubscribe((p) => {
          if (reader.is(p, IRPC_PACKET_TYPE.ANSWER)) {
            calls.delete(callKey);
            unsubscribe();
          }
        });
        reader
          .finally(() => {
            calls.delete(callKey);
            unsubscribe();
          })
          .catch((_err) => {});
      }

      onCleanup(() => reader.close());

      /* istanbul ignore next */
      if (dispatch) runAsync(args as IRPCData[], reader).then(() => {});

      return reader;
    }

    const runAsync = async (args: IRPCData[], reader: IRPCReader<IRPCData>) => {
      if (!this.transport && typeof spec.handler !== 'function') {
        reader.reject(TransportError.missing());
        return;
      }

      const req = { id: reader.id, name: spec.name, args };
      const hooks = this.hooks.get(spec)!;
      const signal = getAbortSignal();
      const routerHooks = getRouterHooks();

      try {
        reader.status = IRPC_STATUS.PENDING;

        if (routerHooks) {
          await routerHooks.verify();
          if (signal?.aborted) {
            reader.abort();
            return;
          }
        }

        /* istanbul ignore else */
        if (this.guards.size) {
          await this.resolveGuards(req);
          /* istanbul ignore else */
          if (signal?.aborted) {
            reader.abort();
            return;
          }
        }

        await Promise.all(Array.from(hooks).map((hook) => hook(req)));
        if (signal?.aborted) {
          reader.abort();
          return;
        }

        const { timeout, maxRetries, retryDelay, retryMode, standalone, bypassLocal } = { ...this.config, ...spec };
        const config = { timeout, maxRetries, retryDelay, retryMode, standalone } as IRPCCallConfig;

        if (typeof spec.handler === 'function' && !bypassLocal) {
          intercept(spec, args, reader);
        } else {
          this.transport!.call(spec, args, config, reader);
        }
      } catch (error) {
        reader.reject(HandlerError.failed(error as Error));
      }
    };

    this.specs.set($options.name, spec);
    this.stubs.set(stub, spec);
    this.cache.set(stub, caches);
    this.hooks.set(spec, new Set());

    return stub as IRPCFunction<F>;
  }

  /**
   * Declares CRUD stubs (get, create, update, delete) for an entity
   * @param name - The entity name used as prefix for stub names
   * @param seed - Factory function returning a default entity instance
   * @param options - Optional configuration for caching, schemas, and call behavior
   * @returns An object containing the four CRUD stub functions
   */
  public crud<T extends IRPCObject, I extends IRPCObject = T, U extends IRPCObject = T, CK extends string = K>(
    name: string,
    seed: () => T,
    options?: IRPCCrudOptions
  ): IRPCCrudStubs<T, CK, I, U> {
    const { description, schema, maxAge, coalesce, ...callConfig } = options ?? {};

    const desc = (method: IRPCCrudMethod) => (typeof description === 'string' ? description : description?.[method]);
    const init = (method: IRPCCrudMethod) =>
      ({
        ...callConfig,
        name: `${name}.${method}`,
        seed,
        description: desc(method),
        schema: schema?.[method],
        ...(method === 'get' ? { maxAge } : {}),
        coalesce,
      }) as never;

    return {
      get: this.declare<(id: IRPCEntityId<T, CK>) => Promise<T>>(init('get')),
      create: this.declare<(data: I) => Promise<T>>(init('create')),
      update: this.declare<(id: IRPCEntityId<T, CK>, data: U) => Promise<T>>(init('update')),
      delete: this.declare<(id: IRPCEntityId<T, CK>) => Promise<T>>(init('delete')),
    } as IRPCCrudStubs<T, CK, I, U>;
  }

  /**
   * Removes CRUD methods from a stubs object and unregisters their specs
   * @param stubs - The CRUD stubs object to modify
   * @param keys - The method names to remove
   * @returns The stubs object without the excluded methods
   */
  public exclude<S extends object, E extends IRPCCrudMethod>(stubs: S, keys: E[]): Omit<S, E> {
    for (const key of keys) {
      const stub = (stubs as Record<string, unknown>)[key];
      if (stub) {
        const spec = this.stubs.get(stub as never);
        if (spec) this.specs.delete(spec.name);
        this.stubs.delete(stub as never);
      }
      delete (stubs as Record<string, unknown>)[key];
    }

    return stubs as Omit<S, E>;
  }

  /**
   * Resolves and executes an IRPC call based on a request object
   * @param req - The request containing the IRPC name and arguments
   * @returns The result of the IRPC execution
   * @throws Error if the IRPC doesn't exist or doesn't have an implementation
   */
  public resolve(req: IRPCSubRequest): IRPCData | Promise<IRPCData> | RemoteState<IRPCData> {
    const spec = this.specs.get(req.name);

    if (!spec) {
      return Promise.reject(ResolveError.notFound(req.name)) as never;
    }

    if (typeof spec.handler !== 'function') {
      return Promise.reject(HandlerError.missing(req.name)) as never;
    }

    return spec.handler(...(req.args as IRPCData[]));
  }

  /**
   * Associates a handler function with a stub function
   * @param stub - The stub function created by declare()
   * @param handler - The actual implementation function
   * @returns This IRPCPackage instance for chaining
   * @throws Error if the stub or handler is invalid, or if no IRPC exists for the stub
   */
  public construct<F, A extends unknown[], R extends IRPCData, Q extends IRPCQueryMap = IRPCQueryMap>(
    stub: IRPCStub<F, A, R, Q>,
    handler: NoInfer<F>
  ): this {
    if (typeof stub !== 'function') {
      throw StubError.invalid();
    }

    if (typeof handler !== 'function') {
      throw HandlerError.invalid();
    }

    const spec = this.stubs.get(stub);

    if (!spec?.name) {
      throw StubError.notFound();
    }

    spec.handler = handler;

    return this;
  }

  /**
   * Registers a hook for a specific stub.
   * @param stub - The stub function created by declare().
   * @param handler - The hook function to register.
   */
  public hook<F extends IRPCHandler>(stub: F, handler: IRPCSpecHook<F>): this;
  /**
   * Registers a hook for all stubs in a group (e.g., CRUD).
   * @param stubs - An object whose values are stub functions.
   * @param handler - The hook function to register.
   */
  public hook(stubs: Record<string, IRPCHandler>, handler: IRPCSpecHook<IRPCHandler>): this;

  public hook<F extends IRPCHandler>(stubOrGroup: F | Record<string, IRPCHandler>, handler: IRPCSpecHook<F>): this {
    if (typeof handler !== 'function') throw HookError.invalid();

    if (typeof stubOrGroup === 'function') {
      if (!this.stubs.has(stubOrGroup as IRPCHandler)) {
        const error = StubError.notFound();
        IRPC_STORE.error(error);
        return this;
      }

      const spec = this.stubs.get(stubOrGroup as IRPCHandler)!;
      this.hooks.get(spec)!.add(handler as IRPCSpecHook<IRPCHandler>);
      return this;
    }

    for (const stub of Object.values(stubOrGroup)) {
      if (typeof stub === 'function' && this.stubs.has(stub as IRPCHandler)) {
        const spec = this.stubs.get(stub as IRPCHandler)!;
        this.hooks.get(spec)!.add(handler as IRPCSpecHook<IRPCHandler>);
      }
    }

    return this;
  }

  /**
   * Resolves and executes all registered hooks for a given request
   * @param req - The request containing the IRPC name and arguments
   * @returns A promise that resolves when all hooks have been executed
   * @throws Error if no IRPC exists for the request or if the hooks are not registered
   */
  public async resolveHooks(req: IRPCSubRequest): Promise<void> {
    const spec = this.specs.get(req.name);

    if (!spec || !this.hooks.has(spec)) {
      throw StubError.notFound();
    }

    const hooks = this.hooks.get(spec)!;

    for (const hook of hooks) {
      try {
        await hook(req);
      } catch (error) {
        throw HookError.failed(error as Error);
      }
    }
  }

  /**
   * Add guard to an IRPC Package that resolves before the handler is invoked.
   *
   * @param guard - A guard function that will handle the verification.
   * @returns This IRPCPackage instance for chaining
   */
  public guard(guard: IRPCGuard): this {
    if (typeof guard !== 'function') throw GuardError.invalid();
    this.guards.add(guard);
    return this;
  }

  /**
   * Resolves and executes all registered guards for a given request.
   * @param req - The request containing the IRPC name and arguments
   * @returns A promise that resolves when all hooks have been executed
   * @throws Error if no IRPC exists for the request or if the hooks are not registered
   */
  public async resolveGuards(req: IRPCSubRequest): Promise<void> {
    for (const guard of this.guards) {
      try {
        await guard(req);
      } catch (error) {
        throw GuardError.failed(error as Error);
      }
    }
  }

  /**
   * Sets the transport mechanism for this package
   * @param transport - The transport instance to use for remote calls
   * @returns This IRPCPackage instance for chaining
   * @throws Error if the transport is not a valid Transport instance
   */
  public use(transport: IRPCTransport): this {
    if (!((transport as unknown) instanceof IRPCTransport)) {
      throw TransportError.invalid();
    }

    transport.register(this);
    this.config.transport = transport;
    return this;
  }

  /**
   * Retrieves an IRPC specification by name or request object
   * @param query - Either a string name or an IRPCRequest object
   * @returns The IRPC specification or undefined if not found
   */
  public get(query: string | IRPCSubRequest): IRPCSpec<IRPCInputs, IRPCOutput> | undefined {
    if (typeof query === 'string') {
      return this.specs.get(query);
    }

    return this.specs.get(query.name);
  }

  /**
   * Updates the package configuration
   * @param config - Partial configuration object with properties to update
   * @returns This IRPCPackage instance for chaining
   * @throws Error if the provided name or version is invalid
   */
  public configure(config: Partial<IRPCPackageConfig>): this {
    if (config.name && !NAME_CONSTRAINT.test(config.name)) {
      throw StubError.invalidName(config.name!);
    }

    if (config.version && !VERSION_CONSTRAINT.test(config.version)) {
      throw StubError.invalidVersion(config.version!);
    }

    if (config.transport) {
      this.use(config.transport);
    }

    Object.assign(this.config, config);
    return this;
  }

  /**
   * Invalidates the cache for a specific stub and arguments combination
   * @param stub - The IRPC stub function whose cache needs to be invalidated
   * @param args - The arguments array used as cache key
   */
  public invalidate(stub: IRPCHandler, ...args: IRPCData[]) {
    const caches = this.cache.get(stub);

    if (!caches) return;

    if (args.length) {
      caches.delete(JSON.stringify(args));
    } else {
      caches.clear();
    }
  }
}

/**
 * Creates a new IRPCPackage instance with the given configuration
 * @param config - Optional partial configuration for the package
 * @returns A new IRPCPackage instance
 */
export function createPackage<K extends string = 'id'>(
  config?: Partial<IRPCPackageConfig> & { key?: K }
): IRPCPackage<K> {
  return new IRPCPackage<K>(config);
}

/**
 * Intercepts local function call to get an instant response without remote execution.
 *
 * @param reader - The reader object to intercept.
 * @param spec - The IRPC specification for the function call.
 * @param args - The arguments to be passed to the function.
 * @returns {IRPCReader<IRPCData>} - The IRPCReader object for consumer.
 */
export function intercept(
  spec: IRPCSpec<IRPCInputs, IRPCOutput>,
  args: unknown[],
  reader: IRPCReader<IRPCData>
): IRPCReader<IRPCData> {
  const signal = getAbortSignal();
  const abort = () => reader.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const result = spec.handler(...args) as RemoteState<IRPCData>;

    if (!(result instanceof Promise)) {
      reader.accept(result);
      signal?.removeEventListener('abort', abort);
      return reader;
    }

    if (!(result instanceof RemoteState)) {
      (result as Promise<IRPCData>)
        .then((value) => {
          reader.accept(value);
        })
        .catch((err) => {
          reader.reject(err);
        })
        .finally(() => {
          signal?.removeEventListener('abort', abort);
        });

      return reader;
    }

    anchor.assign(reader.state, result.state);

    reader.bindAsk((type, askArgs) => result.dispatchAnswer(type, askArgs));
    result.bindAsk((type, askArgs) => reader.dispatchAnswer(type, askArgs));

    if (result.status !== IRPC_STATUS.PENDING) {
      reader.close();
      return reader;
    }

    const abortAll = () => {
      reader.abort();
      result.abort();
    };

    signal?.addEventListener('abort', abortAll, { once: true });
    signal?.removeEventListener('abort', abort);

    result
      .pipeTo(reader)
      .finally(() => {
        reader.close();
        signal?.removeEventListener('abort', abortAll);
      })
      .catch((_err) => {});
  } catch (error) {
    reader.reject(error as Error);
    signal?.removeEventListener('abort', abort);
  }

  return reader;
}
