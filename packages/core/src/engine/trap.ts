import { ObjectMutations, OBSERVER_KEYS } from '../shared/enum.js';
import { ANCHOR_SETTINGS, captureStack, POISONED_KEYS } from '../shared/index.js';
import { plugin } from '../shared/plugin.js';
import type {
  AnchorInternalFn,
  Broadcaster,
  KeyLike,
  Linkable,
  LinkableSchema,
  ModelArray,
  ModelError,
  ModelObject,
  ObjLike,
  ParseResult,
  State,
  StateChange,
  StateMetadata,
  StateRelation,
  TrapOverrides,
} from '../types.js';
import { isArray } from '../utils/index.js';
import { anchor } from './anchor.js';
import { createCollectionGetter } from './collection.js';
import { linkable } from './config.js';
import {
  BROADCASTER_REGISTRY,
  INIT_REGISTRY,
  META_REGISTRY,
  MUTATOR_REGISTRY,
  RELATION_REGISTRY,
  STATE_BUSY_LIST,
  STATE_REGISTRY,
} from './registry.js';
import { switchable } from './switchable.js';

const $$ = ANCHOR_SETTINGS;

/**
 * Creates a getter trap function for a reactive state object.
 *
 * This function generates a Proxy handler that intercepts property access operations
 * on reactive state objects. It handles various scenarios including:
 * - Circular reference detection and resolution
 * - Method binding for Set and Map instances
 * - Recursive state anchoring for nested objects
 * - Subscription linking for reactive dependencies
 * - Schema validation for strict mode compliance
 *
 * @template T - The type of the reactive state object
 * @template S - The type of the schema associated with the state
 * @param init - The initial state object to create a getter for
 * @param options - Optional state references containing configuration and metadata
 * @returns A getter function that handles property access with reactive behavior
 * @throws {Error} When called on a non-reactive state object
 */
export function createGetter<T extends Linkable>(init: T, options?: TrapOverrides) {
  const meta = META_REGISTRY.get(init) as StateMetadata;

  if (!meta) {
    throw new Error(`Get trap factory called on non-reactive state.`);
  }

  const mutator = options?.mutator ?? MUTATOR_REGISTRY.get(init)?.mutatorMap;

  const { link } = RELATION_REGISTRY.get(init) as StateRelation;
  const { schema, observers, subscribers, subscriptions } = meta;
  const { configs } = options ?? meta;

  if (init instanceof Set || init instanceof Map) {
    return createCollectionGetter(init as Set<unknown>, options as never);
  }

  const getter = (target: ObjLike, prop: KeyLike, receiver?: unknown) => {
    // Make sure target is the underlying object.
    /* istanbul ignore next */
    if (STATE_REGISTRY.has(target)) target = getRawTarget(target) as typeof target;

    let value = Reflect.get(target, prop, receiver) as Linkable;
    const valueRef = STATE_REGISTRY.has(value) ? STATE_REGISTRY.get(value) : value;

    if ($$.reactive) {
      const observer = switchable.getObserver();

      if (configs.observable) {
        plugin.track?.(init, observers, Array.isArray(init) ? OBSERVER_KEYS.ARRAY_MUTATIONS : prop);
        /* istanbul ignore next */
        if (!observer) plugin.trackStatic?.(init, Array.isArray(init) ? OBSERVER_KEYS.ARRAY_MUTATIONS : prop);
      }

      if (configs.observable && observer) {
        const trackProp = observer.assign(init, observers);
        const tracked = trackProp(Array.isArray(init) ? OBSERVER_KEYS.ARRAY_MUTATIONS : prop);

        if (!tracked) {
          plugin.devTool?.onTrack?.(meta, observer, Array.isArray(init) ? OBSERVER_KEYS.ARRAY_MUTATIONS : prop);
        }
      }

      // Trigger the dev tool callback if available.
      plugin.devTool?.onGet?.(meta, prop);
    }

    if (valueRef === init) {
      captureStack.violation.circular(prop, getter);
      return INIT_REGISTRY.get(init) as T;
    }

    // Skip primitive value checks.
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;

    // If the value is an array method, set method, or map method,
    // try to get the method trap from the mutator map.
    if (mutator?.has(value)) {
      return mutator.get(value);
    }

    if (!configs.recursive) return value;

    // if (STATE_REGISTRY.has(value)) {
    // Unwrap the value if the init was created with Anchor's state as the value.
    // This to make sure that state always points to the underlying object.
    // value = STATE_REGISTRY.get(value) as Linkable;
    // Reflect.set(target, prop, value);
    // }

    if (INIT_REGISTRY.has(value)) {
      // State already initialized, use it. Value now a state.
      value = INIT_REGISTRY.get(value) as State;
    }

    if (configs.recursive && !STATE_REGISTRY.has(value) && linkable(value)) {
      const childSchema = (
        isArray(init)
          ? (schema as never as ModelArray)?.unwrap?.()
          : (schema as never as ModelObject)?.shape?.[prop as string]
      ) as LinkableSchema;

      value = (anchor as AnchorInternalFn)(value as T, { ...configs, schema: childSchema }, meta.root ?? meta, meta);
    }

    // Link if the value is a reactive state and there is an active subscription.
    // Separating this process from creation is necessary to make sure
    // reading an existing state is linked properly.
    if (configs.recursive && STATE_REGISTRY.has(value) && subscribers.size && !subscriptions.has(value)) {
      if (!(configs.recursive === 'flat' && Array.isArray(target))) {
        link(prop, value);
      }
    }

    return value;
  };

  return getter;
}

