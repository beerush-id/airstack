import type { $ZodError, $ZodIssue } from '@zod/core';
import type { input, output, ZodArray, ZodObject, ZodSafeParseResult } from 'zod/v4';
import type { DerivedRef, ImmutableRef, MutableRef } from './reactive/ref.js';
import type {
  ARRAY_MUTATIONS,
  ASYNC_STATUS as AsyncStatusType,
  BATCH_MUTATIONS,
  MAP_MUTATIONS,
  OBJECT_MUTATIONS,
  SET_MUTATIONS,
} from './shared/constant.js';
import type { Linkables } from './shared/enum.js';

// biome-ignore lint/suspicious/noExplicitAny: Expect any.
export type AnyType = any;
export type Enum<T> = T[keyof T];
export type Primitive = string | number | boolean | bigint | symbol | undefined | null | MethodLike | Date | RegExp;

export type Recursive = boolean | 'flat';
export type MethodLike = (...args: unknown[]) => unknown;
export type KeyLike = string | number | symbol;
export type ObjLike = {
  [key: KeyLike]: unknown;
};

export type Linkable = object | unknown[] | Set<unknown> | Map<KeyLike, unknown>;
export type LinkableSchema = ZodObject | ZodArray;
export type ImmutableOutput<S> = Immutable<ModelOutput<S>>;
export type ReadonlyLink = Immutable<Linkable>;

export type ModelArray = ZodArray;
export type ModelObject = ZodObject;
export type ModelInput<S> = input<S>;
export type ModelOutput<S> = output<S>;
export type ModelError = $ZodError;
export type ModelIssue = $ZodIssue;
export type ModelIssues = ModelIssue[];
export type ParseResult<T> = ZodSafeParseResult<T>;

export type StateTracker = (init: Linkable, key: KeyLike) => boolean;
export type StateKeyTracker = (key: KeyLike) => boolean;
export type StatePublicTracker = (init: Linkable, observers: StateObserverList, key: KeyLike) => void;
export type StateReadTracker = (init: Linkable, key: KeyLike) => void;
export type StateObserver = {
  readonly id: string;
  readonly active: boolean;
  readonly states: WeakMap<State, Set<KeyLike>>;
  readonly assign: (init: Linkable, observers: StateObserverList) => StateKeyTracker;
  readonly onChange: (event: StateChange) => void;
  readonly destroy: () => void;
  readonly reset: () => void;
  readonly run: <R>(fn: () => R) => R;
  readonly runAsync: <R>(fn: () => Promise<R>) => Promise<R>;
  name?: string;
};

export type BatchMutation = (typeof BATCH_MUTATIONS)[number] | `${(typeof BATCH_MUTATIONS)[number]}`;
export type SetMutation = (typeof SET_MUTATIONS)[number] | `${(typeof SET_MUTATIONS)[number]}`;
export type MapMutation = (typeof MAP_MUTATIONS)[number] | `${(typeof MAP_MUTATIONS)[number]}`;
export type ArrayMutation = (typeof ARRAY_MUTATIONS)[number] | `${(typeof ARRAY_MUTATIONS)[number]}`;
export type ObjectMutation = (typeof OBJECT_MUTATIONS)[number] | `${(typeof OBJECT_MUTATIONS)[number]}`;
export type StateMutation = ArrayMutation | ObjectMutation | SetMutation | MapMutation | BatchMutation;

export type MapMutationMethod = 'set' | 'delete' | 'clear';
export type SetMutationMethod = 'add' | 'delete' | 'clear';

export type StateBaseOptions = {
  strict?: boolean;
  compare?: (a: unknown, b: unknown) => number;
  ordered?: boolean;
  /* @deprecated: state initialization always deferred */
  deferred?: boolean;
  immutable?: boolean;
  recursive?: Recursive;
  safeParse?: boolean;
  observable?: boolean;
  trapOwnKeys?: boolean;
};
export type StateOptions<S extends LinkableSchema = LinkableSchema> = StateBaseOptions & {
  schema?: S;
};

export type AnchorSettings = StateBaseOptions & {
  reactive?: boolean;
  production: boolean;
  secureWrite: boolean;
  safeObservation: boolean;
  safeObservationThreshold: number;
  globalScopeWarning?: boolean;
};

