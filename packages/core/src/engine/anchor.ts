import { S_MAP_TYPE, SerializableMap, xMap } from '../common/map.js';
import { S_SET_TYPE, SerializableSet, xSet } from '../common/set.js';
import { ANCHOR_SETTINGS, POISONED_KEYS } from '../shared/constant.js';
import { Linkables } from '../shared/enum.js';
import { captureStack } from '../shared/index.js';
import { plugin } from '../shared/plugin.js';
import type {
  Anchor,
  AnchorSettings,
  ExceptionMap,
  Immutable,
  Linkable,
  LinkableSchema,
  ModelError,
  ModelObject,
  ObjLike,
  State,
  StateController,
  StateExceptionHandlerList,
  StateGateway,
  StateGetter,
  StateMetadata,
  StateMutator,
  StateObserverList,
  StateOptions,
  StateRelation,
  StateRemover,
  StateSetter,
  StateSubscriberList,
  StateSubscriptionMap,
} from '../types.js';
import { softClone } from '../utils/clone.js';
import { isArray, isFunction, isMap, isObject, isSet, shortId } from '../utils/index.js';
import { createArrayMutator } from './array.js';
import { createBroadcaster } from './broadcast.js';
import { createCollectionMutator } from './collection.js';
import { linkable } from './config.js';
import { createDestroyFactory, createLinkFactory, createSubscribeFactory, createUnlinkFactory } from './factory.js';
import { assign, clear, remove } from './helper.js';
import { createProxyHandler, writeContract } from './proxy.js';
import {
  BROADCASTER_REGISTRY,
  CONTROLLER_REGISTRY,
  EXCEPTION_HANDLER_REGISTRY,
  INIT_GATEWAY_REGISTRY,
  INIT_REGISTRY,
  META_INIT_REGISTRY,
  META_REGISTRY,
  MUTATOR_REGISTRY,
  RELATION_REGISTRY,
  SORTER_REGISTRY,
  STATE_REGISTRY,
} from './registry.js';
import { switchable } from './switchable.js';
import { createGetter, createOwnKeys, createRemover, createSetter } from './trap.js';

/**
 * Anchors a given value, making it reactive and observable.
 *
 * This function initializes a state controller for the provided value,
 * optionally validating it against a Zod schema, and returns a proxied
 * version of the value that can be observed for changes.
 *
 * If the value is already anchored or linked, the existing anchored state is returned.
 *
 * @template T The type of the value to anchor.
 * @template S The Zod schema type for validation.
 * @param init The initial value to anchor.
 * @param schemaOptions
 * @param options Optional configuration for anchoring, including schema, strict mode, and recursive anchoring.
 * @param root - The root state's metadata.
 * @param parent - The parent state's metadata.
 * @returns The proxied, reactive version of the input value.
 * @throws If `strict` mode is enabled and schema validation fails during initialization.
 * @throws If `strict` mode is enabled and schema validation fails during property updates or array mutations.
 */