/**
 * Creates an ownKeys trap function for a reactive state object.
 *
 * This function generates a Proxy handler that intercepts ownKeys trap.
 * This is useful for objects that are created with `observable: true` or as
 * a result of `link` on an existing reactive object.
 *
 * @template T - The type of the reactive state object
 * @param init - The initial state object to create an ownKeys trap for
 * @param options - Optional state references containing configuration and metadata
 * @returns An ownKeys trap function that handles property enumeration with reactive behavior
 * @throws {Error} When called on a non-reactive state object
 */
export function createOwnKeys<T extends Linkable>(init: T, options?: TrapOverrides) {
  const meta = META_REGISTRY.get(init) as StateMetadata;

  const { observers } = meta;
  const { configs } = options ?? meta;

  return (target: object) => {
    // Make sure target is the underlying object.
    /* istanbul ignore next */
    if (STATE_REGISTRY.has(target)) target = getRawTarget(target) as typeof target;

    if (configs.trapOwnKeys && $$.reactive) {
      const observer = switchable.getObserver();

      /* istanbul ignore else */
      if (configs.observable) {
        /* istanbul ignore next */
        plugin.track?.(init, observers, OBSERVER_KEYS.OWN_KEYS);
        if (!observer) plugin.trackStatic?.(init, OBSERVER_KEYS.OWN_KEYS);
      }

      if (configs.observable && observer) {
        const trackProp = observer.assign(init, observers);
        const tracked = trackProp(OBSERVER_KEYS.OWN_KEYS);

        if (!tracked) {
          /* istanbul ignore next */
          plugin.devTool?.onTrack?.(meta, observer, OBSERVER_KEYS.OWN_KEYS);
        }
      }
    }

    return Reflect.ownKeys(target);
  };
}

/**
 * Creates a setter trap function for a reactive state object.
 *
 * This function generates a Proxy handler that intercepts property assignment operations
 * on reactive state objects. It handles various scenarios including:
 * - Schema validation for strict mode compliance
 * - Circular reference detection and prevention
 * - Proper linking and unlinking of nested reactive states
 * - Broadcasting of state changes to subscribers
 * - Immutable state protection
 *
 * @template T - The type of the reactive state object
 * @template S - The type of the schema associated with the state
 * @param init - The initial state object to create a setter for
 * @param options - Optional state references containing configuration and metadata
 * @returns A setter function that handles property assignment with reactive behavior
 * @throws {Error} When called on a non-reactive state object
 */
export function createSetter<T extends Linkable>(init: T, options?: TrapOverrides) {
  const meta = META_REGISTRY.get(init) as StateMetadata;

  if (!meta) {
    throw new Error(`Set trap factory called on non-reactive state.`);
  }

  const broadcaster = BROADCASTER_REGISTRY.get(init) as Broadcaster;

  const { unlink, link } = RELATION_REGISTRY.get(init) as StateRelation;
  const { schema, subscriptions, subscribers } = meta;
  const { configs } = options ?? meta;

  return (target: ObjLike, prop: KeyLike, value: Linkable, receiver?: unknown) => {
    // Make sure target is the underlying object.
    if (STATE_REGISTRY.has(target)) target = getRawTarget(target) as typeof target;

    if ($$.secureWrite && typeof prop === 'string' && POISONED_KEYS.has(prop)) return true;

    const current = Reflect.get(target, prop, receiver) as Linkable;
    if (current === value) return true;

    // Make sure to always work with the underlying object (if exist).
    const rawValue = anchor.get(value, true) ?? value;
    // if (anchor.has(value)) value = anchor.get(value);

    let error: ModelError | undefined;

    if (schema) {
      let validation: ParseResult<unknown>;

      const childSchema = (schema as never as ModelObject)?.shape?.[prop as string];

      if (childSchema) {
        validation = childSchema.safeParse(rawValue);
      } else {
        validation = schema.safeParse({ ...init, [prop as string]: rawValue });
      }

      if (validation.success) {
        value = validation.data as Linkable;
      }

      if (!validation.success) {
        broadcaster.catch(validation.error as never, {
          type: ObjectMutations.SET,
          keys: [prop as string],
          prev: current,
          value,
        });

        if (!configs.safeParse) {
          broadcaster.broadcast(
            target,
            {
              type: ObjectMutations.SET,
              keys: [prop as string],
              prev: current,
              error: validation.error as never,
              value,
            },
            meta.id
          );

          return !configs.strict;
        } else {
          error = validation.error as never;
        }
      }
    }

    Reflect.set(target, prop, value, receiver);

    if (INIT_REGISTRY.has(current) || STATE_REGISTRY.has(current)) {
      const state = (INIT_REGISTRY.get(current) ?? current) as Linkable;
      if (subscriptions.has(state)) {
        unlink(state);
      }
    }

    if (STATE_REGISTRY.has(value) && configs.recursive && subscribers.size && configs.recursive !== 'flat') {
      link(prop, value);
    }

    if (!STATE_BUSY_LIST.has(target)) {
      const event: StateChange = {
        type: ObjectMutations.SET,
        keys: [prop as string],
        prev: current,
        error,
        value: target[prop],
      };

      // Make sure to broadcast to subscribers first because observers might depend on a derived state.
      broadcaster.broadcast(target, event, meta.id);
      broadcaster.emit(event, prop);

      // Trigger the dev tool callback if available.
      plugin.devTool?.onSet?.(meta, prop, value);
    }

    return true;
  };
}