export type StateSubscriber<T> = (snapshot: T, event: StateChange, emitter?: string) => void;
export type StateUnsubscribe = () => void;
export type StateDestroyer = () => void;
export type StateSubscribeFn<T> = ((
  handle: StateSubscriber<T>,
  receiver?: Linkable,
  recursive?: boolean
) => StateUnsubscribe) & {
  all: (handle: StateSubscriber<T>, receiver?: Linkable, recursive?: boolean) => StateUnsubscribe;
};
export type StateSubscriberList<T extends Linkable = Linkable> = Set<StateSubscriber<T>>;
export type StateObserverList = Set<StateObserver>;
export type StateSubscriptionMap = Map<Linkable, StateUnsubscribe>;
export type StateLinkFn = (childKey: KeyLike, childState: Linkable, receiver?: Linkable) => void;
export type StateUnlinkFn = (childState: Linkable) => void;

export type State<T extends Linkable = Linkable> = T;
export type StateMetadata<
  T extends Linkable = Linkable,
  S extends LinkableSchema = LinkableSchema,
  RootType extends Linkable = Linkable,
  RootSchema extends LinkableSchema = LinkableSchema,
  ParentType extends Linkable = Linkable,
  ParentSchema extends LinkableSchema = LinkableSchema,
> = {
  id: string;
  type: Linkables;
  configs: StateBaseOptions;
  observers: StateObserverList;
  subscribers: StateSubscriberList<T>;
  subscriptions: StateSubscriptionMap;
  exceptionHandlers: StateExceptionHandlerList;
  root?: StateMetadata<RootType, RootSchema>;
  parent?: StateMetadata<ParentType, ParentSchema>;
  schema?: S;
  safeParse?: boolean;
};

export type MapMutator<K, V> = {
  set(key: K, value: V): void;
  delete(key: K): void;
  clear(): void;
};

export type SetMutator<V> = {
  add(value: V): void;
  delete(value: V): void;
  clear(): void;
};

export type ArrayMutator<T> = {
  push(...items: T[]): void;
  pop(): T | undefined;
  shift(): T | undefined;
  unshift(...items: T[]): void;
  splice(start: number, deleteCount?: number, ...items: T[]): T[];
  reverse(): T[];
  sort(compareFn?: (a: T, b: T) => number): T[];
  fill(value: T, start?: number, end?: number): T[];
  copyWithin(target: number, start: number, end?: number): T[];
};

export type StateMutator<T extends Linkable> =
  T extends Set<infer U>
    ? SetMutator<U>
    : T extends Map<infer K, infer V>
      ? MapMutator<K, V>
      : T extends Array<infer U>
        ? ArrayMutator<U>
        : never;

export type StateGetter<T extends Linkable> = (target: T, prop: keyof T | KeyLike, receiver?: unknown) => unknown;
export type StateSetter<T extends Linkable> = (
  target: T,
  prop: keyof T | KeyLike,
  value?: unknown,
  receiver?: unknown
) => unknown;
export type StateRemover<T extends Linkable> = (target: T, prop: keyof T | KeyLike, receiver?: unknown) => unknown;

export type StateRelation = {
  link: StateLinkFn;
  unlink: StateUnlinkFn;
};

export type StateGateway<T extends Linkable = Linkable> = {
  getter: StateGetter<T>;
  setter: StateSetter<T>;
  remover: StateRemover<T>;
  ownKeys: (target: T) => KeyLike[];
  broadcaster: Broadcaster;
  mutator?: StateMutator<T>;
};

export type StateController<T extends Linkable = Linkable, S extends LinkableSchema = LinkableSchema> = {
  meta: StateMetadata<T, S>;
  destroy: StateDestroyer;
  subscribe: StateSubscribeFn<T>;
};

export type StatePropGetter<T extends Linkable = Linkable> = (
  target: T,
  prop: keyof T,
  receiver?: unknown
) => T[keyof T];

export type TrapOverrides = {
  configs: StateBaseOptions;
  mutator?: WeakMap<WeakKey, MethodLike>;
};

export type StateChange = {
  type: 'init' | StateMutation;
  keys: KeyLike[];
  prev?: unknown;
  value?: unknown;
  error?: ModelError;
  emitter?: string;
};

export type ArrayChange = StateChange & {
  added?: unknown[];
  removed?: unknown[];
};

export type BatchChange = StateChange & {
  changes: KeyLike[];
};

export type StateException = StateChange & {
  error: Error | ModelError;
  issues?: ModelIssues;
};

export type StateExceptionHandler = (exception: StateException) => void;
export type StateExceptionHandlerList = Set<StateExceptionHandler>;

