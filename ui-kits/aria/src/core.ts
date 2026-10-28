import {
  anchor,
  type AnyType,
  createContext,
  createObserver,
  isObjectLike,
  mutable,
  onCleanup,
  type StateObserver,
} from '@airlib/core';
import { currentAria } from './context.js';
import { EventMap, type GenericHandler } from './event.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
  NormalizedAttrs,
  RefineFn,
  TranslateFn,
} from './types.js';
import { applyAttributes, normalizeAttrs } from './utils/attributes.js';

/**
 * Non-DOM controller input tokens stripped from DOM assignment and JSX spreads.
 */
export const OMITTED_ATTRIBUTES = ['ref', 'manual', 'multiple', 'movable', 'orientation', 'invalid', 'oncommand'];

/**
 * Core library-managed attributes common across all interactive Aria controllers.
 */
export const COMMON_ATTRIBUTES = ['role', 'type', 'disabled', 'tabindex', 'aria-disabled', 'aria-selected'];

/**
 * Ambient context scope for active Aria controllers.
 * Enables nested overlays (Tooltips, Popovers) and child parts to self-discover
 * their enclosing parent controller without prop-drilling or provider wrappers.
 */
export const ariaScope = createContext<Aria<BaseElement, AriaProps, AriaAttributes<BaseElement>>>();

/**
 * Base ARIA behavioral controller that encapsulates reactive state management,
 * fine-grained DOM lifecycle binding, and attribute translation.
 *
 * @template E - Target Element type (HTML or SVG)
 * @template T - Reactive state interface
 * @template A - HTML / SVG / ARIA attributes interface matching E
 */
export class Aria<
  E extends BaseElement = HTMLElement,
  T extends AriaProps = AriaProps,
  A extends AriaAttributes<E> = AriaAttributes<E>,
  O extends AriaOptions = AriaOptions,
