import { ARRAY_MUTATIONS, HEURISTIC_THRESHOLD } from '../shared/constant.js';
import { captureStack } from '../shared/index.js';
import { plugin } from '../shared/plugin.js';
import type {
  ArrayChange,
  ArrayMutation,
  ArrayMutator,
  Broadcaster,
  Linkable,
  MethodLike,
  ModelArray,
  ModelError,
  ObjLike,
  StateMetadata,
  StateRelation,
  TrapOverrides,
} from '../types.js';
import { isFunction } from '../utils/index.js';
import { anchor } from './anchor.js';
import {
  BROADCASTER_REGISTRY,
  INIT_REGISTRY,
  META_REGISTRY,
  RELATION_REGISTRY,
  SORTER_REGISTRY,
  STATE_REGISTRY,
} from './registry.js';

const mockReturn = {
  shift(items: unknown[]) {
    return items[0];
  },
  unshift(items: unknown[]) {
    return items.length;
  },
  push(items: unknown[]) {
    return items.length;
  },
  pop(items: unknown[]) {
    return items[items.length - 1];
  },
  splice() {
    return [];
  },
  fill(items: unknown[]) {
    return items;
  },
  sort(items: unknown[]) {
    return items;
  },
  reverse(items: unknown[]) {
    return items;
  },
};

/**
 * Creates a mutator for an array that handles state changes and validation.
 *
 * This function creates a WeakMap of method proxies for array mutation methods.
 * It handles both mutable and immutable array operations, including:
 * - Validation of new items against a schema
 * - Broadcasting of state changes to subscribers
 * - Proper linking/unlinking of array elements
 * - Handling of immutable arrays by returning mock values
 *
 * @template T - The type of the array
 * @param init - The initial array state
 * @param options - Optional state references containing schema, configs, and subscribers
 * @returns A WeakMap mapping original array methods to their proxied implementations
 * @throws Error if called on a non-reactive state (when no references are found)
 */