export type PipeTransformer<T, R> = (value: T) => Partial<R>;

export type SubscribeFactoryInit = {
  link: StateLinkFn;
  unlink: StateUnlinkFn;
};

export type NestedPath<T> =
  T extends Array<infer U>
    ? `${number}` | (NestedPath<U> extends infer P ? (P extends string ? `${number}.${P}` : never) : never)
    : T extends object
      ? {
          [K in keyof T]: K extends string
            ? `${K}` | (NestedPath<T[K]> extends infer P ? (P extends string ? `${K}.${P}` : never) : never)
            : never;
        }[keyof T]
      : never;

export type ExceptionType = {
  error?: ModelError | Error;
  issues: $ZodIssue[];
  message: string;
};
export type ExceptionMap<T extends ObjLike | Array<unknown>> = {
  [K in NestedPath<T>]?: ExceptionType;
};
export type StateExceptionMap<T extends ObjLike | Array<unknown>> = {
  errors: ExceptionMap<T>;
  destroy: StateUnsubscribe;
};

export type Immutable<T> = T extends Primitive
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<Immutable<K>, Immutable<V>>
    : T extends Set<infer U>
      ? ReadonlySet<Immutable<U>>
      : T extends object
        ? {
            readonly [P in keyof T]: Immutable<T[P]>;
          }
        : T extends Array<infer U>
          ? ReadonlyArray<Immutable<U>>
          : T;

export type Mutable<T> =
  T extends ReadonlyMap<infer K, infer V>
    ? Map<K, V>
    : T extends ReadonlySet<infer U>
      ? Set<U>
      : T extends ReadonlyArray<infer U>
        ? {
            -readonly [P in keyof T]: P extends keyof Array<U> ? Array<U>[P] : never;
          }
        : {
            -readonly [P in keyof T]: T[P];
          };

export type MutationKey<T> =
  T extends ReadonlyMap<unknown, unknown>
    ? MapMutationMethod
    : T extends ReadonlySet<unknown>
      ? SetMutationMethod
      : T extends ReadonlyArray<unknown>
        ? ArrayMutation
        : keyof T;

export type MergedType<T> = { [P in keyof T]: T[P] } & {};

/**
 * Merges two object types where properties of Patch override properties of Base.
 */
export type OverrideProps<Base, Patch> = MergedType<Omit<Base, keyof Patch> & Patch>;

/**
 * Computes a composite type from a sequence of sources, where subsequent sources override
 * properties from earlier ones.
 */
export type MergeSources<T extends readonly unknown[], Acc = {}> = T extends readonly []
  ? MergedType<Acc>
  : T extends readonly [infer Head, ...infer Tail]
    ? MergeSources<Tail, Head extends object ? OverrideProps<Acc, NonNullable<Head>> : Acc>
    : T extends readonly (infer Element)[]
      ? Element extends object
        ? OverrideProps<Acc, NonNullable<Element>>
        : MergedType<Acc>
      : MergedType<Acc>;

export type MutablePart<T, K extends MutationKey<T>[]> =
  T extends ReadonlyMap<infer M, infer V>
    ? T & {
        -readonly [P in K[number]]: P extends keyof Map<M, V> ? Map<M, V>[P] : never;
      }
    : T extends ReadonlySet<infer U>
      ? T & {
          -readonly [P in K[number]]: P extends keyof Set<U> ? Set<U>[P] : never;
        }
      : T extends ReadonlyArray<infer U>
        ? T & {
            -readonly [P in K[number]]: P extends keyof Array<U> ? Array<U>[P] : never;
          }
        : MergedType<
            Omit<T, K[number]> & {
              -readonly [P in K[number]]: P extends keyof T ? T[P] : never;
            }
          >;

/**
 * Extracts the keys of an object that are not readonly.
 *
 * This type uses conditional types to determine which properties of T are writable:
 * 1. For each property P in T, it creates a test object with P as the only property
 * 2. It then checks if this property can be made non-readonly
 * 3. If it can, the key P is included in the result
 *
 * @template T - The object type to extract writable keys from
 * @returns A union of keys that are not readonly in T
 */
export type WritableKeys<T> = {
  [P in keyof T]-?: (<Q>() => Q extends { [K in P]: T[K] } ? 1 : 2) extends <R>() => R extends {
    -readonly [K in P]: T[K];
  }
    ? 1
    : 2
    ? P
    : never;
}[keyof T];