> {
  /**
   * The underlying reactive props proxy managed by AirLib.
   * Stores the component's interactive inputs and states (e.g. disabled, active, checked) for fine-grained reactivity.
   */
  public properties: T;

  /**
   * Headless event delegation and lifecycle manager bound to this controller.
   */
  public readonly events: EventMap<E> = new EventMap<E>();

  /**
   * The enclosing parent Aria controller discovered from ambient execution scope.
   * Enables self-discovering overlays (Tooltips, Popovers) and compound parts.
   */
  public readonly scope?: Aria<BaseElement, AriaProps, AriaAttributes<BaseElement>>;

  /**
   * Primary actionable controller registered within this scope.
   */
  public actionable?: Aria<BaseElement, AriaProps, AriaAttributes<BaseElement>>;

  /**
   * Whether this controller acts as an actionable candidate for parent scopes and overlays.
   */
  public isActionable = false;

  /**
   * The compiled HTML and ARIA attribute dictionary ready for JSX spread and SSR rendering.
   * Provides framework-translated attributes (e.g. className, onClick) for template binding.
   */
  public get attributes() {
    return this.translated;
  }

  /**
   * Get the full props for component spreading.
   */
  public get props() {
    return this.restProps();
  }

  /**
   * Attribute and event handler keys compiled and managed by this controller.
   * Exposes the active attribute names on {@link attributes} so consumers can safely omit
   * controlled keys when forwarding rest props (e.g. `props.$omit(controller.ownKeys)`).
   *
   * @returns Array of property names managed on the compiled attributes dictionary.
   */
  public get ownKeys(): string[] {
    return Array.from(
      new Set([...OMITTED_ATTRIBUTES, ...COMMON_ATTRIBUTES, ...Object.keys(this.attributes), ...this.omittedAttrs])
    );
  }

  /**
   * React RefObject getter to access the bound DOM element.
   * Enables interoperability with React ref contracts.
   */
  public get current(): E | null {
    return this.element;
  }

  /**
   * React RefObject setter to attach or detach the DOM element.
   * Synchronizes React ref updates directly with the controller's lifecycle ref.
   */
  public set current(element: E | null) {
    this.ref(element);
  }

  /**
   * Universal DOM ref callback for framework integration (SolidJS, Svelte, React, Native DOM).
   * Attaches the DOM element, triggers attribute synchronization, and manages the bind lifecycle.
   *
   * @param element - The Element to bind, or null to detach
   * @returns An optional detachment teardown callback
   */
  public ref = (element: E | null) => {
    if (this.element === element) return;
    if (this.element) {
      this.detach?.();
    }

    this.element = element;
    this.events.element = element ?? undefined;
    this.prevAttrs = undefined;
    this.update();

    if (element) {
      const detach = this.attach()!;
      this.detach = () => {
        detach?.();
      };
    }

    let refCleanup: (() => void) | undefined;

    if ('ref' in this.properties) {
      if (typeof this.properties.ref === 'function') {
        refCleanup = this.properties.ref(element);
      } else if (isObjectLike(this.properties.ref) && 'current' in this.properties.ref) {
        this.properties.ref.current = element;
      }
    }

    return () => {
      refCleanup?.();
      this.detach?.();
    };
  };

  /**
   * Whether the controller is configured for a native HTML element for this role.
   * When true, disables redundant ARIA attributes and keyboard polyfills.
   */
  public get isNative(): boolean {
    return !!this.options.native;
  }

  /**
   * Set of registered cleanup callbacks to execute upon controller destruction.
   */
  protected cleanups = new Set<() => void>();

  /**
   * The currently bound DOM element, or null if unmounted.
   * Tracks the target DOM node for direct attribute diffing and lifecycle event binding.
   */
  protected element: E | null = null;

  /**
   * Normalized native HTML and ARIA attributes dictionary.
   * Serves as the internal source of truth before framework translation and DOM diffing.
   */
  protected attrs: NormalizedAttrs<E> = {} as NormalizedAttrs<E>;

  /**
   * Cached framework-translated attributes dictionary ready for JSX spread.
   * Pre-computed outside reactive observation to provide zero-cost reads during template rendering.
   */
  protected translated: Record<string, unknown> = {};

  /**
   * Set of registered attribute refiner callbacks.
   * Allows external consumers to inject custom attributes, styles, and composed event handlers.
   */
  protected refiners = new Set<RefineFn<T, A>>();

  /**
   * Map of event handlers contributed by the controller's own createAttributes().
   */
  protected ownEvents = new Map<string, GenericHandler>();

  /**
   * Map of event handlers contributed by individual refiners.
   */
  protected refinerEvents = new Map<RefineFn<T, A>, Map<string, GenericHandler>>();

  /**
   * Reactive state observer instance managed by AirLib.
   * Automatically re-runs attribute computation whenever tracked reactive state properties mutate.
   */
  protected observer: StateObserver;

  /**
   * Snapshot of the previously applied normalized attributes.
   * Used by DOM diffing to remove stale attributes and minimize DOM mutations.
   */
  protected prevAttrs?: NormalizedAttrs<E>;

  /**
   * Cleanup callback returned by the attach() lifecycle method.
   * Unbinds DOM event listeners and tears down side effects when the element unmounts.
   */
  protected detach?: DetachFn;

  /**
   * Controller configuration options.
   */
  protected options: O;

  /**
   * Creates an Aria controller instance with an initial reactive state or external props.
   *
   * @param props - Initial state overrides or reactive props
   * @param options - Configuration options or native HTML tag name
   */
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    this.options = { ...options };
    this.scope = ariaScope.get() as Aria<BaseElement, object, AriaAttributes<BaseElement>> | undefined;
    ariaScope.set(this as unknown as Aria<BaseElement, object, AriaAttributes<BaseElement>>);

    this.properties = (anchor.has(props) || props.$omit ? props : mutable(props)) as T;
    this.events.add('focus', () => {
      currentAria.set(this as unknown as Aria);
    });
    this.events.add('blur', () => {
      const current = currentAria.get();
      if (current && current !== this) return;
      currentAria.set(undefined);
    });

    this.observer = createObserver(() => {
      this.update();
    });

    onCleanup(() => {
      this.destroy();
    });

    if (options.clickable) {
      this.protectClickable();
    }

    if (options.trackPointer) {
      this.trackPointer();
    }
  }

  /**
   * Batch updates the reactive state with a single atomic mutation notification.
   *
   * @param props - Partial props dictionary to merge into the reactive props
   */
  public assign(props: Partial<T>): void {
    anchor.assign(this.properties, props);
  }

  /**
   * Merges custom user-defined attributes, CSS classes, or dynamic overrides into the attribute dictionary.
   *
   * @param refiner - Callback receiving the reactive state and returning attribute overrides
   * @returns An unregister teardown callback to remove the refiner and purge stale attributes
   */
  public refine(refiner: RefineFn<T, A>): (destroyed?: boolean) => void {
    this.refiners.add(refiner);
    this.update(false, refiner);

    return (destroyed?: boolean) => {
      this.refiners.delete(refiner);
      const handlers = this.refinerEvents.get(refiner);
      if (handlers) {
        for (const [key, handler] of handlers.entries()) {
          this.events.remove(key, handler);
        }
        this.refinerEvents.delete(refiner);
      }
      if (destroyed) return;
      this.update();
    };
  }

  /**
   * Registers an event listener on the controller's host element.
   *
   * Coordinates listeners through the controller's {@link events} manager, automatically
   * maintaining attachment across DOM element transitions and lifecycle changes.
   *
   * @param type - DOM event type or custom event name (e.g. 'click', 'keydown')
   * @param handler - Event listener callback invoked when the event fires
   * @returns A teardown function to unregister the event listener
   */
  public on<K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void): () => void;
  public on<EV extends Event = Event>(type: string, handler: (event: EV) => void): () => void;
  public on(type: string, handler: GenericHandler): () => void {
    return this.events.add(type, handler);
  }

  /**
   * Tears down the controller, executing cleanup functions, destroying observers, and unbinding DOM references.
   */
  public destroy(): void {
    this.detach?.();
    if (this.scope?.actionable === (this as never)) {
      this.scope.actionable = undefined;
    }
    this.events.destroy();
    this.ownEvents.clear();
    this.refinerEvents.clear();
    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.refiners.clear();
    this.cleanups.clear();
    this.observer.destroy();
    this.element = null;
  }

  /**
   * Create a copy of the props excluding the controller-managed attributes.
   */
  public restProps(omit?: (keyof T)[]): T {
    const omitted = new Set([...this.ownKeys, ...(omit ?? [])]);

    /* istanbul ignore if */
    if (typeof this.properties.$omit === 'function') {
      return { ...this.properties.$omit(Array.from(omitted)), ...this.attributes };
    }

    const props = {} as T;

    // Read only the values kept, so a template spreading these never reads the omitted ones.
    for (const key of Object.keys(this.properties)) {
      if (!omitted.has(key)) {
        props[key as keyof T] = this.properties[key as keyof T];
      }
    }

    return { ...props, ...this.attributes };
  }

  /**
   * Optional callback to capture and process change from a child component.
   *
   * @param target - The child component element
   * @param value - The value to capture
   */
  public captureChange?(target: BaseElement, value?: unknown): void;

  /**
   * Protects the element from interaction when disabled.
   */
  protected protectClickable() {
    const keys = Array.isArray(this.options.clickable) ? this.options.clickable : DEFAULT_ALLOW_KEYS;
    const self = this as AnyType;

    this.on('click', (e) => {
      if (self.disabled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    this.on('keydown', (e) => {
      if (keys.includes(e.key) && self.disabled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    this.on('keyup', (e) => {
      if (keys.includes(e.key) && self.disabled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // A tracked element already writes on pointerdown, and keeps its position after release.
    if (this.options.trackPointer) return;

    this.on('pointerdown', (e) => {
      if (self.disabled) {
        return;
      }
      this.writePointer(e);
    });

    // The press keeps its position past release, so its effect fades where it landed; a key press has no position.
    this.on('keydown', (e) => {
      if (!keys.includes(e.key)) {
        return;
      }
      for (const name of POINTER_VARS) {
        (self.element as HTMLElement | undefined)?.style.removeProperty(name);
      }
    });
  }

  /** The pointer event waiting for the next frame to be written, if any. */
  private pendingPointer?: PointerEvent;
  private pointerFrame = 0;
  /** The element's box as last measured, reused while the pointer hovers it without pressing. */
  private pointerBox?: DOMRect;
  /** Where the pointer was last written on the element, so a move too small to see writes nothing. */
  private pointerX = Number.NaN;
  private pointerY = Number.NaN;

  /**
   * Follows the pointer over the element: moves are written at most once a
   * frame, and a press is written at once — touch has no hover, and the
   * press must land exactly where it happened. The element's box is measured
   * again whenever it may have moved or changed size since: as the pointer
   * comes in or leaves, and as a press ends.
   */
  protected trackPointer() {
    const forget = () => {
      this.pointerBox = undefined;
    };
    this.on('pointerenter', forget);
    this.on('pointerleave', forget);
    this.on('pointerup', forget);

    this.on('pointermove', (e) => {
      this.pendingPointer = e;
      if (this.pointerFrame) return;
      this.pointerFrame = requestAnimationFrame(() => {
        this.pointerFrame = 0;
        if (this.pendingPointer) this.writePointer(this.pendingPointer);
      });
    });

    this.on('pointerdown', (e) => this.writePointer(e));
  }

  /**
   * Writes where a pointer event sits on the element as CSS variables, and
   * drops any move still waiting for its frame.
   *
   * @param event - The pointer event to place.
   */
  protected writePointer(event: PointerEvent) {
    const element = this.element as unknown as HTMLElement | undefined;
    this.pendingPointer = undefined;
    if (this.pointerFrame) {
      cancelAnimationFrame(this.pointerFrame);
      this.pointerFrame = 0;
    }
    if (!element?.style) return;

    // Hovering, the box is measured once and reused: measuring it every frame makes the browser
    // lay the page out again each time. With a button held, the element may be moving with the
    // pointer — a window dragged by it — so it's measured afresh.
    const rect = event.buttons || !this.pointerBox ? (this.pointerBox = element.getBoundingClientRect()) : this.pointerBox;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Math.abs(x - this.pointerX) < 1 && Math.abs(y - this.pointerY) < 1) return;
    this.pointerX = x;
    this.pointerY = y;
    const angle = (Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180) / Math.PI;

    element.style.setProperty('--pointer-x', `${x}px`);
    element.style.setProperty('--pointer-y', `${y}px`);
    element.style.setProperty('--pointer-fx', String(rect.width ? x / rect.width : 0));
    element.style.setProperty('--pointer-fy', String(rect.height ? y / rect.height : 0));
    element.style.setProperty('--pointer-angle', `${(angle + 360) % 360}deg`);
  }

  /**
   * Indicates whether the space key is currently armed.
   */
  protected spaceArmed = false;

  /**
   * Handles keydown events for space and enter keys.
   *
   * @param event - The keyboard event
   */
  protected handleKeyClickDown = (event: KeyboardEvent) => {
    const self = this as AnyType;
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;
    if (self.disabled || event.defaultPrevented || !allowKeys.includes(event.key)) return;

    if (event.key === ' ') {
      event.preventDefault();
      this.spaceArmed = true;
    } else if (!this.options.deferredKey && event.key === 'Enter') {
      this.dispatchClick();
    }
  };

  /**
   * Handles keyup events for space and enter keys.
   *
   * @param event - The keyboard event
   */
  protected handleKeyClickUp = (event: KeyboardEvent) => {
    const self = this as AnyType;
    const allowKeys = this.options.allowKeys ?? DEFAULT_ALLOW_KEYS;
    const armed = this.spaceArmed;
    this.spaceArmed = false;
    if (self.disabled || event.defaultPrevented || !allowKeys.includes(event.key)) return;

    if (event.key === ' ' && armed) {
      this.dispatchClick();
    } else if (this.options.deferredKey && event.key === 'Enter') {
      this.dispatchClick();
    }
  };

  /**
   * Requests the capture of options from the current role or its parent scope.
   */
  protected dispatchChange(value?: unknown) {
    let role = this as unknown as Aria;

    while (role) {
      role = role.scope as unknown as Aria;
      if (typeof role?.captureChange === 'function') {
        role.captureChange(this.element!, value);
        return;
      }
    }
  }

  /**
   * Dispatches a click event on the element based on whether it is a native or custom element.
   */
  protected dispatchClick() {
    const element = this.element as unknown as HTMLElement;
    const event = new PointerEvent('click', {
      bubbles: true,
      pointerId: -1,
      cancelable: true,
    });
    element.dispatchEvent?.(event);
  }

  /**
   * Captures the `input`, `change`, and `command` events and forwards each as-is to the
   * `oninput`, `onchange`, and `oncommand` callback. A command bubbles through every scope,
   * so the part a menu acts on hears it, and so does anything around that part.
   * @param event - The AriaEvent to capture
   */
  protected capture(event: AriaEvent): void {
    /* istanbul ignore if */
    if (!this.observer.active) return;
    if (event.type === 'input') {
      this.properties.oninput?.(event as AriaEvent<string>);
    }
    if (event.type === 'change') {
      this.properties.onchange?.(event as never);
    }
    if (event.type === 'command') {
      (this.properties as AriaProps).oncommand?.(event as CustomEvent<string>);
    }
  }

  /**
   * Dispatches an AriaEvent to the bound DOM element.
   *
   * @param event - The AriaEvent to dispatch
   */
  protected dispatch(event: AriaEvent) {
    if (!this.observer.active) return;
    this.capture?.(event);
    /* istanbul ignore next */
    if (event.bubbles) this.scope?.dispatch(event);
  }

  /**
   * Attribute keys managed exclusively by the controller that cannot be overridden by refiners.
   */
  protected omittedAttrs: string[] = [];

  /**
   * Computes the initial default ARIA and HTML attributes for this role.
   *
   * @returns The default attribute dictionary
   */
  protected createAttributes(): A {
    return {} as A;
  }

  /**
   * Binds DOM event listeners and accessibility behaviors when the element mounts.
   *
   * @returns An optional detachment callback to execute on unmount
   */
  protected attach(): DetachFn | void {}

  /**
   * Synchronizes a group of event handlers (from own attributes or a refiner) with the controller's EventMap.
   *
   * @param registry - Storage map tracking the active handlers for this group.
   * @param source - Raw attribute dictionary containing potential on* handler properties.
   */
  protected syncEvents(registry: Map<string, GenericHandler>, source: Record<string, unknown>): void {
    const next = new Map<string, GenericHandler>();

    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith('on') && typeof value === 'function') {
        next.set(key, value as GenericHandler);
      }
    }

    for (const [key, handler] of registry.entries()) {
      const nextHandler = next.get(key);
      if (nextHandler !== handler) {
        this.events.remove(key, handler);
      }
    }

    for (const [key, handler] of next.entries()) {
      const prevHandler = registry.get(key);
      if (prevHandler !== handler) {
        this.events.add(key, handler);
      }
    }

    registry.clear();
    for (const [key, handler] of next.entries()) {
      registry.set(key, handler);
    }
  }

  /**
   * Recomputes attributes inside the reactive observer and schedules DOM synchronization.
   *
   * @param reinit - Whether to reinitialize attributes from createAttributes
   * @param refine - Optional specific refiner to run instead of iterating all refiners
   */
  protected update(reinit = true, refine?: RefineFn<T, A>): void {
    this.observer.run(() => {
      if (reinit) {
        const ownAttrs = this.createAttributes() as Record<string, unknown>;
        this.syncEvents(this.ownEvents, ownAttrs);
        this.attrs = normalizeAttrs(ownAttrs);
      }

      if (refine) {
        const overrides = refine(this.properties, this.attrs as unknown as A) as Record<string, unknown> | undefined;
        if (overrides) {
          let refinerMap = this.refinerEvents.get(refine);
          /* istanbul ignore if */
          if (!refinerMap) {
            refinerMap = new Map();
            this.refinerEvents.set(refine, refinerMap);
          }
          this.syncEvents(refinerMap, overrides);
          normalizeAttrs(overrides, this.attrs, this.omittedAttrs);
        }
      } else {
        for (const r of this.refiners) {
          const overrides = r(this.properties, this.attrs as unknown as A) as Record<string, unknown> | undefined;
          /* istanbul ignore next */
          if (overrides) {
            let refinerMap = this.refinerEvents.get(r);
            if (!refinerMap) {
              refinerMap = new Map();
              this.refinerEvents.set(r, refinerMap);
            }
            this.syncEvents(refinerMap, overrides);
            normalizeAttrs(overrides, this.attrs, this.omittedAttrs);
          }
        }
      }
    });

    const publicAttrs: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(this.attrs)) {
      if (!key.startsWith('on')) {
        publicAttrs[key] = val;
      }
    }

    this.translated = Aria.translator(publicAttrs as Record<string, AnyType>);
    this.applyAttributes();
  }

  /**
   * Synchronizes compiled attributes directly to the attached DOM element via attribute diffing.
   */
  protected applyAttributes(): void {
    if (this.element) {
      applyAttributes(this.element, this.attrs, this.prevAttrs);
      this.prevAttrs = { ...this.attrs };
    }
  }

  /**
   * Registers this controller as an actionable interactive candidate on itself and its parent scope.
   */
  public markActionable(): void {
    this.isActionable = true;
    this.actionable = this as unknown as Aria<BaseElement, AriaProps, AriaAttributes<BaseElement>>;

    if (this.scope) {
      this.scope.actionable = this as unknown as Aria<BaseElement, AriaProps, AriaAttributes<BaseElement>>;
    }
  }

  /**
   * Active global attribute translator function.
   * Transforms raw attributes into framework-specific conventions (e.g. React camelCase props).
   */
  static translator: TranslateFn = (input) => {
    return input;
  };

  /**
   * Registers a global attribute translation function to adapt attributes across frameworks.
   *
   * @param translator - The attribute translation callback
   */
  public static translate(translator: TranslateFn): void {
    Aria.translator = translator;
  }
}

const DEFAULT_ALLOW_KEYS = [' ', 'Enter'];
const POINTER_VARS = ['--pointer-x', '--pointer-y', '--pointer-fx', '--pointer-fy', '--pointer-angle'];
