import { getAbortSignal } from './context.js';
import { IRPC_PACKET_TYPE } from './enum.js';
import { HandlerError, ResolveError } from './error.js';
import { IRPCBlob } from './file.js';
import type { IRPCPackage } from './package.js';
import { RemoteState } from './state.js';
import { IRPC_STORE } from './store.js';
import type {
  IRPCData,
  IRPCInputs,
  IRPCOutput,
  IRPCPacketError,
  IRPCParseResult,
  IRPCResponse,
  IRPCSubRequest,
} from './types.js';

/**
 * Resolver class for handling IRPC requests
 *
 * This class is responsible for resolving IRPC requests by validating inputs,
 * executing the requested method, and formatting the response.
 */
export class IRPCResolver {
  /**
   * Getter for the specification of the RPC method
   *
   * Retrieves the specification of the RPC method from the module based on the request
   */
  public get spec() {
    return this.module?.get(this.req);
  }

  /**
   * Creates a new IRPCResolver instance
   *
   * @param req - The IRPC request object containing id, name and arguments
   * @param module - The IRPC package module that contains the method to be executed
   */
  constructor(
    public req: IRPCSubRequest,
    public module?: IRPCPackage
  ) {}

  /**
   * Resolves an IRPC request
   *
   * This method validates the request, parses inputs according to the schema,
   * and forwards the request to the appropriate handler.
   *
   * @returns A promise that resolves to an IRPC response with either the result or an error
   */
  public async resolve(): Promise<IRPCResponse> {
    const { id, name, args, type, callId } = this.req;

    if (type === IRPC_PACKET_TYPE.ASK || type === IRPC_PACKET_TYPE.REPLY) {
      let activeStream = undefined;

      for (const router of IRPC_STORE.routers) {
        const found = router.streams.get(callId!);
        if (found) {
          activeStream = found;
          break;
        }
      }

      if (!activeStream) {
        return { id, name, result: undefined };
      }

      if (type === IRPC_PACKET_TYPE.REPLY) {
        const [data, error] = args as [unknown, IRPCPacketError | undefined];
        activeStream.resolveQuery(id, data, error);
        return { id, name, result: undefined };
      }

      try {
        const [queryType, ...queryArgs] = args as [string, ...unknown[]];
        const result = await activeStream.answerQuery(queryType, queryArgs);
        return { id, name, result };
      } catch (error) {
        return { id, name, error: HandlerError.failed(error as Error).json() };
      }
    }

    // Check if the requested method exists in the module
    if (!this.spec) {
      return { id, name, error: ResolveError.notFound(name).json() };
    }

    const { schema } = this.spec;
    const inputs = parseInput(args, schema?.input);

    // Validate inputs against the schema
    if (!inputs.success) {
      return { id, name, error: ResolveError.invalidInput(inputs.error).json() };
    }

    // Forward the validated request
    return this.forward({ id, name, args: inputs.data }, schema?.output);
  }

  /**
   * Forwards a validated request to the module's resolver
   *
   * @param req - The validated IRPC request object
   * @param schema - Optional output schema for result validation
   * @returns A promise that resolves to an IRPC response with the result or an error
   */
  public async forward({ id, name, args }: IRPCSubRequest, schema?: IRPCOutput): Promise<IRPCResponse> {
    const signal = getAbortSignal();
    const req = { id, name, args };

    try {
      await this.module!.resolveGuards(req);
      if (signal?.aborted) return { id, name };
      await this.module!.resolveHooks(req);
      if (signal?.aborted) return { id, name };

      const result = this.module!.resolve(req);

      if (result instanceof RemoteState) {
        const output = parseOutput(result.data, schema);

        if (!output.success) {
          return { id, name, error: ResolveError.invalidOutput(output.error).json() };
        }

        return { id, name, result };
      }

      // A blob is a pointer the caller loads; awaiting it here would load it on the server.
      if (result instanceof IRPCBlob) return { id, name, result };

      const data = await result;

      if (data instanceof RemoteState) {
        data.unpipe();

        const output = parseOutput(data.data, schema);

        if (!output.success) {
          return { id, name, error: ResolveError.invalidOutput(output.error).json() };
        }

        return { id, name, result: data };
      }

      const output = parseOutput(data, schema);

      // Validate output against schema if provided
      if (output.success) {
        return { id, name, result: output.data };
      } else {
        return { id, name, error: ResolveError.invalidOutput(output.error).json() };
      }
    } catch (error) {
      // Handle any unexpected errors during execution
      return { id, name, error: HandlerError.failed(error as Error).json() };
    }
  }
}

/**
 * Parses and validates input arguments against their schemas, the same check at both ends of a
 * call: where it is made, and where it is resolved. Trailing arguments may be left out when their
 * schemas accept `undefined` (optional ones); more arguments than schemas is invalid.
 *
 * @param args - Array of input arguments
 * @param schema - Optional schema for validating the arguments
 * @returns Parsed result with success status and any error messages
 */
export function parseInput(args: unknown[], schema?: IRPCInputs) {
  if (schema && args.length > schema.length) {
    return {
      data: args as IRPCData[],
      success: false,
      error: 'Invalid arguments',
    };
  }

  // Every schema is checked, so a left-out argument still has to be optional.
  const parsed = (schema ?? args).map((_, i) => {
    const input = schema?.[i];
    return input ? input.safeParse(args[i]) : { success: true, data: args[i] };
  }) as IRPCParseResult[];

  return {
    // Only the arguments given, so a left-out one stays absent rather than becoming undefined.
    data: parsed.slice(0, args.length).map((arg) => arg.data) as IRPCData[],
    error: parsed
      .filter((arg) => !arg.success)
      .map((arg) => arg.error?.message)
      .join('\n'),
    success: parsed.every((arg) => arg.success),
  };
}

/**
 * Parses and validates output result against its schema
 *
 * @param result - The result to validate
 * @param schema - Optional schema for validating the result
 * @returns Parsed result with success status and any error messages
 */
function parseOutput(result: unknown, schema?: IRPCOutput) {
  return schema
    ? schema.safeParse(result)
    : ({
        success: true,
        data: result,
      } as IRPCParseResult);
}
