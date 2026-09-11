import type { AsyncValue, StateChange } from '@airlib/core';
import type {
  ZodArray,
  ZodBoolean,
  ZodCustom,
  ZodNull,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodSafeParseResult,
  ZodString,
  ZodUndefined,
} from 'zod/v4';
import type { IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import type { IRPCBlob, IRPCFile } from './file.js';
import type { IRPCFilePointer } from './packet.js';
import type { IRPCReader } from './reader.js';
import type { RemoteState } from './state.js';
import type { IRPCTransport } from './transport.js';

/**
 * A registry that maps IRPCHandlers to their corresponding IRPCHosts.
 * Uses WeakMap to avoid memory leaks by not preventing garbage collection of handlers.
 */
export type IRPCStubStore = WeakMap<IRPCHandler, IRPCSpec<IRPCInputs, IRPCOutput>>;

/**
 * A store that maps string identifiers to IRPCHosts.
 * Used to keep track of available RPC hosts by their names.
 */
export type IRPCSpecStore = Map<string, IRPCSpec<IRPCInputs, IRPCOutput>>;

export type IRPCStatus = (typeof IRPC_STATUS)[keyof typeof IRPC_STATUS];
export type IRPCPacketType = (typeof IRPC_PACKET_TYPE)[keyof typeof IRPC_PACKET_TYPE];

export type IRPCPacketBase = {
  id: string;
  name: string;
  type: IRPCPacketType;
  status: IRPCStatus;
  createdAt?: number;
  arrivedAt?: number;
};

export type IRPCPacketCall = IRPCPacketBase & {
  args: IRPCData[];
};

export type IRPCPacketAnswer<T extends IRPCData> = IRPCPacketBase & {
  data?: T;
  error?: IRPCPacketError;
};

export type IRPCPacketEvent = IRPCPacketBase & {
  data: StateChange;
};

export type IRPCPacketClose = IRPCPacketBase & {
  error?: IRPCPacketError;
};

export type IRPCPacketStream<T extends IRPCData> = IRPCPacketAnswer<T> | IRPCPacketEvent | IRPCPacketClose;

export interface IRPCReadable<T> {
  data: T;
  error: Error | undefined;
  status: IRPCStatus;
}

/**
 * Represents a client-side stub for a remote function.
 * When called, it returns an IRPCReader to handle the asynchronous result or stream.
 *
 * @template T - The original function type.
 * @template A - The argument types of the function.
 * @template R - The return data type.
 */
export interface IRPCStub<T, A extends unknown[], R extends IRPCData> {
  (...args: A): IRPCReader<R>;

  /* The original function type. */
  stub: T;

  /**
   * Creates a call that expect to run in browser environment.
   * The function runs immediately on the browser and will not re-run.
   *
   * @param args - A factory function returning the argument array.
   * @returns An IRPCReader instance for handling the asynchronous result or stream.
   */
  once(...args: A): IRPCReader<R>;

  /**
   * Creates a reactive call that expect to run in browser environment.
   * The function runs immediately on the browser and will re-run when
   * the reactive dependencies change.
   *
   * @param args - A factory function returning the argument array.
   * @param debounce - The debounce time in milliseconds.
   * @returns An IRPCReader instance for handling the asynchronous result or stream.
   */
  with(args: () => A, debounce?: number): IRPCReader<R>;

  /**
   * Creates a reactive call that expect to run in browser environment.
   * The function only runs on the first dependency change and re-run
   * when the reactive dependencies change.
   *
   * @param args - A factory function returning the argument array.
   * @param debounce - The debounce time in milliseconds.
   * @returns An IRPCReader instance for handling the asynchronous result or stream.
   */
  when(args: () => A, debounce?: number): IRPCReader<R>;

  /**
   * Creates a reactive call that expects to be manually dispatched later.
   * @param debounce - Optional debounce time before dispatched.
   * @returns {IRPCReader<R> & {dispatch: (...args: A) => Promise<void>}}
   */
  later(debounce?: number): IRPCReader<R> & {
    /** Method to execute and dispatch the actual call */
    dispatch: (...args: A) => Promise<void>;
  };
}

/**
 * A utility type that transforms a standard function type into its corresponding IRPCStub.
 * It automatically unwraps RemoteState types to determine the underlying data type.
 *
 * @template T - The function type to be transformed.
 */
export type IRPCFunction<T> = T extends (...args: infer A) => infer R
  ? R extends RemoteState<infer S>
    ? S extends IRPCData
      ? IRPCStub<T, A, S>
      : IRPCStub<T, A, IRPCData>
    : R extends Promise<infer O>
      ? O extends IRPCData
        ? IRPCStub<T, A, O>
        : IRPCStub<T, A, IRPCData>
      : R extends IRPCData
        ? IRPCStub<T, A, R>
        : IRPCStub<T, A, IRPCData>
  : IRPCStub<T, [], IRPCData>;

/**
 * Represents primitive data types that can be used in IRPC communications.
 * Includes string, number, boolean, null, and undefined.
 */
export type IRPCPrimitive = string | number | boolean | null | undefined;

/**
 * Represents an object structure where keys are strings and values are IRPCData.
 * Used for structured data in RPC communications.
 */
export type IRPCObject = { [key: string]: IRPCData };

/**
 * Represents all possible data types in IRPC, including primitives, objects, and arrays.
 * This is a recursive type that allows nested structures.
 */
export type IRPCData = IRPCPrimitive | IRPCObject | IRPCFile | IRPCBlob | IRPCData[];

/**
 * Represents all possible defined data types in IRPC, including primitives, objects, and arrays.
 * This is a recursive type that allows nested structures.
 */
export type IRPCDefined = string | number | boolean | IRPCObject | IRPCFile | IRPCBlob | IRPCDefined[];

/**
 * Union type of all primitive Zod schema types used for validation.
 */
export type IRPCPrimitiveSchema = ZodString | ZodNumber | ZodBoolean | ZodNull | ZodUndefined | ZodOptional | ZodCustom;

/**
 * Zod object schema type used for validating structured data.
 */
export type IRPCObjectSchema = ZodObject;

/**
 * Zod array schema that can contain primitive schemas or object schemas.
 */
export type IRPCArraySchema = ZodArray<IRPCPrimitiveSchema | IRPCObjectSchema>;

/**
 * Union type of all possible Zod schema types used in IRPC for input/output validation.
 */
export type IRPCDataSchema = IRPCPrimitiveSchema | IRPCObjectSchema | IRPCArraySchema;

/**
 * Type representing the result of a Zod schema validation operation.
 */
export type IRPCParseResult = ZodSafeParseResult<IRPCDataSchema>;

/**
 * Represents an array of input schemas for an RPC function.
 */
export type IRPCInputs = IRPCDataSchema[];

/**
 * Represents the output schema for an RPC function.
 */
export type IRPCOutput = IRPCDataSchema;

/**
 * Defines the basic information about an RPC namespace.
 */
export type IRPCPackageInfo = {
  /** The name of the namespace */
  name: string;
  /** The version of the namespace */
  version: string;
  /** Optional description of the namespace */
  description?: string;
};

export type IRPCPackageConfig = IRPCPackageInfo &
  IRPCCallConfig & {
    /** Primary key field name for CRUD operations. Defaults to 'id'. */
    key?: string;
    transport?: IRPCTransport;
  };

/**
 * Represents the payload of an RPC call with its name and arguments.
 */
export type IRPCPayload = {
  /** The name of the RPC function to call */
  name: string;
  /** The arguments to pass to the RPC function */
  args: IRPCData[];
  /** The package information */
  package: IRPCPackagePayload;
};

/**
 * Defines the schema for input and output validation of an RPC function.
 */
export type IRPCSchema<I extends IRPCInputs, O extends IRPCOutput> = {
  /** Optional input validation schemas */
  input?: I;
  /** Optional output validation schema */
  output?: O;
};

/**
 * Type definition for an RPC handler function.
 * Takes IRPCData arguments and returns a Promise resolving to IRPCData.
 */

// biome-ignore lint/complexity/noBannedTypes: <Generic alias>
export type IRPCHandler = Function;

/**
 * Configuration options for initializing an RPC function.
 * Contains metadata and constraints for the RPC function.
 *
 * @template I - Tuple of input validation schemas
 * @template O - Output validation schema
 */
export type IRPCInit<R, I extends IRPCInputs, O extends IRPCOutput> = {
  /** The name of the RPC function */
  name: string;
  /** Optional description of the RPC function */
  description?: string;

  /** Optional schema for input/output validation */
  schema?: IRPCSchema<I, O>;
  /** Optional maximum age of a call in milliseconds */
  maxAge?: number;
  /** Mark the spec as continues stream with no timeout */
  keepAlive?: boolean;

  /**
   * Whether to coalesce multiple calls to the same RPC function within a short time period.
   * If true, multiple calls with the same parameters will be combined into a single call,
   * with subsequent calls waiting for the result of the first call.
   * This can help reduce the number of actual function executions.
   */
  coalesce?: boolean;
} & IRPCCallConfig &
  IRPCInferInit<R>;

export type IRPCInferInit<R> = R extends IRPCDefined ? { seed: () => R } : { seed?: () => R };

/**
 * Determines whether an RPC function stub requires a seed factory.
 * Seed is NOT required if the return type includes `undefined` or `void`.
 */
export type IRPCSeedRequired<F> =
  undefined extends IRPCReturnOf<F> ? false : void extends IRPCReturnOf<F> ? false : true;

/**
 * Parameter list for declaring an RPC stub by name.
 * Enforces seed argument only if the return type requires it.
 */
export type IRPCDeclareArgs<F, I extends IRPCInputs, O extends IRPCOutput> =
  IRPCSeedRequired<F> extends true
    ? [
        seedOrConfig: (() => IRPCReturnOf<F>) | (IRPCDeclareConfig<I, O> & IRPCInferInit<IRPCReturnOf<F>>),
        config?: IRPCDeclareConfig<I, O>,
      ]
    : [
        seedOrConfig?: (() => IRPCReturnOf<F>) | (IRPCDeclareConfig<I, O> & IRPCInferInit<IRPCReturnOf<F>>),
        config?: IRPCDeclareConfig<I, O>,
      ];

/**
 * Extracts the data type from a function's return type by unwrapping
 * RemoteState and Promise wrappers.
 *
 * @template F - The function type to extract from.
 */
export type IRPCReturnOf<F> = F extends (...args: infer _A) => infer R
  ? R extends RemoteState<infer S>
    ? S
    : R extends Promise<infer D>
      ? D
      : R
  : IRPCData;

/**
 * Configuration options for the shorthand `declare(name, seed, config?)` overload.
 * Contains all IRPCInit fields except `name` and `seed`.
 *
 * @template I - Tuple of input validation schemas
 * @template O - Output validation schema
 */
export type IRPCDeclareConfig<I extends IRPCInputs = IRPCInputs, O extends IRPCOutput = IRPCOutput> = {
  description?: string;
  schema?: IRPCSchema<I, O>;
  maxAge?: number;
  keepAlive?: boolean;
  coalesce?: boolean;
  stream?: true;
  ttl?: number;
} & IRPCCallConfig;

/**
 * Configuration options for initializing an RPC stream function.
 * Contains metadata and constraints for the RPC stream function.
 *
 * @template I - Tuple of input validation schemas
 * @template O - Output validation schema
 */
export type IRPCStreamInit<I extends IRPCInputs, O extends IRPCOutput, R> = IRPCInit<R, I, O> & {
  stream: true;
  ttl?: number;
};

/**
 * Type definition for an RPC declaration.
 * Represents an RPC function with its name, description, and configuration.
 *
 * @template F - The function signature of the RPC
 * @template I - Tuple of input validation schemas
 * @template O - Output validation schema
 */
export type IRPCDeclareInit<F, I extends IRPCInputs, O extends IRPCOutput> = F extends (...args: infer _A) => infer R
  ? R extends RemoteState<infer S>
    ? S extends IRPCData
      ? IRPCStreamInit<I, O, S>
      : IRPCInit<S, IRPCInputs, IRPCOutput>
    : R extends Promise<infer D>
      ? D extends IRPCData
        ? IRPCInit<D, I, O>
        : IRPCInit<D, IRPCInputs, IRPCOutput>
      : R extends IRPCData
        ? IRPCInit<R, I, O>
        : IRPCInit<R, IRPCInputs, IRPCOutput>
  : IRPCInit<IRPCData, IRPCInputs, IRPCOutput>;

export type IRPCCrudMethod = 'get' | 'create' | 'update' | 'delete';

/**
 * Discriminated field — shared value or per-operation values.
 */
export type IRPCCrudField<T> =
  | T
  | {
      get?: T;
      create?: T;
      update?: T;
      delete?: T;
    };

export type IRPCCrudOptions = {
  description?: IRPCCrudField<string>;
  schema?: {
    get?: IRPCSchema<IRPCInputs, IRPCOutput>;
    create?: IRPCSchema<IRPCInputs, IRPCOutput>;
    update?: IRPCSchema<IRPCInputs, IRPCOutput>;
    delete?: IRPCSchema<IRPCInputs, IRPCOutput>;
  };
  /** Cache max age — only applied to get. */
  maxAge?: number;
  coalesce?: boolean;
} & IRPCCallConfig;

/**
 * ID type extracted from entity using the key field.
 * Falls back to string if the key doesn't exist on the entity.
 */
export type IRPCEntityId<T, K extends string> = K extends keyof T ? T[K] : string;

export type IRPCCrudStubs<
  T extends IRPCObject,
  K extends string,
  I extends IRPCObject = T,
  U extends IRPCObject = T,
> = {
  get: IRPCFunction<(id: IRPCEntityId<T, K>) => Promise<T> | RemoteState<T>>;
  create: IRPCFunction<(data: I) => Promise<T> | RemoteState<T>>;
  update: IRPCFunction<(id: IRPCEntityId<T, K>, data: U) => Promise<T> | RemoteState<T>>;
  delete: IRPCFunction<(id: IRPCEntityId<T, K>) => Promise<T> | RemoteState<T>>;
};

/**
 * Per-method resolved metadata — discriminated fields flattened,
 * method-specific options applied. Passed to driver on every call.
 */
export type IRPCMeta = {
  /** Entity/table name. */
  name: string;
  /** Primary key field name. */
  key: string;
  /** Resolved description for this method. */
  description?: string;
  /** Resolved schema for this method. */
  schema?: IRPCSchema<IRPCInputs, IRPCOutput>;
  maxAge?: number;
  coalesce?: boolean;
} & IRPCCallConfig;

export type IRPCCrudMeta = IRPCMeta;

/**
 * Complete specification for an RPC function including its implementation.
 * Extends IRPCInit with the actual handler function.
 *
 * @template I - Tuple of input validation schemas
 * @template O - Output validation schema
 */
export type IRPCSpec<I extends IRPCInputs, O extends IRPCOutput> = IRPCInit<IRPCData, I, O> & {
  /** Optional time-to-live for a call in milliseconds */
  ttl?: number;
  /** Whether to stream the result of the RPC call */
  stream?: boolean;
  /** The package that the RPC function belongs to */
  package: IRPCPackagePayload;
  /** The actual handler function that implements the RPC */
  handler: IRPCHandler;
};

export type IRPCPackagePayload = {
  /** Name of the package */
  name: string;
  /** Version of the package */
  version: string;
};

/**
 * Represents an incoming RPC request.
 */
export type IRPCRequest = {
  /** Unique identifier for the request */
  id: string;
  /** Name of the RPC function being called */
  name: string;
  /** Arguments for the RPC function */
  args: unknown[];
  /** The package that the RPC function belongs to */
  package: IRPCPackagePayload;
  /** Optional file payload for the call */
  files?: IRPCFilePointer[];
};

export type IRPCSubRequest = Omit<IRPCRequest, 'package' | 'files'>;

export type IRPCCredentials = Iterable<[string, AsyncValue]>;
export type IRPCCredentialsFactory = Record<string, AsyncValue> | (() => Record<string, AsyncValue>);

export type IRPCRequests = {
  calls: IRPCRequest[];
  credentials?: IRPCCredentials;
};

export type IRPCPacketError = {
  type: string;
  code: string;
  message: string;
};

/**
 * Represents an RPC response.
 */
export type IRPCResponse = {
  /** Unique identifier matching the request */
  id: string;
  /** Name of the RPC function that was called */
  name: string;
  /** Error message if the call failed */
  error?: IRPCPacketError;
  /** Result of the RPC call if successful */
  result?: unknown;
};

/**
 * Context storage mechanism for RPC operations.
 */
export type IRPCContext<K, V> = Map<K, V>;

/**
 * Interface for managing RPC context stores.
 */
export type IRPCContextProvider = {
  /**
   * Runs a function within a specific context.
   * @param ctx The context to run within
   * @param fn The function to execute
   */
  run<R, K, V>(ctx: IRPCContext<K, V>, fn: () => R): R;

  /** Gets the current context store */
  getStore<K, V>(): IRPCContext<K, V>;
};

/**
 * Configuration options for an RPC call.
 */
export type IRPCCallConfig = {
  /** Timeout for the RPC call in milliseconds */
  timeout?: number;
  /** Maximum number of retries for the call */
  maxRetries?: number;
  /** Retry strategy mode - either linear or exponential backoff */
  retryMode?: 'linear' | 'exponential';
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Optional flag to dispatch the call as a standalone HTTP request with full cookie/header lifecycle */
  standalone?: boolean;
};

/**
 * Configuration for transport layer, extending call configuration with debounce settings.
 */
export type TransportConfig = IRPCCallConfig & {
  /** Debounce setting for transport - can be a boolean to enable/disable or a number for specific delay */
  debounce?: number | boolean;
};

export type StreamCleanup = () => void;

/**
 * A callback function type used to natively construct and drive a reactive stream.
 * It provides the initial reactive data reference and terminal resolution hooks
 * without forcing strict async/await boundaries, securely yielding stream operations.
 *
 * @template T - The type of data yielded globally by the stream.
 * @param state - The reactive state reference for the stream.
 * @param resolve - Callback to statically mark the stream as successfully completed, optionally with a resolved value.
 * @param reject - Callback to forcefully throw a runtime error into the stream structure.
 */
export type StreamConstructor<T> = (
  state: IRPCReadable<T>,
  resolve: (value?: T) => void,
  reject: (error: Error) => void
) => StreamCleanup | void | Promise<StreamCleanup | void>;