export function createArrayMutator<T extends unknown[]>(init: T, options?: TrapOverrides) {
  const meta = META_REGISTRY.get(init) as StateMetadata;

  if (!meta) {
    throw new Error(`Array trap factory called on non-reactive state.`);
  }

  const compare = SORTER_REGISTRY.get(init);
  const broadcaster = BROADCASTER_REGISTRY.get(init) as Broadcaster;

  const { schema, subscriptions } = meta;
  const { unlink } = RELATION_REGISTRY.get(init) as StateRelation;
  const { configs } = options ?? meta;

  const mutator: ArrayMutator<T[number]> = {} as never;
  const mutatorMap = new WeakMap<WeakKey, MethodLike>();

  for (const method of ARRAY_MUTATIONS) {
    const originFn = (init as Array<unknown>)[method] as (...args: unknown[]) => unknown;
    const targetFn = (...args: unknown[]) => {
      // Make sure to always work with the underlying object (if exist).
      args = args.map((arg) => (anchor.has(arg as Linkable) ? anchor.get(arg as Linkable) : arg));

      // Early traps to prevent unnecessary state changes for no-op operations.
      if (method === 'splice') {
        const [startArg, delCountArg, ...items] = args as [number, number, ...unknown[]];

        // Normalize negative start index
        let start = startArg;
        if (start < 0) {
          start = Math.max(init.length + start, 0);
        }

        // Ensure delCount is non-negative, and that an omitted one removes everything from the start on.
        const delCount = args.length === 1 ? Math.max(init.length - start, 0) : Math.max(delCountArg ?? 0, 0);

        // No-op cases where we can return early without making any changes
        if (
          // Empty array with no items to add
          (!init.length && !items.length) ||
          // Empty array but trying to delete (nothing to delete)
          (!init.length && delCount > 0) ||
          // Start position beyond array length with no items to add
          (start >= init.length && !items.length) ||
          // Nothing to delete and no items to add
          (delCount === 0 && !items.length)
        ) {
          return [];
        }
      }

      if ((method === 'push' || method === 'unshift') && args.length === 0) {
        return init.length;
      }

      if ((method === 'pop' || method === 'shift') && init.length === 0) {
        return undefined;
      }

      if ((method === 'reverse' || method === 'sort') && init.length <= 1) {
        return INIT_REGISTRY.get(init);
      }

      if (method === 'fill' && init.length === 0) {
        return INIT_REGISTRY.get(init);
      }

      if (method === 'copyWithin') {
        const [target, start, end = init.length] = args as [number, number, number];

        if (target >= init.length || start >= init.length || end <= start) {
          return INIT_REGISTRY.get(init);
        }
      }

      // Capture the current items to track the removed items.
      const currentItems = [...(init as ObjLike[])];

      // Create a list of the added items.
      let addedItems: Linkable[] = [];

      if (method === 'splice') {
        // For splice, new items start from index 2 (after start and deleteCount)
        addedItems = args.slice(2) as Linkable[];
      } else if (method === 'fill') {
        // For fill, the same value is used for all elements
        addedItems = [args[0] as Linkable];
      } else if (method === 'push' || method === 'unshift') {
        // For push and unshift, all arguments are new items
        addedItems = args as Linkable[];
      }

      const addedItemsLength = addedItems.length;

      // Validate the added items.
      let error: ModelError | undefined;

      if (schema && addedItemsLength) {
        const validation = (schema as ModelArray).safeParse(addedItems);

        // If validation is successful, update the arguments with validated data.
        if (validation.success) {
          for (let i = 0; i < addedItemsLength; i++) {
            const value = addedItems[i];
            const index = args.indexOf(value);

            /* istanbul ignore else */
            if (index > -1) {
              args[index] = (validation.data as unknown[])?.[i];
            }
          }
        } else {
          broadcaster.catch(validation.error as never as ModelError, {
            type: method,
            keys: [],
            value: args,
          });

          if (!configs.safeParse) {
            broadcaster.broadcast(
              init,
              {
                type: method,
                keys: [],
                error: validation.error as never as ModelError,
                value: args,
              },
              meta.id
            );

            if (method === 'push' || method === 'unshift') {
              return currentItems.length;
            } else if (method === 'splice') {
              return [];
            }

            return INIT_REGISTRY.get(init);
          } else {
            error = validation.error as never as ModelError;
          }
        }
      }

      // Call the original method to perform the operation.
      let result: unknown;

      if (method === 'push' && configs.ordered && isFunction(compare)) {
        if (addedItems.length <= HEURISTIC_THRESHOLD) {
          for (const item of addedItems) {
            orderedPush(init, item, compare);
          }

          result = init.length;
        } else {
          originFn.apply(init, args);
          init.sort(compare);
          result = init.length;
        }
      } else {
        result = originFn.apply(init, args);
      }

      let current = currentItems;
      if (['shift', 'pop'].includes(method)) {
        current = result as never;
      }

      const deletedItems = removedItems(method, currentItems, init, result, args) as Linkable[];

      if (deletedItems.length && subscriptions.size) {
        // A removed element can still sit at another index when it was duplicated, and must stay linked there.
        let remaining: Set<unknown> | undefined;

        for (const item of deletedItems) {
          const childState = (STATE_REGISTRY.has(item) ? item : INIT_REGISTRY.get(item)) as Linkable;
          if (!subscriptions.has(childState)) continue;

          remaining ??= new Set(init);

          if (!remaining.has(STATE_REGISTRY.get(childState)) && !remaining.has(childState)) {
            unlink(childState);
          }
        }
      }

      const event: ArrayChange = {
        type: method as ArrayMutation,
        prev: current,
        keys: [],
        error,
        value: args,
        added: addedItems,
        removed: deletedItems,
      };

      // Broadcast the array mutation event to all subscribers
      // Make sure to broadcast to subscribers first because observers might depend on a derived state.
      broadcaster.broadcast(init, event, meta.id);
      broadcaster.emit(event);

      plugin.devTool?.onCall?.(meta, method, args);

      if (result === init) {
        return INIT_REGISTRY.get(init);
      }

      return result;
    };

    mutator[method] = targetFn as never;
    mutatorMap.set(originFn, targetFn);
  }

  if (configs.immutable) {
    for (const method of ARRAY_MUTATIONS) {
      const originFn = (init as Array<unknown>)[method] as (...args: unknown[]) => unknown;
      const targetFn: MethodLike = (...args) => {
        captureStack.violation.methodCall(method, targetFn);
        return (mockReturn[method as never] as typeof targetFn)?.(INIT_REGISTRY.get(init), ...args);
      };

      mutatorMap.set(originFn, targetFn);
    }
  }

  return { mutator, mutatorMap };
}