/**
 * Creates a new type containing only the writable properties of T.
 *
 * This type combines WritableKeys with Pick to create a new object type
 * that only includes the properties of T that are not readonly.
 *
 * @template T - The object type to pick writable properties from
 * @returns A new object type with only the writable properties of T
 */
export type Writable<T> = Pick<T, WritableKeys<T>>;

/**
 * Anchor function interface that provides state management capabilities.
 *
 * @template T - The type of the initial state
 * @template S - The schema type for validation
 */
export interface Anchor {
  /**
   * Creates a reactive state with optional configuration.
   *
   * @param init - Initial state value
   * @param options - Configuration options for the state
   * @returns Reactive state object
   */
  <T extends Linkable, S extends LinkableSchema = LinkableSchema>(init: T, options?: StateOptions<S>): State<T>;

  /**
   * Creates a reactive state with schema validation.
   *
   * @param init - Initial state value
   * @param schema - Zod schema for validation
   * @param options - Configuration options
   * @returns Validated reactive state object
   */
  <S extends LinkableSchema, T extends ModelInput<S>>(init: T, schema: S, options?: StateBaseOptions): ModelOutput<S>;

  /**
   * Creates an immutable reactive state with schema validation.
   *
   * @param init - Initial state value
   * @param schema - Zod schema for validation
   * @param options - Configuration options with immutable flag
   * @returns Immutable validated reactive state object
   */
  <S extends LinkableSchema, T extends ModelInput<S>>(
    init: T,
    schema: S,
    options?: StateBaseOptions & { immutable: true }
  ): ImmutableOutput<S>;

  // Initializer methods.

  /**
   * Creates a flat reactive state that only tracks top-level properties.
   *
   * @param init - Initial array state
   * @param options - Configuration options
   * @returns Flat reactive array state
   */
  flat<T extends unknown[], S extends LinkableSchema = LinkableSchema>(init: T, options?: StateOptions<S>): State<T>;

  /**
   * Creates an ordered reactive array that maintains sort order based on the provided comparison function.
   *
   * @template T - The type of the array elements
   * @template S - The schema type for validation
   * @param init - Initial array state
   * @param compare - Comparison function to determine sort order
   * @param options - Configuration options
   * @returns Ordered reactive array state
   */
  ordered<T extends unknown[], S extends LinkableSchema = LinkableSchema>(
    init: T,
    compare: (a: T[number], b: T[number]) => number,
    options?: StateOptions<S>
  ): State<T>;

  /**
   * Creates a reactive state with schema validation.
   *
   * @param schema - Zod schema for validation
   * @param init - Initial state value
   * @param options - Configuration options
   * @returns Validated reactive state object
   */
  model<S extends LinkableSchema, T extends ModelInput<S>>(
    schema: S,
    init: T,
    options?: StateBaseOptions
  ): ModelOutput<S>;

  /**
   * Creates an immutable reactive state with schema validation.
   *
   * @template S - The schema type for validation.
   * @template T - The input type for the schema.
   * @param schema - Zod schema for validation.
   * @param init - Initial state value.
   * @param options - Configuration options with immutable flag set to true.
   * @returns Immutable validated reactive state object.
   */
  model<S extends LinkableSchema, T extends ModelInput<S>>(
    schema: S,
    init: T,
    options?: StateBaseOptions & { immutable: true }
  ): Immutable<ModelOutput<S>>;

  /**
   * Creates an immutable reactive state.
   *
   * @param init - Initial state value
   * @param options - Configuration options
   * @returns Immutable reactive state object
   */
  immutable<T extends Linkable, S extends LinkableSchema = LinkableSchema>(
    init: T,
    options?: StateOptions<S>
  ): Immutable<T>;

  /**
   * Creates an immutable reactive state with schema validation.
   *
   * @param init - Initial state value
   * @param schema - Zod schema for validation
   * @param options - Configuration options
   * @returns Immutable validated reactive state object
   */
  immutable<S extends LinkableSchema, T extends ModelInput<S>>(
    init: T,
    schema: S,
    options?: StateBaseOptions
  ): ImmutableOutput<S>;

  // Accessibility methods.

  /**
   * Checks if a given state is reactive.
   *
   * @template T - The type of the state
   * @param state - The state to check
   * @returns True if the state is reactive, false otherwise
   */
  has<T extends State>(state: T): boolean;

  /**
   * Gets the current state value.
   *
   * @param state - The reactive state
   * @param silent - If true, does not throw an error if the state is not reactive.
   * @returns Current state value
   */
  get<T extends Linkable>(state: State<T>, silent?: boolean): T;

