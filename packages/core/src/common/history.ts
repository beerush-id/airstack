import { anchor } from '../engine/anchor.js';
import { assign } from '../engine/helper.js';
import { setInspector } from '../engine/index.js';
import { replay, rollback } from '../reactive/event.js';
import { subscribe } from '../reactive/index.js';
import { mutable } from '../reactive/ref.js';
import { ObjectMutations } from '../shared/enum.js';
import { captureStack } from '../shared/index.js';
import type { Linkable, State, StateChange } from '../types.js';
import { microtask } from '../utils/index.js';

export type HistoryOptions = {
  debounce?: number;
  maxHistory?: number;
  resettable?: boolean;
  /** Whether everything recorded in one debounce window is taken back and put back together, as one step. */
  group?: boolean;
};

export const DEFAULT_HISTORY_OPTION = {
  debounce: 100,
  maxHistory: 100,
  resettable: false,
  group: false,
};

function setDefaultOptions(options: HistoryOptions) {
  Object.assign(DEFAULT_HISTORY_OPTION, options);
}
function getDefaultOptions() {
  return DEFAULT_HISTORY_OPTION;
}

export type HistoryState = {
  readonly backwardList: StateChange[];
  readonly forwardList: StateChange[];
  canBackward: boolean;
  canForward: boolean;
  canReset: boolean;
  backward(): void;
  forward(): void;
  destroy(): void;
  clear(): void;
  reset(): void;
};
export interface HistoryFactory {
  (state: State, options?: HistoryOptions): HistoryState;

  setDefaultOptions(options: HistoryOptions): void;
  getDefaultOptions(): HistoryOptions;
}

/**
 * Creates a history management system for a reactive state object.
 *
 * This function tracks state changes and provides undo/redo functionality.
 * It maintains backward and forward stacks of state changes, allowing users
 * to navigate through the history of modifications.
 *
 * @template T - The type of the state object
 * @param state - The reactive state object to track
 * @param options - Configuration options for the history management
 * @param options.debounce - Debounce time in milliseconds for collecting changes (default: 100ms)
 * @param options.maxHistory - Maximum number of history states to keep (default: 100)
 * @returns A HistoryState object with methods and properties for history management
 */
function historyFn<T extends State>(state: T, options?: HistoryOptions): HistoryState {
  const {
    maxHistory = DEFAULT_HISTORY_OPTION.maxHistory,
    debounce = DEFAULT_HISTORY_OPTION.debounce,
    resettable = DEFAULT_HISTORY_OPTION.resettable,
    group = DEFAULT_HISTORY_OPTION.group,
  } = options ?? {};

  const [schedule] = microtask<StateChange>(debounce);
  const changeList: StateChange[] = [];
  const backwardList: StateChange[] = [];
  const forwardList: StateChange[] = [];
  const mergeList = new Set<StateChange>();
  const steps = new WeakMap<StateChange, object>();
  const controller = subscribe.resolve(state);

  if (!anchor.has(state)) {
    const error = new Error('Object is not reactive.');
    captureStack.error.external('Cannot create history state from non-reactive object.', error, history);
  }

  let isBusy = false;

  const backward = () => {
    isBusy = true;

    const event = backwardList.pop();

    if (event) {
      forwardList.unshift(event);
      rollback(state, event);
      while (group && steps.get(backwardList[backwardList.length - 1]) === steps.get(event)) {
        const change = backwardList.pop() as StateChange;
        forwardList.unshift(change);
        rollback(state, change);
      }
      assign(historyState, {
        canForward: forwardList.length > 0,
        canBackward: backwardList.length > 0,
        canReset: changeList.length > 0,
      });
    }

    isBusy = false;
  };

  const forward = () => {
    isBusy = true;

    const event = forwardList.shift();

    if (event) {
      backwardList.push(event);
      replay(state, event);
      while (group && steps.get(forwardList[0]) === steps.get(event)) {
        const change = forwardList.shift() as StateChange;
        backwardList.push(change);
        replay(state, change);
      }
      assign(historyState, {
        canForward: forwardList.length > 0,
        canBackward: backwardList.length > 0,
        canReset: changeList.length > 0,
      });
    }

    isBusy = false;
  };

  const clear = () => {
    isBusy = true;

    backwardList.length = 0;
    forwardList.length = 0;

    assign(historyState, {
      canForward: forwardList.length > 0,
      canBackward: backwardList.length > 0,
      canReset: changeList.length > 0,
    });

    isBusy = false;
  };

  const reset = () => {
    if (!options?.resettable) return;
    isBusy = true;

    while (changeList.length) {
      rollback(state, changeList.pop() as StateChange);
    }

    clear();
    isBusy = false;
  };

  const destroy = () => {
    changeList.length = 0;
    unsubscribe?.();
    clear();
  };

  // Subscribe for state changes and push the event to the backward stack, then clears the forward stack.
  const unsubscribe = controller?.subscribe((_snap, event) => {
    if (event.type !== 'init' && !isBusy) {
      mergeList.add(event);

      schedule(() => {
        if (maxHistory && backwardList.length >= maxHistory) {
          backwardList.shift();
        }

        const step = {};

        for (const change of mergeChanges(mergeList)) {
          if (resettable) {
            changeList.push(change);
          }

          steps.set(change, step);
          backwardList.push(change);
        }

        forwardList.length = 0;
        mergeList.clear();

        assign(historyState, {
          canForward: forwardList.length > 0,
          canBackward: backwardList.length > 0,
          canReset: changeList.length > 0,
        });
      }, event);
    }
  });

  const historyState = mutable<HistoryState>(
    {
      get backwardList() {
        return backwardList;
      },
      get forwardList() {
        return forwardList;
      },
      canBackward: false,
      canForward: false,
      canReset: changeList.length > 0,
      backward,
      forward,
      destroy,
      reset,
      clear,
    },
    { recursive: false }
  );

  return historyState;
}