function anchorFn<T extends Linkable, S extends LinkableSchema>(
  init: T,
  schemaOptions?: S | StateOptions<S>,
  options?: StateOptions<S>,
  parent?: StateMetadata<Linkable>,
  root?: StateMetadata<Linkable>
): State<T> {
  // Return itself if the given object is a reactive state.
  if (CONTROLLER_REGISTRY.has(init)) {
    return init;
  }

  // Return the existing reactive state if the given init is already initialized.
  if (INIT_REGISTRY.has(init)) {
    return INIT_REGISTRY.get(init) as T;
  }

  if (!linkable(init)) {
    captureStack.violation.init(init, anchorFn);
    return init;
  }

  if (!(schemaOptions as LinkableSchema)?._zod) {
    options = schemaOptions as StateOptions<S>;
  }

  const schema = (schemaOptions as LinkableSchema)?._zod
    ? (schemaOptions as S)
    : (schemaOptions as StateOptions<S>)?.schema;
  const configs: StateOptions<S> = {
    deferred: true,
    strict: options?.strict ?? ANCHOR_SETTINGS.strict,
    ordered: (options?.ordered ?? false) && isFunction(options?.compare),
    recursive: options?.recursive ?? ANCHOR_SETTINGS.recursive,
    immutable: options?.immutable ?? ANCHOR_SETTINGS.immutable,
    observable: options?.observable ?? ANCHOR_SETTINGS.observable,
    safeParse: options?.safeParse ?? ANCHOR_SETTINGS.safeParse,
    trapOwnKeys: options?.trapOwnKeys ?? ANCHOR_SETTINGS.trapOwnKeys,
  };
  const observers: StateObserverList = new Set();
  const subscribers: StateSubscriberList<T> = new Set();
  const subscriptions: StateSubscriptionMap = new Map();
  const exceptionHandlers: StateExceptionHandlerList = new Set();

  if (schema) {
    if (!isObject(init) && !isArray(init)) {
      captureStack.violation.schema('(object | array)', schema.type, configs.strict as false, anchorFn);
    }

    if (!configs.safeParse) {
      try {
        const result = schema.safeParse(init);

        if (result.success) {
          if (Array.isArray(init)) {
            init.splice(0, init.length, ...(result.data as unknown[]));
          } else if (isObject(init)) {
            Object.assign(init, result.data);
          }
        } else {
          captureStack.error.validation(
            'Attempted to initialize state with schema:',
            result.error,
            configs.strict,
            anchorFn
          );
        }
      } catch (error) {
        captureStack.error.validation(
          'Something went wrong when validating schema.',
          error as Error,
          configs.strict,
          anchorFn
        );
      }
    }
  }

  // Sort the initial array and register the compare function
  // if the state is marked as ordered and the given compare option is a function
  if (configs.ordered && Array.isArray(init)) {
    init.sort(options?.compare);
    SORTER_REGISTRY.set(init, options?.compare as (a: unknown, b: unknown) => number);
  }

  const type = isArray(init)
    ? Linkables.ARRAY
    : isSet(init)
      ? Linkables.SET
      : isMap(init)
        ? Linkables.MAP
        : Linkables.OBJECT;
  const meta: StateMetadata<T, S> = {
    id: shortId(),
    root,
    type,
    parent,
    schema,
    configs,
    observers,
    subscribers,
    subscriptions,
    exceptionHandlers,
  };
  META_REGISTRY.set(init, meta as never as StateMetadata);
  META_INIT_REGISTRY.set(meta as never as StateMetadata, init);

  // State broadcasting helpers.
  const broadcaster = createBroadcaster(init, meta);
  BROADCASTER_REGISTRY.set(init, broadcaster);

  // State relationship helpers.
  const link = createLinkFactory(init, meta);
  const unlink = createUnlinkFactory(meta);
  const relation: StateRelation = { link, unlink };
  RELATION_REGISTRY.set(init, relation);

  let mutators: ReturnType<typeof createArrayMutator> | ReturnType<typeof createCollectionMutator>;

  if (Array.isArray(init)) {
    mutators = createArrayMutator(init);
    MUTATOR_REGISTRY.set(init, mutators);
  } else if (init instanceof Map || init instanceof Set) {
    mutators = createCollectionMutator(init);
    MUTATOR_REGISTRY.set(init, mutators);
  }

  const gateway: StateGateway<T> = {
    getter: createGetter(init) as StateGetter<T>,
    setter: createSetter(init) as StateSetter<T>,
    remover: createRemover(init) as StateRemover<T>,
    ownKeys: createOwnKeys(init),
    mutator: mutators?.mutator as StateMutator<T>,
    broadcaster,
  };
  INIT_GATEWAY_REGISTRY.set(init, gateway as StateGateway);

  const proxyHandler = createProxyHandler<T>(gateway, meta);
  const state = new Proxy(init as ObjLike, proxyHandler) as State<T>;

  const controller: StateController<T, S> = {
    meta,
    destroy: createDestroyFactory(init, state, meta),
    subscribe: createSubscribeFactory(init, state, meta, { link, unlink }),
  };

  // Register the state with its controller for global access.
  INIT_REGISTRY.set(init, state);
  STATE_REGISTRY.set(state, init);
  CONTROLLER_REGISTRY.set(state, controller as never);
  EXCEPTION_HANDLER_REGISTRY.set(state, exceptionHandlers);

  // Trigger dev tool if it is available.
  plugin.devTool?.onInit?.(init, meta);

  // Return the proxied state object
  return state;
}

anchorFn.immutable = <T extends Linkable, S extends LinkableSchema>(
  init: T,
  schemaOptions?: StateOptions<S> | S,
  options?: StateOptions<S>
): Immutable<T> => {
  if ((schemaOptions as ModelObject)?._zod) {
    return anchorFn(init, schemaOptions, { ...options, immutable: true }) as Immutable<T>;
  }

  return anchorFn(init, { ...schemaOptions, immutable: true }) as Immutable<T>;
};

anchorFn.model = ((schema, init, options) => {
  return anchorFn(init, schema, options);
}) as Anchor['model'];

