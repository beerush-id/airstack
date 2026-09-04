import { $symbol, createContextStore, getContextStore, getScope, setContextStore, setScope } from '@airlib/core';

const CLEANUP_SYMBOL = $symbol('cleanup-store');

export interface VirtualComponent {
  run<R>(fn: () => R): R;
  destroy(): void;
}

/**
 * Creates a virtual component tree boundary that isolates its own context store
 * and manages its own component cleanup collection.
 *
 * @returns VirtualComponent with .run() and .destroy() methods
 */
export function component(): VirtualComponent {
  const store = createContextStore();
  const cleanups = new Set<() => void>();

  return {
    run<R>(fn: () => R): R {
      const prevStore = getContextStore();
      setContextStore(store);

      const prevCleanup = getScope(CLEANUP_SYMBOL);
      setScope(CLEANUP_SYMBOL, (handler: () => void) => {
        cleanups.add(handler);
      });

      try {
        return fn();
      } finally {
        setScope(CLEANUP_SYMBOL, prevCleanup);
        setContextStore(prevStore);
      }
    },
    destroy(): void {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
      cleanups.clear();
    },
  };
}

/**
 * Mimics `<element ref={widget.ref} {...widget.attributes}>` framework binding.
 * Spreads attribute event listeners onto the target element and attaches the widget ref.
 *
 * @param element - The target DOM element
 * @param widget - Controller instance exposing .ref() and .attributes
 * @returns The bound DOM element
 */
export function bind<E extends HTMLElement>(
  element: E,
  widget: { ref: (el: any) => unknown; attributes: Record<string, unknown> }
): E {
  Object.assign(element, widget.attributes);
  widget.ref(element);
  return element;
}
