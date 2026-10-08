import type { AnyType } from '../types.js';

/**
 * Attaches a DOM event listener and returns the remover for that exact listener.
 * Attach and detach are paired at the call site so the same handler reference is always used
 * for both, which is what keeps inline-created handlers from leaking.
 * @param element - The element to listen on.
 * @param type - The DOM event name, e.g. `"pointerdown"`.
 * @param handler - The listener invoked with the typed event.
 * @returns {EventReleaseFn} A function that removes this listener.
 */
export function addEventListener<T extends Element, E extends Event>(
  element: T,
  type: string,
  handler: (event: E) => unknown
) {
  element.addEventListener(type, handler as EventListener);
  return () => element.removeEventListener(type, handler as EventListener);
}

let ACTIVE_RELEASES: Set<EventReleaseFn> | undefined;

/**
 * A function that releases event listeners registered through this module.
 */
export type EventReleaseFn = () => void;

/**
 * Registers one listener within the currently collecting event scope.
 * @param element - The element, document, or window to listen on.
 * @param type - The DOM event name.
 * @param handler - The listener invoked with the event payload.
 * @returns {EventReleaseFn} A function that removes this listener ahead of the scope release.
 */
export type EventListenerFn = (
  element: Element | Document | Window,
  type: string,
  handler: (event: AnyType) => unknown
) => () => void;

/**
 * Declares a group of event listeners that are torn down as a single unit.
 * Use it where one lifecycle scope wires listeners across several targets, so the scope only has
 * to hold one release instead of tracking every remover individually.
 * `handler` runs synchronously, so listeners attached later (timers, promises, re-renders) fall
 * outside the group and must release themselves. Nested scopes collect independently.
 * @param handler - Called with the scoped `listen` function.
 * @returns {EventReleaseFn} A function that removes every listener the scope collected.
 */
export function withEvents(handler: (listen: EventListenerFn) => void): EventReleaseFn {
  const prevReleases = ACTIVE_RELEASES;
  const newReleases = new Set<EventReleaseFn>();

  const listen = ((element, type, handler) => {
    newReleases.add(addEventListener(element as Element, type, handler));
  }) as EventListenerFn;

  ACTIVE_RELEASES = newReleases;

  try {
    handler(listen);
  } finally {
    ACTIVE_RELEASES = prevReleases;
  }

  return () => {
    for (const release of newReleases) {
      release();
    }
  };
}