  /**
   * Finds and returns a reactive state instance that matches the given initial state.
   *
   * This method is used to retrieve an existing reactive state instance when you have
   * a reference to the original state object. It's particularly useful when you need
   * to access a state that was previously created but don't have a direct reference
   * to its reactive wrapper.
   *
   * @template T - The type of the state object
   * @param {T} init - The initial state object to find the reactive instance for
   * @returns {T} The reactive state instance if found, otherwise the original object
   */
  find<T extends Linkable>(init: T): T;

  /**
   * Retrieves the exception map for a given state, allowing access to validation errors and exceptions.
   *
   * This method returns a **StateExceptionMap** which contains:
   * - **errors**: A map of property paths to their corresponding validation errors
   * - **destroy**: A function to unsubscribe from the exception map
   *
   * @template T - The type of the state object or array
   * @param {T} state - The reactive state object or array to get exceptions for
   * @returns {StateExceptionMap<T>} An object containing the error map and unsubscribe function
   */
  catch<T extends ObjLike | Array<unknown>>(state: T): StateExceptionMap<T>;

  /**
   * Registers an exception handler for a given state to catch and handle errors during state mutations.
   *
   * This method allows you to set up error handling for a specific state. When an error occurs
   * during a state mutation (such as a Zod validation error), the provided handler function
   * will be called with details about the exception.
   *
   * @template T - The type of the state
   * @param state - The reactive state to attach the exception handler to
   * @param handler - The exception handler function that will be called when an error occurs
   * @returns A function that can be called to unsubscribe/remove the exception handler
   */
  catch<T extends State>(state: T, handler: StateExceptionHandler): StateUnsubscribe;

  /**
   * Creates a snapshot of the current state.
   *
   * @param state - The reactive state
   * @returns State snapshot
   */
  snapshot<T extends Linkable>(state: State<T>): T;

  /**
   * Stringifies the current state.
   *
   * @param state - The reactive state
   * @param replacer - Replacer function
   * @param space - Space for formatting
   * @returns Stringified state
   */
  stringify<T extends State>(
    state: T,
    replacer?: null | ((this: unknown, key: string, value: unknown) => unknown),
    space?: string | number
  ): string;

  /**
   * Parses a stringified state.
   *
   * @param state - Stringified state
   * @returns Parsed state
   */
  parse<T extends State>(state: string): T;

  /**
   * Makes a readonly state writable.
   *
   * @param state - The readonly state
   * @returns Writable state object
   */
  writable<T extends ReadonlyLink>(state: T): Mutable<T>;

  /**
   * Makes a readonly state writable with specific contracts.
   *
   * @param init - The readonly state
   * @param contracts - Keys that should be mutable
   * @returns Partially writable state object
   */
  writable<T extends ReadonlyLink, K extends MutationKey<T>[]>(init: T, contracts?: K): MutablePart<T, K>;

  // Utility methods.

  /**
   * Assigns properties from source to target collection.
   * @param target - Target collection
   * @param source - Source collection or record
   * @param replace - If true, replaces existing properties instead of merging
   */
  assign<T, K>(target: Map<T, K>, source: Map<T, K> | Record<KeyLike, K>, replace?: boolean): void;
  /**
   * Reassigns properties from source to target array.
   * @param target - Target array
   * @param source - Source object or record
   * @param replace - If true, replaces existing properties instead of merging
   */
  assign<T extends unknown[]>(
    target: T,
    source: { [key: string]: T[number] } | Record<string, T[number]>,
    replace?: boolean
  ): void;
  /**
   * Assigns properties from source to target object.
   *
   * @param target - Target object to assign properties to
   * @param source - Source object with properties to assign
   * @param replace - If true, replaces existing properties instead of merging
   */
  assign<T extends object>(target: T, source: Partial<T>, replace?: boolean): void;

  /**
   * Removes keys from a collection.
   *
   * @param target - Target collection
   * @param keys - Keys to remove
   */
  remove<T, K>(target: Map<T, K>, ...keys: Array<T>): void;
  remove<T extends unknown[]>(target: T, ...keys: Array<string>): void;
  remove<T extends object>(target: T, ...keys: Array<keyof T>): void;

  /**
   * Clears all entries from a collection.
   *
   * @param target - Target collection to clear
   */
  clear<T>(target: T): void;

