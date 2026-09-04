import {
  $symbol,
  captureStack,
  getObserver,
  getScope,
  isBrowser,
  isMutableRef,
  isValueGetter,
  setScope,
  untrack,
} from '@airlib/core';
import { isBinding, isLinkingRef } from './binding.js';
import { renderDynamic } from './dynamic.js';
import type { ComponentProps, ReactiveProps } from './types.js';

export const PROPS_SYMBOL = $symbol('setup-props');

/**
 * Executes a function with provided props temporarily set in the current context.
 *
 * This function sets the given props in the current closure context and executes
 * the provided function. After execution, it restores the previous props value.
 * This is useful for providing contextual data to child components in a scoped manner.
 *
 * @template P - The type of props being set
 * @template R - The return type of the executed function
 * @param props - The props to temporarily set in the context
 * @param fn - The function to execute with the provided props
 * @returns The result of executing the provided function
 */
export function withProps<P, R>(props: P, fn: () => R) {
  const prevProps = getScope<ReactiveProps<Record<string, unknown>>>(PROPS_SYMBOL);
  setScope(PROPS_SYMBOL, props);

  try {
    return fn();
  } finally {
    setScope(PROPS_SYMBOL, prevProps);
  }
}

/**
 * Retrieves the props from the current context.
 *
 * This function gets the props that were previously set using withProps().
 * It accesses the props from a shared closure context using a symbol key.
 *
 * @template P - The expected type of the props
 * @returns The props from the current context
 */
export function getProps<P>(): ComponentProps<P> {
  return getScope(PROPS_SYMBOL) as ComponentProps<P>;
}

/**
 * Conditionally returns a callback function based on the environment.
 *
 * In non-browser environments, returns undefined to prevent execution
 * of client-side callbacks during server-side rendering.
 *
 * @template T - The function type
 * @param fn - The callback function
 * @returns The function if in browser environment, undefined otherwise
 */
export function callback<T>(fn: T): T {
  if (!isBrowser()) return undefined as never;
  return fn;
}

/**
 * Creates a proxy for props that handles binding references and read-only properties.
 *
 * This function creates a proxy that:
 * - Resolves binding references to their actual values on get operations
 * - Prevents assignment to event handler properties (those starting with "on")
 * - Properly handles setting values on binding references
 *
 * @template P - The props type
 * @param props - The props object to wrap
 * @param strict - Whether to enforce strict mode for destructuring props
 * @returns A proxy wrapping the props object
 */
export function proxyProps<P>(props: P, strict = true): ComponentProps<P> {
  const omit = (keys: Array<keyof P>) => {
    return omitProps(props, newProps as never, keys ?? []);
  };
  const pick = (keys: Array<keyof P>) => {
    return pickProps(props, newProps as never, keys ?? []);
  };

  const newProps = new Proxy(props as ComponentProps<P>, {
    get(target, key, receiver) {
      if (key === '$omit') return omit;
      if (key === '$pick') return pick;
      if (key === '$children') return renderDynamic(Reflect.get(target, 'children' as never, receiver));

      const bindingRef = Reflect.get(target, key, receiver);

      if (isValueGetter(bindingRef)) {
        return bindingRef();
      } else if (isBinding(bindingRef)) {
        return bindingRef.value;
      } else if (isMutableRef(bindingRef)) {
        return bindingRef.value;
      } else if (isLinkingRef(bindingRef)) {
        return bindingRef.value;
      }

      return bindingRef;
    },
    set(target, key, value, receiver) {
      const bindingRef = untrack(() => Reflect.get(target, key, receiver));

      if (typeof key === 'string' && key.startsWith('on')) {
        const error = new Error(`Property '${key}' is read-only.`);
        captureStack.violation.general(
          'Read-only property assignment',
          `Cannot assign to read-only property '${key}'. Event handlers can only be specified in parent component.`,
          error,
          [
            'Event handler properties (starting with "on") are read-only.',
            '- Define event handlers in the parent component.',
            '- Only mutate properties meant for two-way data binding.',
          ]
        );
        return true;
      }

      if (isBinding(bindingRef)) {
        bindingRef.value = value;
      } else if (isMutableRef(bindingRef)) {
        bindingRef.value = value;
      } else {
        Reflect.set(target, key, value, receiver);
      }

      return true;
    },
    ownKeys(target: Record<string, unknown>): ArrayLike<string | symbol> {
      const observer = getObserver();

      if (observer && strict) {
        const error = new Error('Rest props are not allowed.');
        captureStack.violation.general(
          'Rest props usage detected.',
          'Using rest props in a reactive boundary is not allowed.',
          error,
          [
            'Rest props ({ ...rest }) are not allowed in a reactive boundary.',
            '- Use the props.$omit() method to exclude specific props.',
            '- Use the props.$pick() method to include specific props.',
          ],
          this.ownKeys
        );
        return [];
      }

      return untrack(() => Reflect.ownKeys(target));
    },
  });

  return newProps as ComponentProps<P>;
}

/**
 * Creates a new object excluding specified properties from the original object.
 *
 * This function returns a proxy that filters out specified keys when enumerating
 * the object's properties. The returned object behaves like the original but
 * omits the excluded properties from enumeration and spreading operations.
 *
 * @template T - The type of the original object
 * @template K - The type of keys to exclude
 * @param source - The original object to create a proxy for
 * @param props - The proxied object to omit properties from
 * @param excludes - An array of keys to exclude from the object (default: empty array)
 * @returns A new object with specified properties omitted
 */
export function omitProps<T, K extends keyof T>(source: T, props: T, excludes: Array<K> = []): Omit<T, K> {
  return new Proxy(source as Record<string, unknown>, {
    get(_target, key, receiver) {
      return Reflect.get(props as Record<string, unknown>, key, receiver);
    },
    set(_target, key, value, receiver) {
      return Reflect.set(props as Record<string, unknown>, key, value, receiver);
    },
    ownKeys(target: Record<string, unknown>): ArrayLike<string | symbol> {
      return untrack(() => {
        return Reflect.ownKeys(target as Record<string, unknown>).filter((k) => !excludes.includes(k as never));
      });
    },
  }) as never;
}

/**
 * Creates a new object including only specified properties from the original object.
 *
 * This function returns a proxy that includes only specified keys when enumerating
 * the object's properties. The returned object behaves like the original but
 * only contains the included properties during enumeration and spreading operations.
 *
 * @template T - The type of the original object
 * @template K - The type of keys to include
 * @param source - The original object to create a proxy for
 * @param props - The original object to pick properties from
 * @param includes - An array of keys to include in the object (default: empty array)
 * @returns A new object with only specified properties included
 */
export function pickProps<T, K extends keyof T>(source: T, props: T, includes: Array<K> = []): Pick<T, K> {
  return new Proxy(source as Record<string, unknown>, {
    get(_target, key, receiver) {
      return Reflect.get(props as Record<string, unknown>, key, receiver);
    },
    set(_target, key, value, receiver) {
      return Reflect.set(props as Record<string, unknown>, key, value, receiver);
    },
    ownKeys(target: Record<string, unknown>): ArrayLike<string | symbol> {
      return untrack(() => {
        return Reflect.ownKeys(target as Record<string, unknown>).filter((k) => includes.includes(k as never));
      });
    },
  }) as never;
}