anchorFn.flat = ((init, options) => {
  return anchorFn(init, { ...options, recursive: 'flat' });
}) as Anchor['flat'];

anchorFn.ordered = ((init, compare, options) => {
  return anchorFn(init, { ...options, ordered: true, compare });
}) as Anchor['ordered'];

anchorFn.catch = ((state, handler) => {
  const controller = CONTROLLER_REGISTRY.get(state);

  if (!controller) {
    const error = new Error('Object is not a state.');
    captureStack.error.external(
      'Attempted to capture exception of a state that does not exist.',
      error,
      anchorFn.destroy
    );
    return () => {};
  }

  if (typeof handler !== 'function') {
    const errors: ExceptionMap<ObjLike> = anchorFn({});
    const unsubscribe = controller.subscribe.all((_, event) => {
      if (event.type !== 'init') {
        const key = event.keys.join('.');

        if (event.error) {
          errors[key] = {
            error: event.error,
            issues: event.error.issues,
            message: (event.error as ModelError).issues.map((error) => error.message).join('\n'),
          };
        } else {
          delete errors[key];
        }
      }
    });
    const destroy = () => {
      anchorFn.destroy(errors);
      unsubscribe();
    };

    return { errors, destroy };
  }

  const { exceptionHandlers } = controller.meta;
  exceptionHandlers.add(handler);

  return () => {
    exceptionHandlers.delete(handler);
  };
}) as Anchor['catch'];

anchorFn.has = ((state) => {
  return CONTROLLER_REGISTRY.has(state);
}) satisfies Anchor['has'];

anchorFn.get = ((state, silent = false) => {
  // This to make sure we can find a state that defined using write contract.
  const target = META_INIT_REGISTRY.get(CONTROLLER_REGISTRY.get(state)?.meta as StateMetadata);

  if (!target && !silent) {
    const error = new Error('State does not exist.');
    captureStack.error.external('Attempt to get the underlying object on non-existence state:', error, anchorFn.get);
  }

  return (target ?? state) as typeof state;
}) as Anchor['get'];

anchorFn.find = ((init) => {
  return INIT_REGISTRY.get(init) as typeof init;
}) satisfies Anchor['find'];

anchorFn.snapshot = ((state, recursive = true) => {
  return switchable.untrack(() => {
    const target = STATE_REGISTRY.get(state);
    if (!target) return structuredClone(state);
    return softClone(target, recursive);
  });
}) as Anchor['snapshot'];

anchorFn.stringify = ((state, replacer, space) => {
  return switchable.untrack(() => {
    const target = STATE_REGISTRY.get(state);
    return JSON.stringify(
      target ?? state,
      (key, value) => {
        let next = STATE_REGISTRY.get(value) ?? value;
        if (next instanceof SerializableMap || next instanceof SerializableSet) {
          next = next.snapshot();
        }
        return replacer ? replacer(key, next) : next;
      },
      space
    );
  });
}) as Anchor['stringify'];

anchorFn.parse = ((json) => {
  const result = JSON.parse(json, (key, value) => {
    if (ANCHOR_SETTINGS.secureWrite && POISONED_KEYS.has(key)) return undefined;

    if (typeof value === 'object' && value !== null) {
      if (value.entity === S_MAP_TYPE) return xMap(value);
      if (value.entity === S_SET_TYPE) return xSet(value);
    }
    return value;
  });
  if (linkable(result)) return anchorFn(result);
  return result;
}) as Anchor['parse'];

anchorFn.destroy = ((state, warn?: boolean) => {
  const controller = CONTROLLER_REGISTRY.get(state);

  if (controller) {
    controller.destroy();
  } else if (warn) {
    const error = new Error('Object is not a state.');
    captureStack.error.external('Attempted to destroy a state that does not exist.', error, anchorFn.destroy);
  }
}) as Anchor['destroy'];

anchorFn.configure = ((config: Partial<AnchorSettings>) => {
  Object.assign(ANCHOR_SETTINGS, config);
}) as Anchor['configure'];

anchorFn.configs = ((): AnchorSettings => {
  return ANCHOR_SETTINGS;
}) as Anchor['configs'];

// Assign utility functions.
anchorFn.writable = writeContract;
anchorFn.assign = assign;
anchorFn.remove = remove;
anchorFn.clear = clear;

export const anchor = anchorFn as Anchor;
export const snapshot = anchorFn.snapshot as Anchor['snapshot'];
export const stringify = anchorFn.stringify as Anchor['stringify'];