  /**
   * Destroys a reactive state and cleans up all associated resources.
   *
   * This function retrieves the controller associated with the given state
   * and calls its destroy method, effectively cleaning up all observers,
   * subscribers, and references. If the state does not exist, an error is logged.
   *
   * @template T The type of the state to destroy.
   * @param {T} state - The reactive state to destroy.
   */
  destroy<T extends State>(state: T): void;

  /**
   * Configures global Anchor settings.
   *
   * @param {Partial<AnchorSettings>} config - Partial configuration object
   */
  configure(config: Partial<AnchorSettings>): void;

  /**
   * Gets the global Anchor settings.
   * @returns {AnchorSettings}
   */
  configs(): AnchorSettings;
}

export type AnchorInternalFn = <T extends Linkable, S extends LinkableSchema>(
  init: T,
  options: StateOptions<S>,
  root?: StateMetadata,
  parent?: StateMetadata
) => State<T>;

/**
 * Function type for broadcasting state changes to subscribers.
 *
 * @param snapshot - The current state snapshot
 * @param event - The state change event details
 * @param emitter - Optional emitter identifier
 */
export type BroadcastFn = (snapshot: Linkable, event: StateChange, emitter?: string) => void;

/**
 * Function type for emitting state changes to subscribers.
 *
 * @param event - The state change event details
 * @param prop - Optional property key that was changed
 */
export type EmitFn = (event: StateChange, prop?: KeyLike) => void;

/**
 * Interface for broadcasting state changes to subscribers.
 */
export type Broadcaster = {
  /**
   * Emits a state change event.
   *
   * @param event - The state change event details
   * @param prop - Optional property key that was changed
   */
  emit: EmitFn;

  /**
   * Catches and handles Zod validation errors that occur during state mutations.
   *
   * @param error - The Zod validation error that occurred
   * @param event - The state change event that triggered the error
   */
  catch: (error: ModelError, event: StateChange) => boolean;

  /**
   * Broadcasts a state change to all subscribers.
   *
   * @param snapshot - The current state snapshot
   * @param event - The state change event details
   * @param emitter - Optional emitter identifier
   */
  broadcast: BroadcastFn;
};

export interface SubscribeFn {
  /**
   * Create a new subscription from an existing anchored state.
   * This is a convenience function to subscribe to changes of an already anchored state.
   *
   * @template T The type of the state.
   * @param state - The anchored state object to subscribe from.
   * @param handler - The subscriber function to call on state changes.
   * @param recursive - Whether to recursively subscribe to child states (Default: follow).
   * @returns A function to unsubscribe from the subscribed state.
   */ <T>(state: T, handler: StateSubscriber<T>, recursive?: boolean): StateUnsubscribe;

  /**
   * Subscribe to changes in the provided state and log it to the console.
   * This is a convenience method that uses `console.log` as the subscriber function.
   *
   * @template T The type of the state.
   * @param state The anchored state object to subscribe to.
   * @returns A function to unsubscribe from the logging subscription.
   */
  log<T extends Linkable>(state: State<T>): StateUnsubscribe;

  /**
   * Pipe changes of the source state to a target state.
   * This function allows you to synchronize changes from a source state to a target state,
   * with an optional transformation function to modify the data during the transfer.
   *
   * @template Source The type of the source state.
   * @template Target The type of the target state.
   * @param source The source state object to pipe from.
   * @param target The target state object to pipe to.
   * @param transform An optional function to transform the source state before assigning it to the target.
   * @returns A function to unsubscribe from the piping operation.
   */
  pipe<Source extends State, Target extends Linkable>(
    source: Source,
    target: Target,
    transform?: PipeTransformer<Source, Target>
  ): StateUnsubscribe;

  /**
   * Bind two states together, synchronizing changes between them.
   * This function allows you to keep two states in sync, with optional transformation functions
   * to modify the data during the transfer in both directions.
   *
   * @template Left The type of the left state.
   * @template Right The type of the right state.
   * @param left The left state object to bind.
   * @param right The right state object to bind.
   * @param transformLeft An optional function to transform the left state before assigning it to the right.
   * @param transformRight An optional function to transform the right state before assigning it to the left.
   * @returns A function to unsubscribe from the binding operation.
   */
  bind<Left extends State, Right extends State>(
    left: Left,
    right: Right,
    transformLeft?: PipeTransformer<Left, Right>,
    transformRight?: PipeTransformer<Right, Left>
  ): StateUnsubscribe;

