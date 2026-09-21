import {
  $symbol,
  type AnyType,
  captureStack,
  getScope,
  isMutableRef,
  isValueGetter,
  type MutableRef,
  mutable,
  setScope,
  untrack,
} from '@airlib/core';
import { type BindingRef, isBinding } from './binding.js';
import type { BindableComponentProps } from './types.js';

const PROPS_KEY = $symbol('component-props');
export function setCurrentProps(props: Record<string, unknown>) {
  setScope(PROPS_KEY, props);
}
export function getCurrentProps() {
  return getScope<Record<string, unknown>>(PROPS_KEY);
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
 * @returns A proxy wrapping the props object
 */
// biome-ignore lint/suspicious/noExplicitAny: library
export function proxyProps<P extends Record<string, any>>(props: P): BindableComponentProps<P> {
  const omit = (keys: Array<keyof P>) => {
    return omitProps(props, newProps, keys ?? []);
  };
  const pick = (keys: Array<keyof P>) => {
    return pickProps(props, newProps, keys ?? []);
  };
  let children = () => props.children;

  const shadow = mutable({} as P);

  const newProps = new Proxy(props as P, {
    get(target, key, receiver) {
      if (key === '$omit') return omit;
      if (key === '$pick') return pick;
      if (key === 'children') {
        if (getCurrentProps() !== newProps) return children;
        children = props.children;
        return children;
      }

      if (!(key in props)) {
        return shadow[key as string];
      }

      const bindingRef = Reflect.get(target, key, receiver);

      if (isValueGetter(bindingRef)) {
        return (bindingRef as AnyType)();
      } else if (isBinding(bindingRef)) {
        return (bindingRef as BindingRef<unknown, unknown>).value;
      } else if (isMutableRef(bindingRef)) {
        return (bindingRef as MutableRef<unknown>).value;
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
        (bindingRef as BindingRef<unknown, unknown>).value = value;
      } else if (isMutableRef(bindingRef)) {
        (bindingRef as MutableRef<unknown>).value = value;
      } else {
        shadow[key as keyof P] = value;
      }

      return true;
    },
  });

  return newProps as never as BindableComponentProps<P>;
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
