import { isReactive } from '../engine/config.js';
import { OBSERVER_SYMBOL, switchable } from '../engine/index.js';
import { META_REGISTRY } from '../engine/registry.js';
import { isBrowser } from '../module.js';
import { asyncStoreContract, storeContract } from '../scope/context.js';
import { onCleanup } from '../scope/index.js';
import { ANCHOR_SETTINGS } from '../shared/constant.js';
import { captureStack } from '../shared/index.js';
import { plugin } from '../shared/plugin.js';
import type {
  AsyncEffectHandler,
  Effect,
  EffectHandler,
  KeyLike,
  Linkable,
  StateChange,
  StateMetadata,
  StateObserver,
  StatePublicTracker,
  StateReadTracker,
  StateTracker,
  StateUnsubscribe,
} from '../types.js';
import { isFunction, microtask, shortId } from '../utils/index.js';

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
function effectFn<T>(fn: EffectHandler<T>, displayName?: string): StateUnsubscribe {
  if (!isReactive()) {
    fn({ type: 'init', keys: [] });
    return () => {};
  }

  let cleanup: StateUnsubscribe | undefined;

  const observer = createObserver(
    (event) => {
      cleanup?.();
      // observer.reset();

      runEffect(event);
    },
    undefined,
    true
  );
  observer.name = `Effect(${displayName ?? 'Anonymous'})`;

  const runEffect = (event: StateChange) => {
    const cleanupFn = observer.run(() => fn(event));

    if (typeof cleanupFn === 'function') {
      cleanup = cleanupFn as StateUnsubscribe;
    } else {
      cleanup = undefined;
    }
  };
  const runCleanup = () => {
    cleanup?.();
    observer.destroy();
  };

  onCleanup(runCleanup);

  runEffect({ type: 'init', keys: [] });

  return runCleanup;
}

/**
 * Creates a reactive effect that automatically tracks dependencies and re-runs when those dependencies change.
 * The effect function will be executed immediately and then again whenever any tracked state changes.
 *
 * @param fn - The effect function to execute. It receives a StateChange event object containing
 *             information about what triggered the effect (init, set, delete, etc.) and which keys changed.
 * @param displayName - Optional effect name for debugging.
 * @returns A cleanup function that can be called to manually dispose of the effect and unsubscribe
 *          from all tracked dependencies. This is automatically called when the current scope is cleaned up.
 */
function asyncEffectFn<T>(fn: AsyncEffectHandler<T>, displayName?: string): StateUnsubscribe {
  const handleError = (error: Error) => {
    captureStack.error.external('Unhandled effect exception', error, handleError, observer.run, runEffect, effect);
  };

  if (!isReactive()) {
    fn({ type: 'init', keys: [] }).catch(handleError);
    return () => {};
  }

  let cleanup: StateUnsubscribe | undefined;

  const observer = createObserver(
    (event) => {
      cleanup?.();
      // observer.reset();

      runEffect(event).catch(handleError);
    },
    undefined,
    true
  );
  observer.name = `Effect(${displayName ?? 'Anonymous'})`;

  const runEffect = async (event: StateChange) => {
    try {
      const cleanupFn = await observer.runAsync(() => fn(event));

      if (typeof cleanupFn === 'function') {
        cleanup = cleanupFn as StateUnsubscribe;
      } else {
        cleanup = undefined;
      }
    } catch (error) {
      cleanup = undefined;
      throw error;
    }
  };
  const runCleanup = () => {
    cleanup?.();
    observer.destroy();
  };

  onCleanup(runCleanup);

  runEffect({ type: 'init', keys: [] }).catch(handleError);

  return runCleanup;
}

effectFn.async = asyncEffectFn as Effect['async'];

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
effectFn.client = <T>(fn: EffectHandler<T>, displayName?: string): StateUnsubscribe => {
  /* istanbul ignore next */
  if (!isBrowser()) return () => {};
  return effectFn(fn, displayName);
};

export const effect = effectFn as Effect;

/**
 * Executes a function outside any observer context.
 * This function temporarily removes the current observer context,
 * executes the provided function, and then restores the previous observer context.
 * It's useful for running code that shouldn't be tracked by the reactive system.
 *
 * @param fn - The function to execute outside of observer context
 */
