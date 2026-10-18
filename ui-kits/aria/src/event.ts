import { type AnyType, isBrowser } from '@airlib/core';

/**
 * Generic event callback signature.
 *
 * @param args - Arguments forwarded from the event dispatch.
 */
export type GenericHandler = (...args: AnyType[]) => void;

/**
 * Headless event delegation and lifecycle manager for DOM elements.
 *
 * Coordinates multiple callbacks through a single native listener per event type,
 * managing attachment across target element transitions and teardown.
 *
 * @typeParam E - Host element type, defaulting to {@link HTMLElement}.
 */
export class EventMap<E extends Element = HTMLElement> {
  #element?: E;

  protected handlers = new Map<string, { handler: GenericHandler; attached: boolean }>();
  protected listeners: Map<string, Set<GenericHandler>> = new Map();

  /**
   * Initializes the event manager for the specified target element.
   *
   * @param element - The host DOM element to manage events for, if available.
   */
  constructor(element?: E) {
    this.#element = element;
  }

  /**
   * Gets the currently targeted DOM element.
   */
  public get element(): E | undefined {
    return this.#element;
  }

  /**
   * Replaces the targeted DOM element, detaching registered handlers from the previous
   * element and reattaching them to the new target.
   *
   * @param element - The new host DOM element, or undefined to unbind.
   */
  public set element(element: E | undefined) {
    if (this.#element === element) return;

    this.detachHandlers();
    this.#element = element;

    if (this.#element) {
      this.attachHandlers();
    }
  }

  /**
   * Registers an event callback for the specified event type.
   *
   * @param type - DOM event type.
   * @param handler - Callback invoked when the event fires.
   * @returns A teardown function to unregister the handler.
   */
  public add(type: string, handler: GenericHandler): () => void {
    /* istanbul ignore if */
    if (!isBrowser()) return () => {};

    const eventType = this.normalizeType(type);
    this.createHandler(eventType);
    this.createListener(eventType, handler);
    this.attachHandler(eventType);

    return () => {
      this.remove(eventType, handler);
    };
  }

  /**
   * Unregisters an event callback for the specified event type.
   *
   * Detaches the underlying native listener when no callbacks remain.
   *
   * @param type - DOM event type.
   * @param handler - Specific callback to remove, or undefined to remove all.
   */
  public remove(type: string, handler?: GenericHandler): void {
    /* istanbul ignore if */
    if (!isBrowser()) return;

    const eventType = this.normalizeType(type);
    const listeners = this.listeners.get(eventType);

    if (!listeners?.size || !handler) {
      this.listeners.delete(eventType);
      this.detachHandler(eventType);
      return;
    }

    listeners.delete(handler);

    if (!listeners.size) {
      this.listeners.delete(eventType);
      this.detachHandler(eventType);
    }
  }

  /**
   * Tears down all event bindings and clears registered callbacks.
   */
  public destroy(): void {
    this.detachHandlers();
    this.handlers.clear();
    this.listeners.clear();
    this.#element = undefined;
  }

  /**
   * Normalizes an event name by stripping leading "on" or "on:" prefixes and converting to lowercase.
   *
   * @param type - Raw event name (e.g. "onClick", "on:keydown", "click").
   * @returns Canonical DOM event name.
   */
  protected normalizeType(type: string): string {
    return type.replace(/^on:?/i, '').toLowerCase();
  }

  /**
   * Attaches all registered native event handlers to the target element if listeners exist.
   */
  protected attachHandlers(): void {
    if (!this.#element) return;

    for (const type of this.handlers.keys()) {
      this.attachHandler(type);
    }
  }

  /**
   * Detaches all registered native event handlers from the target element.
   */
  protected detachHandlers(): void {
    if (!this.#element) return;

    for (const type of this.handlers.keys()) {
      this.detachHandler(type);
    }
  }

  /**
   * Attaches the native handler for a specific event type if element and listeners exist.
   *
   * @param type - DOM event type.
   */
  protected attachHandler(type: string): void {
    if (!this.#element) return;

    const listeners = this.listeners.get(type);
    if (!listeners?.size) return;

    const handler = this.handlers.get(type);
    if (!handler || handler.attached) return;

    this.#element.addEventListener(type, handler.handler);
    handler.attached = true;
  }

  /**
   * Detaches the native handler for a specific event type if currently attached.
   *
   * @param type - DOM event type.
   */
  protected detachHandler(type: string): void {
    if (!this.#element) return;

    const handler = this.handlers.get(type);
    if (!handler?.attached) return;

    this.#element.removeEventListener(type, handler.handler);
    handler.attached = false;
  }

  /**
   * Creates the native listener wrapper for an event type if not already present.
   *
   * @param type - DOM event type.
   */
  protected createHandler(type: string): void {
    if (this.handlers.has(type)) return;

    this.handlers.set(type, {
      handler: (...args: AnyType[]) => {
        const listeners = this.listeners.get(type);
        if (!listeners) return;

        const snapshot = Array.from(listeners);
        for (const listener of snapshot) {
          listener(...args);
        }
      },
      attached: false,
    });
  }

  /**
   * Appends a callback to the listener set for the specified event type.
   *
   * @param type - DOM event type.
   * @param handler - Callback to register.
   */
  protected createListener(type: string, handler: GenericHandler): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(handler);
  }
}
