import { createContextStore, withContext } from './context.js';
import { IRPC_BASE_CONTEXT, IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import { HookError } from './error.js';
import type { IRPCPackage } from './package.js';
import { IRPC_STORE } from './store.js';
import { IRPCTransport } from './transport.js';
import type { IRPCData, IRPCRequest, IRPCSubRequest } from './types.js';
import type { IRPCStream } from './stream.js';

export type IRPCHook = () => void | Promise<void>;

export class IRPCRouter {
  /** Array of middleware functions to be executed */
  public hooks: IRPCHook[] = [];
  public transport: IRPCTransport;
  /** Active streams indexed by their call ID */
  public streams = new Map<string, IRPCStream<IRPCData>>();

  public get packages() {
    return this.transport.packages;
  }

  /**
   * Creates a new Router instance
   * @param transport - The transport mechanism to use for resolving requests.
   */
  constructor(transport: IRPCTransport);
  /**
   * Creates a new Router instance
   * @param {IRPCPackage} module - The IRPC package module to resolve requests against.
   * @param {IRPCTransport} transport - The transport mechanism to use for resolving requests.
   */
  constructor(module: IRPCPackage, transport: IRPCTransport);

  /**
   * Creates a new Router instance
   * @param {IRPCPackage} module - The IRPC package module to resolve requests against
   * @param {IRPCTransport} transport - The transport mechanism to use for resolving requests
   */
  constructor(module: IRPCPackage | IRPCTransport, transport?: IRPCTransport) {
    if (module instanceof IRPCTransport) {
      this.transport = module;
    } else {
      this.transport = transport!;
    }

    IRPC_STORE.route(this);
  }

  /**
   * Returns the IRPC package module associated with the router for a given request.
   * @param req - The IRPC request to resolve.
   * @returns The IRPC package module associated with the router for the given request or undefined.
   */
  public packageOf(req: IRPCRequest) {
    if (req.package) {
      for (const pkg of this.packages) {
        if (pkg.config.name === req.package.name && pkg.config.version === req.package.version) {
          return pkg;
        }
      }
    }

    for (const pkg of this.packages) {
      if (pkg.get(req.name)) {
        return pkg;
      }
    }
  }

  /**
   * Adds a hook function to the router
   * @param hook - The hook function to add
   * @returns The current Router instance for chaining
   */
  public use(hook: IRPCHook): this {
    if (typeof hook !== 'function') {
      const error = HookError.invalid();
      IRPC_STORE.error(error);
      return this;
    }

    this.hooks.push(hook);
    return this;
  }

  /**
   * Run a function within an isolated IRPC Router context.
   * This make sure any subsequent RPC calls will be seeded with the hooks added to the router.
   *
   * @param handler - The handler function to isolate
   * @param controller - The AbortController to use for cancellation
   * @param context - Additional context to pass to the handler
   * @param preHook - A hook function to run before the router hooks
   * @returns The result of the isolated handler function
   */
  public isolate<T>(
    handler: () => T | Promise<T>,
    controller: AbortController,
    context: Array<[string | symbol, unknown]> = [],
    preHook?: IRPCHook
  ) {
    const ctx = createContextStore([
      [IRPC_BASE_CONTEXT.ABORT_SIGNAL, controller.signal],
      [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, controller],
      [IRPC_BASE_CONTEXT.DEFERRED_HOOK, new DeferredHook(this.hooks)],
      ...context,
    ]);

    return withContext(ctx, async () => {
      await preHook?.();
      return handler();
    });
  }

  /**
   * Resolves hook functions for a given request
   * @param req - The IRPC request to process hook for
   * @returns An error response if hook fails, undefined otherwise
   */
  protected async resolveHooks(req: IRPCSubRequest) {
    for (const hook of this.hooks) {
      try {
        await hook();
      } catch (error) {
        IRPC_STORE.error(error as Error, [req.id, req.name]);

        return {
          id: req.id,
          name: req.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: HookError.failed(error as Error).json(),
          createdAt: Date.now(),
        };
      }
    }
  }
}

/**
 * Special response to indicate that a worker can't handle/resolve the call.
 */
export class UnhandledCall extends Response {
  constructor() {
    super('Unable to resolve call.', {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export class DeferredHook {
  private promise?: Promise<unknown>;

  constructor(public hooks: IRPCHook[]) {}

  public async verify() {
    if (!this.promise) {
      this.promise = Promise.all(this.hooks.map((hook) => hook()));
    }

    return this.promise;
  }
}