  /**
   * Resolves the [StateController] for a given anchored state.
   * This allows direct access to the [set] methods of the controller.
   *
   * @template T The type of the state.
   * @param state The anchored state object.
   * @returns The [StateController] if not found.
   */
  resolve<T extends Linkable>(state: State<T>): StateController<T> | undefined;

  /**
   * Subscribe to a state change but only subscribe on the browser.
   * During SSR (disabled reactivity), it runs once with init event.
   */
  client<T extends Linkable>(state: State<T>, handler: StateSubscriber<T>, recursive?: boolean): StateUnsubscribe;
}

export type DevTool = {
  /**
   * A callback that will be called when a property is accessed.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {KeyLike} prop
   */
  onGet?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, prop: KeyLike) => void;

  /**
   * A callback that will be called when a property is set.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {KeyLike} prop
   * @param {unknown} value
   */
  onSet?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    prop: KeyLike,
    value: unknown
  ) => void;

  /**
   * A callback that will be called when a property is deleted.
   * @param {StateMetadata} meta
   * @param {KeyLike} prop
   */
  onDelete?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, prop: KeyLike) => void;

  /**
   * A callback that will be called when a method is called.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {string} method
   * @param {unknown[]} args
   */
  onCall?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    method: string,
    args: unknown[]
  ) => void;

  /**
   * A callback that will be called when a state is initialized.
   * @param {StateMetadata} meta - State metadata associated with the event.
   */
  onInit?: <T extends Linkable, S extends LinkableSchema>(init: T, meta: StateMetadata<T, S>) => void;

  /**
   * A callback that will be called when a bulk assignment is performed.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {ObjLike} source
   */
  onAssign?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, source: ObjLike) => void;

  /**
   * A callback that will be called when a bulk removal is performed.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {KeyLike[]} props
   */
  onRemove?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, props: KeyLike[]) => void;

  /**
   * A callback that will be called when a state is cleared.
   * @param {StateMetadata} meta - State metadata associated with the event.
   */
  onClear?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>) => void;

  /**
   * A callback that will be called when a state is destroyed.
   * @param {StateMetadata} meta - State metadata associated with the event.
   */
  onDestroy?: <T extends Linkable, S extends LinkableSchema>(init: T, meta: StateMetadata<T, S>) => void;

  /**
   * A callback that will be called when a subscriber is added.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {StateSubscriber<Linkable>} handler
   */
  onSubscribe?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    handler: StateSubscriber<T>,
    receiver?: Linkable
  ) => void;

  /**
   * A callback that will be called when a subscriber is removed.
   * @param {StateMetadata} meta - State metadata associated with the event.
   * @param {StateSubscriber<Linkable>} handler
   */
  onUnsubscribe?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    handler: StateSubscriber<T>,
    receiver?: Linkable
  ) => void;

  /**
   * A callback that will be called when a child reference is linked.
   * @param {StateMetadata} meta
   * @param {StateMetadata} child
   */
  onLink?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, child: StateMetadata) => void;

  /**
   * A callback that will be called when a child reference is unlinked.
   * @param {StateMetadata} meta
   * @param {StateMetadata} child
   */
  onUnlink?: <T extends Linkable, S extends LinkableSchema>(meta: StateMetadata<T, S>, child: StateMetadata) => void;

  /**
   * A callback that will be called when a state is being tracked by an observer.
   * @param {StateMetadata} meta
   * @param {StateObserver} observer
   */
  onTrack?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    observer: StateObserver,
    key: KeyLike
  ) => void;

  /**
   * A callback that will be called when a state is no longer being tracked by an observer.
   * @param {StateMetadata} meta
   * @param {StateObserver} observer
   */
  onUntrack?: <T extends Linkable, S extends LinkableSchema>(
    meta: StateMetadata<T, S>,
    observer: StateObserver
  ) => void;
};

export type Assignable = ObjLike | Map<unknown, unknown> | Array<unknown>;
export type AssignablePart<T> = Partial<Record<keyof T, T[keyof T]>>;
export type StateBinding<T, B> =
  B extends StateBindingRef<T> ? StateBindingRef<T> : B extends ObjLike ? BindingProp<T, B> : never;
export type StateBindingRef<T> = {
  get value(): T;
  set value(value: T);
};
export type BindingProp<T, O> = [O, BindingKeys<T, O>];
export type BindingKeys<T, O> = WritableKeys<{ [K in keyof O]: O[K] extends T ? K : never }>;

export type AsyncStatus = Enum<typeof AsyncStatusType>;