export function untrack<T>(fn: () => T): T {
  const restore = setStaticTracker(undefined);

  try {
    return switchable.untrack(fn) as T;
  } finally {
    restore();
  }
}

/**
 * Executes a function outside any observer context.
 * This function temporarily removes the current observer context,
 * executes the provided function, and then restores the previous observer context.
 * It's useful for running code that shouldn't be tracked by the reactive system.
 *
 * @param fn - The function to execute outside of observer context
 */
export const $do = untrack;

/**
 * Gets the current observer context.
 *
 * @returns The current observer or undefined if none is set
 * @warning This is a low-level API designed for library authors or advanced use cases.
 */
export function getObserver(): StateObserver | undefined {
  return switchable.getObserver();
}

/**
 * Creates a new observer instance for tracking state changes.
 * An observer manages subscriptions and provides lifecycle hooks for state tracking.
 *
 * @param onChange - Callback function that will be called when state changes occur
 * @param onTrack - Callback function that will be called when a new state is tracked
 * @param controlled - A flag indicating whether the observer is controlled by the user
 * @returns A new observer instance with states management, onChange handler, onDestroy hook, and cleanup functionality
 * @warning This is a low-level API designed for library authors or advanced use cases.
 */
export function createObserver(
  onChange: (event: StateChange) => void,
  onTrack?: (state: Linkable, key: KeyLike) => void,
  controlled?: boolean
): StateObserver {
  const states = new WeakMap();

  if (!isReactive()) {
    return {
      id: shortId(),
      states,
      active: false,
      onChange() {},
      destroy() {},
      reset() {},
      assign() {
        return () => {};
      },
      run(fn: () => unknown) {
        return fn();
      },
      runAsync(fn: () => unknown) {
        return fn();
      },
      track() {},
    } as never as StateObserver;
  }

  let observedSize = 0;
  let isObserving = false;
  let isDestroyed = false;
  let stackCycles = 0;

  const cleaners = new Set<() => void>();
  const resetters = new Set<() => void>();

  const track = ((state, key) => {
    const keys = states.get(state) as Set<KeyLike>;
    if (typeof keys === 'undefined') return false;

    if (keys.has(key)) {
      return true;
    } else {
      keys.add(key);

      if (isFunction(onTrack)) {
        onTrack(state, key);
      }
    }

    return false;
  }) satisfies StateTracker;

  const destroy = () => {
    if (isDestroyed) return;

    const currentCleaners = Array.from(cleaners);

    for (const clear of currentCleaners) {
      /* istanbul ignore else */
      if (typeof clear === 'function') {
        clear();
      }
    }

    observedSize = 0;
    cleaners.clear();
    resetters.clear();

    isDestroyed = true;
  };

  const reset = () => {
    resetters.forEach((reset) => {
      /* istanbul ignore else */
      if (typeof reset === 'function') {
        reset();
      }
    });
  };

  const keyTrackers = new WeakMap();
  const assign = ((init, observers) => {
    if (!observers.has(observer)) {
      observers.add(observer);

      cleaners.add(() => {
        states.delete(init);
        observers.delete(observer);
        plugin.devTool?.onUntrack?.(META_REGISTRY.get(init) as StateMetadata, observer);
      });
    }

    if (!states.has(init)) {
      const keys = new Set();
      states.set(init, keys);

      resetters.add(() => {
        keys.clear();
      });

      /* istanbul ignore else */
      if (ANCHOR_SETTINGS.safeObservation) {
        observedSize += 1;

        if (observedSize > ANCHOR_SETTINGS.safeObservationThreshold) {
          const error = new Error('Observation limit exceeded.');
          captureStack.violation.general(
            'Unsafe observation detected:',
            `Attempted to observe too many (${observedSize}) states within a single observer.`,
            error,
            [
              `We always recommend keeping observations small.`,
              `- It's likely you are trying to perform an extensive read operation such as JSON.stringify during the observation phase.`,
              `- Use the optimized reader utility such as "anchor.read" to perform an extensive operation while maintain immutability.`,
            ],
            assign
          );
        }
      }
    }

    if (!keyTrackers.has(init)) {
      keyTrackers.set(init, (key: KeyLike) => track(init, key));
    }

    return keyTrackers.get(init);
  }) satisfies StateObserver['assign'];

  const [unstack] = microtask(0);
  const propagate = (event: StateChange) => {
    if (isObserving) stackCycles += 1;
    if (stackCycles >= 10) {
      const error = new Error('Circular mutation.');
      captureStack.violation.general(
        'Circular mutation detected:',
        `Attempted to mutate a state while observing the state itself.`,
        error,
        [
          'Circular state mutation is highly discouraged as it can lead to infinite loops and unpredictable behavior.',
          '- This happens when you mutate a reactive property inside a function that’s tracking that same property.',
          '- To prevent this, avoid mutating properties that you depend on inside an observer, or use the "untrack" utility to mark the read as non-reactive.',
        ],
        propagate
      );

      stackCycles = 0;
      return;
    }

    reset();
    onChange(event);
    unstack(() => (stackCycles = 0));
  };

  if (!controlled) {
    onCleanup(destroy);
  }

  const observer = {
    id: shortId(),
    get active() {
      return !isDestroyed;
    },
    states,
    destroy,
    reset: () => {
      const error = new Error('Deprecated API usage detected.');
      captureStack.warning.external(
        'Deprecated API usage detected.',
        'The "obserer.reset()" method is deprecated in favor of automatic cleanup.',
        error
      );
    },
    track,
    assign,
    onChange: propagate,
  } as never as StateObserver;

  // biome-ignore lint/suspicious/noExplicitAny: Expect any.
  (observer as any).run = storeContract(
    OBSERVER_SYMBOL,
    observer,
    () => {
      isObserving = true;
      isDestroyed = false;
    },
    () => {
      isObserving = false;
    }
  );
  // biome-ignore lint/suspicious/noExplicitAny: Expect any.
  (observer as any).runAsync = asyncStoreContract(
    OBSERVER_SYMBOL,
    observer,
    () => {
      isObserving = true;
      isDestroyed = false;
    },
    () => {
      isObserving = false;
    }
  );

  return observer;
}

