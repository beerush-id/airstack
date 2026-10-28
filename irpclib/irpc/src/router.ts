import { createContextStore, withContext } from './context.js';
import { IRPC_BASE_CONTEXT, IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import { HookError, StubError } from './error.js';
import type { IRPCPackage } from './package.js';
import { IRPC_STORE } from './store.js';
import { IRPCTransport } from './transport.js';
import type {
  IRPCData,
  IRPCInputs,
  IRPCOutput,
  IRPCRequest,
  IRPCSpec,
  IRPCSubRequest,
  IRPCTool,
  MCPOptions,
} from './types.js';
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
   * Describes the tools of every package this router serves as MCP tools, for agents calling in
   * from outside: the name to call, the description, the input object's JSON Schema (generated from
   * the input schemas) and the hints.
   *
   * @returns The MCP tool descriptions, package by package in declaration order.
   */
  public getTools(): IRPCTool[] {
    return [...this.packages].flatMap((pkg) =>
      [...pkg.entries()].map(([name]) => pkg.get(name)!).filter((spec) => spec.mcp).map(toTool)
    );
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

/** A schema as a router reads it for tools: zod schemas report their type and convert themselves to JSON Schema. */
type DescribedSchema = { type?: string; toJSONSchema?: () => Record<string, unknown> };

/**
 * Describes a function as an MCP tool. The JSON Schema comes from the schemas themselves, so irpc
 * needs no schema library of its own.
 *
 * @param spec - The function's spec, marked `mcp`.
 * @returns The tool description.
 */
function toTool(spec: IRPCSpec<IRPCInputs, IRPCOutput>): IRPCTool {
  const options: MCPOptions = spec.mcp === true || !spec.mcp ? {} : spec.mcp;
  const description = options.description ?? spec.description;
  const annotations: IRPCTool['annotations'] = {};
  for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
    if (options[hint] !== undefined) annotations[hint] = options[hint];
  }

  return {
    name: spec.name,
    ...(options.title ? { title: options.title } : {}),
    ...(description ? { description } : {}),
    inputSchema: toInputSchema(spec.name, spec.schema?.input, options.args),
    ...(Object.keys(annotations).length ? { annotations } : {}),
  };
}

/**
 * The JSON Schema of a tool's one input object: an object of the named positional arguments, the
 * function's own object input, or an empty object when it takes nothing.
 *
 * @param name - The function's name, for the error.
 * @param inputs - The function's input schemas, if any.
 * @param args - The positional argument names from the mcp options, if any.
 * @returns The input object's JSON Schema.
 * @throws StubError when the function takes positional arguments its mcp options don't name.
 */
function toInputSchema(name: string, inputs: IRPCInputs = [], args?: string[]): Record<string, unknown> {
  if (args) {
    if (inputs.length && inputs.length !== args.length) throw StubError.invalidTool(name);

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    args.forEach((arg, i) => {
      const schema = inputs[i] as DescribedSchema | undefined;
      properties[arg] = schema ? jsonSchemaOf(schema) : {};
      // Without a schema, optionality is unknown, so nothing is claimed required.
      if (schema && schema.type !== 'optional') required.push(arg);
    });
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
  }

  if (!inputs.length) return { type: 'object', properties: {} };
  if (inputs.length === 1 && (inputs[0] as DescribedSchema).type === 'object') {
    return jsonSchemaOf(inputs[0] as DescribedSchema);
  }
  throw StubError.invalidTool(name);
}

/**
 * A schema's JSON Schema, without the `$schema` dialect marker tools don't carry.
 *
 * @param schema - A schema that converts itself to JSON Schema.
 * @returns Its JSON Schema, or an empty schema when it can't convert itself.
 */
function jsonSchemaOf(schema: DescribedSchema): Record<string, unknown> {
  const { $schema: _, ...json } = schema.toJSONSchema?.() ?? {};
  return json;
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