export type AsyncState<T, E extends Error = Error> = {
  data: T;
  status: AsyncStatus;
  promise: Promise<T | undefined>;
  start: (init?: T) => Promise<T | undefined>;
  abort: (error?: E) => void;
  error?: E;
};
export type AsyncOptions = StateOptions & {
  deferred?: boolean;
};

/**
 * A function type that represents an asynchronous operation that can be cancelled.
 * @template R - The return type of the async operation
 * @param signal - An AbortSignal that can be used to cancel the operation or check for cancellation.
 * @returns A Promise that resolves with the result of the operation
 */
export type AsyncHandler<R> = (signal: AbortSignal) => Promise<R>;

type RefScopeValue = {
  init: unknown;
  value: unknown;
};

export type RefStack = {
  index: number;
  states: Map<number, RefScopeValue>;
};

export type ValueRef<T> = MutableRef<T> | ImmutableRef<T> | DerivedRef<T>;

export type EffectHandler<T> = (event: StateChange) => StateUnsubscribe | T;
export type AsyncEffectHandler<T> = (event: StateChange) => Promise<StateUnsubscribe | T>;

/**
 * Creates a reactive effect that automatically tracks dependencies and re-runs when those dependencies change.
 * The effect function will be executed immediately and then again whenever any tracked state changes.
 *
 * @param fn - The effect function to execute. It receives a StateChange event object containing
 *                 information about what triggered the effect (init, set, delete, etc.) and which keys changed.
 * @param displayName - Optional effect name for debugging.
 * @returns A cleanup function that can be called to manually dispose of the effect and unsubscribe
 *          from all tracked dependencies. This is automatically called when the current scope is cleaned up.
 */
export interface Effect {
  <T>(fn: EffectHandler<T>, displayName?: string): StateUnsubscribe;

  /**
   * A client-side only version of the effect function.
   * This effect will only run in browser environments and will be skipped in server-side environments.
   * Useful for effects that rely on browser-specific APIs or DOM manipulation.
   *
   * @param fn - The effect function to execute. It receives a StateChange event object containing
   *                 information about what triggered the effect (init, set, delete, etc.) and which keys changed.
   * @param displayName - Optional effect name for debugging.
   * @returns A cleanup function that can be called to manually dispose of the effect and unsubscribe
   *          from all tracked dependencies. This is automatically called when the current scope is cleaned up.
   */
  client<T>(fn: EffectHandler<T>, displayName?: string): StateUnsubscribe;

  async<T>(fn: AsyncEffectHandler<T>, displayName?: string): StateUnsubscribe;
}

/**
 * Options for configuring the retriable function behavior.
 */
export type RetriableOptions = {
  /**
   * Timeout in milliseconds after which the call will be aborted.
   * Set to 0 to disable timeout. Default is 0.
   */
  timeout?: number;
  /**
   * The mode for calculating retry delays. Can be 'linear' or 'exponential'.
   * Default is 'exponential'.
   */
  retryMode?: 'linear' | 'exponential';
  /**
   * Maximum number of retry attempts. Default is 0 (no retries).
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds between retries when using linear or exponential mode.
   * Default is 1000ms.
   */
  retryDelay?: number;
  /**
   * An optional AbortController instance to control cancellation of the call.
   * If not provided, a new AbortController will be created internally.
   */
  controller?: AbortController;
};

/**
 * Interface for state inspection functionality.
 * Provides methods to subscribe to state changes and optionally trace them.
 */
export interface StateInspector {
  /**
   * Subscribe to state changes and log them to console.
   * @param state The state object to inspect
   * @returns Unsubscribe function to stop listening to state changes
   */ <T extends State>(state: T): StateUnsubscribe;

  /**
   * Subscribe to state changes and trace them to console with stack trace.
   * @param state The state object to inspect with trace
   * @returns Unsubscribe function to stop listening to state changes
   */
  trace<T extends State>(state: T): StateUnsubscribe;
}

/**
 * Interface for reading and writing context values.
 * Provides a standardized way to access and update scoped data.
 */
export type ContextReader<T> = {
  /**
   * Retrieves the current value from the context.
   */
  get(): T;
  /**
   * Updates the context with a new value.
   * @param value - The new value to set in the context.
   */
  set(value: T): void;
};

export type ControlledSubscribe = <T extends Linkable>(
  state: State<T>,
  handler: StateSubscriber<T>,
  recursive?: boolean,
  passive?: boolean
) => StateUnsubscribe;