/**
 * Creates a remover trap function for a reactive state object.
 *
 * This function generates a Proxy handler that intercepts property deletion operations
 * on reactive state objects. It handles various scenarios including:
 * - Schema validation for strict mode compliance (ensuring deleted properties can accept undefined)
 * - Proper unlinking of nested reactive states when deleted
 * - Broadcasting of deletion events to subscribers
 * - Circular reference handling
 *
 * @template T - The type of the reactive state object
 * @template S - The type of the schema associated with the state
 * @param init - The initial state object to create a remover for
 * @param options - Optional state references containing configuration and metadata
 * @returns A remover function that handles property deletion with reactive behavior
 * @throws {Error} When called on a non-reactive state object
 */
export function createRemover<T extends Linkable>(init: T, options?: TrapOverrides) {
  const meta = META_REGISTRY.get(init) as StateMetadata;

  if (!meta) {
    throw new Error(`Delete trap factory called on non-reactive state.`);
  }

  const broadcaster = BROADCASTER_REGISTRY.get(init) as Broadcaster;

  const { unlink } = RELATION_REGISTRY.get(init) as StateRelation;
  const { schema, subscriptions } = meta;
  const { configs } = options ?? meta;

  return (target: ObjLike, prop: KeyLike, receiver?: unknown) => {
    // Make sure target is the underlying object.
    if (STATE_REGISTRY.has(target)) target = getRawTarget(target) as typeof target;

    // Escape directly if the property doesn't exist to prevent unnecessary work.
    if (!Object.getOwnPropertyDescriptor(target, prop)) return true;

    const current = Reflect.get(target, prop, receiver) as Linkable;
    const childSchema = (schema as never as ModelObject)?.shape?.[prop as string];

    let error: ModelError | undefined;

    if (childSchema) {
      const result = childSchema.safeParse(undefined);

      if (!result.success) {
        broadcaster.catch(result.error, {
          type: ObjectMutations.DELETE,
          prev: current,
          keys: [prop as string],
        });

        if (!configs.safeParse) {
          broadcaster.broadcast(
            init,
            {
              type: ObjectMutations.DELETE,
              prev: current,
              keys: [prop as string],
              error: result.error,
            },
            meta.id
          );

          return !configs.strict;
        } else {
          error = result.error;
        }
      }
    }

    Reflect.deleteProperty(target, prop);

    if (INIT_REGISTRY.has(current)) {
      const state = INIT_REGISTRY.get(current) as Linkable;

      if (subscriptions.has(state)) {
        unlink(state);
      }
    }

    if (STATE_REGISTRY.has(current) && subscriptions.has(current)) {
      unlink(current);
    }

    if (!STATE_BUSY_LIST.has(target)) {
      const event: StateChange = {
        type: ObjectMutations.DELETE,
        prev: current,
        keys: [prop],
        error,
      };

      // Make sure to broadcast to subscribers first because observers might depend on a derived state.
      broadcaster.broadcast(target, event, meta.id);
      broadcaster.emit(event, prop);

      // Trigger the dev tool callback if available.
      plugin.devTool?.onDelete?.(meta, prop);
    }

    return true;
  };
}

function getRawTarget(target: Linkable) {
  let value = STATE_REGISTRY.get(target)!;
  /* istanbul ignore next */
  while (STATE_REGISTRY.has(value)) {
    value = STATE_REGISTRY.get(value)!;
  }
  return value;
}