createArrayMutator.mock = mockReturn;

/**
 * Inserts an item into an array at the correct position to maintain sorted order.
 *
 * This function uses binary search to find the correct insertion point for the item
 * based on the provided comparison function. The array must already be sorted
 * according to the same comparison function for the result to be correctly sorted.
 *
 * @template T - The type of elements in the array
 * @param target - The sorted array to insert the item into
 * @param item - The item to insert
 * @param compare - A function that defines the sort order. It should return:
 *   - A negative value if the first argument is less than the second
 *   - Zero if the first argument is equal to the second
 *   - A positive value if the first argument is greater than the second
 */
export function orderedPush<T>(target: T[], item: T, compare: (a: T, b: T) => number): void {
  target.splice(orderedIndexOf(target, item, compare), 0, item);
}

/**
 * Finds the index at which an item should be inserted into a sorted array to maintain sort order.
 *
 * This function uses binary search to efficiently determine the correct insertion point
 * for the item based on the provided comparison function. The array must already be sorted
 * according to the same comparison function for the result to be correct.
 *
 * @template T - The type of elements in the array
 * @param target - The sorted array to search
 * @param item - The item to find the insertion index for
 * @param compare - A function that defines the sort order. It should return:
 *   - A negative value if the first argument is less than the second
 *   - Zero if the first argument is equal to the second
 *   - A positive value if the first argument is greater than the second
 * @returns The index at which the item should be inserted to maintain sorted order
 */
export function orderedIndexOf<T>(target: T[], item: T, compare: (a: T, b: T) => number): number {
  let low = 0;
  let high = target.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const result = compare(target[mid], item);

    if (result <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Lists the elements an array mutation took out of the array, read from what the mutation really did rather
 * than from its arguments. An element written back by the same mutation (re-inserted by a splice, or moved by
 * a copyWithin) is not counted, so the list holds only what left.
 *
 * @param method - The mutation that ran.
 * @param before - A copy of the array's items before the mutation.
 * @param after - The array after the mutation.
 * @param result - What the mutation returned.
 * @param args - The arguments the mutation ran with, after validation.
 * @returns {unknown[]} The removed elements, one entry per removed occurrence.
 */
function removedItems(method: string, before: unknown[], after: unknown[], result: unknown, args: unknown[]) {
  if (method === 'shift' || method === 'pop') return [result];
  if (method === 'splice') return subtractItems(result as unknown[], args.slice(2));
  if (method !== 'fill' && method !== 'copyWithin') return [];

  const overwritten: unknown[] = [];
  const written: unknown[] = [];

  for (let i = 0; i < after.length; i++) {
    if (before[i] !== after[i]) {
      overwritten.push(before[i]);
      written.push(after[i]);
    }
  }

  return subtractItems(overwritten, written);
}

/**
 * Takes one occurrence out of a list for each matching occurrence in another, like a multiset difference.
 *
 * @param items - The list to take from.
 * @param others - The occurrences to take out.
 * @returns {unknown[]} The items left, in their order.
 */
function subtractItems(items: unknown[], others: unknown[]): unknown[] {
  if (!items.length || !others.length) return items;

  const counts = new Map<unknown, number>();

  for (const item of others) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  return items.filter((item) => {
    const count = counts.get(item);
    if (!count) return true;

    counts.set(item, count - 1);
    return false;
  });
}