/**
 * Sets the current tracker function for state observation.
 * This function manages the tracker stack, allowing for nested tracker contexts.
 * If the same tracker is already set, it returns the existing restore function.
 *
 * A tracker is meant for library author to implement global tracking, which
 * then they control how they track the state.
 *
 * @param tracker - The tracker function to set as current
 * @returns A restore function that reverts to the previous tracker when called
 * @warning This is a low-level API designed for library authors or advanced use cases.
 */
export function setTracker(tracker: StatePublicTracker) {
  if (!isReactive()) return;
  const current = plugin.track;
  plugin.track = tracker;
  return () => (plugin.track = current);
}

/**
 * Gets the current tracker function for state observation.
 * This function returns the currently active tracker, which is used to monitor
 * state changes and dependencies during reactive computations.
 *
 * @returns The current tracker function or undefined if no tracker is set
 * @warning This is a low-level API designed for library authors or advanced use cases.
 */
export function getTracker(): StatePublicTracker | undefined {
  return plugin.track;
}

export function $static<T>(reader: () => T) {
  const restore = setStaticTracker(undefined);
  try {
    return reader();
  } finally {
    restore();
  }
}

/**
 * Method decorator that runs the whole call with the static tracker disabled,
 * so reads inside the method never register dependencies.
 *
 * Uses the legacy `experimentalDecorators` descriptor signature, because TC39
 * stage-3 decorators cannot be lowered by the current toolchain.
 *
 * @param _target - The class prototype the method is declared on.
 * @param _propertyKey - The decorated method name.
 * @param descriptor - The original property descriptor of the method.
 * @returns A descriptor whose `value` applies the original method inside `$static`.
 */
export function passive<This, Args extends unknown[], Return>(
  _target: unknown,
  _propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<(this: This, ...args: Args) => Return>
): TypedPropertyDescriptor<(this: This, ...args: Args) => Return> {
  const original = descriptor.value;
  /* istanbul ingore next */
  if (!original) return descriptor;

  return {
    ...descriptor,
    value(this: This, ...args: Args): Return {
      return $static(() => original.apply(this, args));
    },
  };
}

export function setStaticTracker(tracker: StateReadTracker | undefined) {
  if (!isReactive()) return () => {};
  const current = plugin.trackStatic;
  plugin.trackStatic = tracker;
  return () => (plugin.trackStatic = current);
}

export function getStaticTracker(): StateReadTracker | undefined {
  return plugin.trackStatic;
}