historyFn.setDefaultOptions = setDefaultOptions;
historyFn.getDefaultOptions = getDefaultOptions;

export const history = historyFn as HistoryFactory;

/**
 * Creates an undoable operation that can be executed and later reverted.
 *
 * This function wraps a given function execution and captures any state changes
 * that occur during its execution. It returns a tuple containing two functions:
 * the first one undoes the changes, and the second one clears the captured changes.
 *
 * @param operation - The function to execute and make undoable
 * @returns A tuple containing two functions: [undo, clear]
 *   - undo: A function that, when called, will undo the changes made by the original function
 *   - clear: A function that, when called, will clear the captured changes (marking as completed)
 */
export function undoable(operation: () => void): [() => void, () => void] {
  if (typeof operation !== 'function') {
    const error = new Error('Invalid argument.');
    captureStack.error.argument('The given argument is not a function.', error, undoable);

    return [() => {}, () => {}];
  }

  const changes: { state: State; change: StateChange }[] = [];

  setInspector((init: Linkable, event: StateChange) => {
    changes.unshift({ state: anchor.find(init), change: event });
  });

  try {
    operation();
  } catch (error) {
    captureStack.error.external('Undoable execution failed.', error as Error);
  } finally {
    setInspector(undefined);
  }

  const undo = () => {
    changes.forEach(({ state, change }) => {
      rollback(state, change);
    });
    changes.length = 0;
  };

  const clear = () => {
    changes.length = 0;
  };

  return [undo, clear];
}

/**
 * Creates a consolidated list of state changes by merging multiple changes to the same key.
 *
 * This function processes a set of state changes and consolidates them so that each unique
 * key path only appears once in the resulting array. When multiple changes set the same
 * key path, only the first change (earliest in the set) is kept, but its value is updated
 * to the latest value for that key path. Any other mutation stays as it happened: an array's
 * or a collection's mutations each did their own work, and their values are their arguments.
 *
 * This is used internally by the history management system to optimize history entries,
 * ensuring that rapid successive changes to the same property result in a single history
 * entry with the final value rather than multiple intermediate states.
 *
 * @param changeList - A set of state change events to consolidate
 * @returns An array of consolidated state change events
 *
 * @internal
 */
function mergeChanges(changeList: Set<StateChange>) {
  const prevChanges = new Map<unknown, StateChange>();
  const nextChanges = new Map<unknown, unknown>();

  for (const change of changeList) {
    const key = change.type === ObjectMutations.SET ? change.keys.join('.') : change;

    if (!prevChanges.has(key)) {
      prevChanges.set(key, change);
    }

    nextChanges.set(key, change.value);
  }

  return Array.from(prevChanges.entries()).map(([key, change]) => {
    return {
      ...change,
      value: nextChanges.get(key),
    };
  });
}
