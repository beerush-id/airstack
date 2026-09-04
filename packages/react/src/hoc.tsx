import {
  $do,
  $symbol,
  type AnyType,
  anchor,
  captureStack,
  createObserver,
  getContextStore,
  isBrowser,
  isFunction,
  microtask,
  setContextStore,
  setStaticTracker,
} from '@airlib/core';
import { type FC, Fragment, type FunctionComponent, type ReactElement, type ReactNode } from 'react';
import type { RenderContext } from './context.js';
import { createEffect, createState, memoize } from './hooks.js';
import { createLifecycle } from './lifecycle.js';
import { getProps, proxyProps } from './props.js';
import type {
  Component,
  ComponentProps,
  ComponentSlots,
  ComponentWithSnippet,
  GenericProps,
  SlottedComponent,
  SnippetNode,
  SnippetView,
  StableComponent,
  Template,
  TemplateView,
  View,
} from './types.js';

const RENDERER_INIT_VERSION = 1;
const CLEANUP_DEBOUNCE_TIME = 0;
const COMPONENT_SNIPPET_KEY = $symbol('component-snippet');

/**
 * Higher-Order Component that creates a stable setup component following the modern component lifecycle.
 *
 * @param {ComponentWithSnippet<P, S>} Component - The component to wrap with stable lifecycle management
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @param controlled - List of controlled keys to not trigger violation warnings.
 * @returns {SlottedComponent<P, S>} A memoized component that only re-renders when props change
 */
export function setup<P, S extends ComponentSlots>(
  Component: ComponentWithSnippet<P, S>,
  displayName?: string,
  controlled?: string[]
): SlottedComponent<P, S>;

/**
 * Higher-Order Component that creates a stable setup component following the modern component lifecycle.
 *
 * @param {Component<P>} Component - The component to wrap with stable lifecycle management
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @param controlled - List of controlled keys to not trigger violation warnings.
 * @returns {StableComponent<P>} A memoized component that only re-renders when props change
 */
export function setup<P>(Component: Component<P>, displayName?: string, controlled?: string[]): StableComponent<P>;

/**
 * Higher-Order Component that creates a stable setup component following the modern component lifecycle.
 *
 * The `setup` HOC implements a modern rendering approach where components render once and maintain
 * stable behavior. It ensures that:
 * - The component only re-renders when its props actually change
 * - Lifecycle events (mount/unmount) are properly managed
 * - Setup and cleanup operations are handled automatically
 *
 * This HOC aligns with the modern component lifecycle philosophy where components render once
 * and updates are controlled through explicit prop changes rather than internal state.
 *
 * @template C - The component type being wrapped
 * @param {C} Component - The function component to wrap with stable lifecycle management
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @param controlled - List of controlled keys to not trigger violation warnings.
 * @returns {C} A memoized component that only re-renders when props change
 */
export function setup<P, S extends ComponentSlots>(
  Component: Component<P> | ComponentWithSnippet<P, S>,
  displayName?: string,
  controlled?: string[]
): StableComponent<P> {
  if (typeof Component !== 'function') {
    const error = new Error('Component must be a function.');
    captureStack.violation.general(
      'Setup factory violation detected:',
      'Attempted to use setup() HOC on a non-functional component.',
      error,
      undefined,
      setup
    );

    const Factory = () => error.message;
    Factory.displayName = `Error(${displayName || 'Anonymous'})`;
    return Factory as unknown as StableComponent<P>;
  }

  if (displayName && !(Component as FunctionComponent).displayName) {
    (Component as FunctionComponent).displayName = displayName;
  }

  const componentName = displayName || (Component as FunctionComponent).displayName || Component.name || 'Anonymous';

  const view = Component as (props: unknown, snippets: ComponentSlots) => ReactNode | (() => ReactNode);
  const propsMap = new WeakMap();

  const Finish: FC<{ context: RenderContext }> = ({ context }) => {
    setContextStore(context);
    return null;
  };
  Finish.displayName = `Return(${componentName})`;

  const Factory = (currentProps: Record<string, unknown>) => {
    const [scheduleMount, cancelMount] = microtask(CLEANUP_DEBOUNCE_TIME);
    const [scheduleCleanup, cancelCleanup] = microtask(CLEANUP_DEBOUNCE_TIME);

    const lifecycle = createLifecycle(currentProps, componentName);
    const { props, stack, propsRef } = lifecycle;

    propsMap.set(currentProps, propsRef);

    createEffect(() => {
      cancelMount();
      cancelCleanup();

      scheduleMount(() => {
        lifecycle.mount();
      });

      return () => {
        scheduleCleanup(() => {
          // @important Actual cleanup should be scheduled to prevent cleaning up the current effects in strict-mode.
          propsMap.delete(currentProps);
          lifecycle.cleanup();
          stack.states.clear();
        });
      };
    }, []);

    stack.index = 0;

    /**
     * Cleanup the previous effect handlers to make sure each render is isolated.
     * This also necessary to cover HMR (Fast Refresh) where re-render is expected.
     */
    lifecycle.cleanup();

    const children = () => {
      try {
        return lifecycle.render(() => {
          const child = props.children;

          const restore = setStaticTracker((_state, key) => {
            if (typeof key === 'symbol' || controlled?.includes(String(key))) return;

            const error = new Error(`[${componentName}] Frozen read on "${String(key)}".`);
            captureStack.violation.general(
              'Frozen reactive read detected:',
              `Attempted to read "${String(key)}" inside <${componentName}> setup() without a reactive boundary.`,
              error,
              [
                `Component setup executes once upon initialization; reads here will not trigger re-renders.`,
                '- Return an accessor function: `return () => <JSX />` instead of static JSX.',
                '- Or isolate dynamic reads inside a `<Snippet>` / reactive boundary.',
                '- If static is expected, wrap with `$static(() => ...)` to silence this warning.',
              ]
            );
          });

          try {
            const result = view(props, findSlots(child as ReactElement[]));
            return typeof result === 'function' ? render(result, componentName) : result;
          } finally {
            restore();
          }
        });
      } catch (error) {
        const newErr = new Error(`[${componentName}] failed to render.`);
        captureStack.error.external(
          `Render error: uncaught render exception in ${componentName}.`,
          error as Error,
          snippet
        );
        console.error(error);
        return newErr.message;
      }
    };

    setContextStore(lifecycle.context);

    return (
      <>
        {children()}
        <Finish context={lifecycle.context.parent!} />
      </>
    );
  };

  Factory.displayName = `Constructor(${componentName})`;

  const Setup = memoize(Factory, (prevProps, nextProps) => {
    const prevPropsRef = propsMap.get(prevProps);

    /* istanbul ignore else */
    if (prevPropsRef) {
      anchor.assign(prevPropsRef, nextProps);
    }

    return true;
  });

  const SetupSlot = () => null;
  SetupSlot.displayName = `Snippet(${componentName})`;

  Object.assign(SetupSlot, { [COMPONENT_SNIPPET_KEY]: true });
  Object.assign(Setup, { Snippet: SetupSlot });

  Setup.displayName = `Component(${componentName})`;
  return Setup as StableComponent<P>;
}

function findSlots(nodes: ReactElement[] | ReactElement) {
  if (!nodes) return {} as ComponentSlots;
  if (!Array.isArray(nodes)) nodes = [nodes];
  if (nodes[0]?.type === Fragment) return findSlots((nodes[0] as AnyType).props.children);

  const slots = {} as ComponentSlots;
  for (const node of nodes.filter(Boolean)) {
    const props = node.props as AnyType;
    if (node.type?.[COMPONENT_SNIPPET_KEY as never] && props.for && isFunction(props.children)) {
      slots[props.for] = props.children;
    }
  }
  return slots;
}

let scheduleUpdate = queueMicrotask;

/**
 * Set the re-render scheduler.
 * The default scheduler is queueMicrotask() on browser and no-op function on server.
 *
 * @param scheduler - The function to handle the scheduling.
 */
export function setUpdateScheduler(scheduler: (fn: () => unknown) => void) {
  scheduleUpdate = scheduler;
}

/**
 * Stub the re-render scheduler for the test environment.
 * @returns Function to un-stub the scheduler.
 */
export function stubScheduler() {
  const current = scheduleUpdate;
  setUpdateScheduler((fn) => fn());

  /* istanbul ignore start */
  return () => {
    setUpdateScheduler(current);
  };
  /* istanbul ignore end */
}

/**
 * Creates a reactive snippet that has access to parent component's props and context.
 *
 * The `snippet` HOC creates a reactive view that can be used within a setup component.
 * It has access to the parent component's props through closure, making it ideal for
 * creating smaller reactive pieces within a larger component.
 *
 * Key characteristics:
 * - Scoped to the parent component's context
 * - Has access to parent component's props
 * - Reactive to state changes within its scope
 * - Automatically manages its own lifecycle and cleanup
 *
 * @template P - The props type for the snippet
 * @template SP - The setup props type extending GenericProps
 * @param {SnippetNode<P, SP>} factory - A function that receives props and parent props, returning React nodes
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @param needSetup - Whether to force a strict scope for the snippet (internal use).
 * @param scopeName - The scope name for the snippet (internal use).
 * @param inherited - Whether the snippet is inheriting parent props.
 * @param optimized - Whether the snippet is already in optimized boundary.
 * @returns {SnippetView<P>} A memoized functional component that re-executes when dependencies change
 */
export function snippet<P, SP extends GenericProps = GenericProps>(
  factory: SnippetNode<P, SP>,
  displayName?: string,
  scopeName = 'Snippet',
  needSetup = true,
  inherited = false,
  optimized = false
): SnippetView<P> {
  if (typeof factory !== 'function') {
    const error = new Error('Renderer must be a function.');
    captureStack.violation.general(
      `${scopeName} factory violation detected:`,
      `Attempted to use ${scopeName} on a non-functional component.`,
      error,
      undefined,
      snippet
    );

    const Snippet = () => error.message;
    Snippet.displayName = `Error(${displayName || 'Anonymous'})`;
    return Snippet;
  }

  const viewName = displayName || (factory as FunctionComponent).name || 'Anonymous';
  let parentProps: ComponentProps<SP>;

  if (needSetup) {
    parentProps = getProps<SP>();

    if (!parentProps) {
      const error = new Error('Out of component scope.');
      captureStack.violation.general(
        `${scopeName} violation detected:`,
        `Attempted to use ${scopeName} outside of a component.`,
        error,
        [
          `${scopeName} must be declared inside a component (setup)`,
          '- Use template if the view is meant to be reusable across application',
        ],
        snippet
      );
    }
  }

  const snippetName = `${scopeName}(${viewName})`;

  const Finish: FC<{ context: RenderContext }> = ({ context }) => {
    setContextStore(context);
    return null;
  };
  Finish.displayName = `Return(${viewName})`;

  function SnippetBody(props: P) {
    const [, setVersion] = createState(RENDERER_INIT_VERSION);
    const [{ context, observer, scheduleCleanup, cancelCleanup }] = createState(() => {
      const [scheduleCleanup, cancelCleanup] = microtask(CLEANUP_DEBOUNCE_TIME);
      const observer = createObserver(function snippetRenderer() {
        // observer.reset();

        if (!isBrowser()) return;

        scheduleUpdate(() => {
          if (!observer.active) return;
          setVersion((c) => c + 1);
        });
      });

      observer.name = snippetName;
      return { context: getContextStore(), observer, cancelCleanup, scheduleCleanup };
    });

    createEffect(() => {
      cancelCleanup();

      return () => {
        scheduleCleanup(() => {
          observer.destroy();
        });
      };
    }, []);

    const children = () =>
      observer.run(() => {
        try {
          if (inherited) return factory(parentProps as never, parentProps);
          return factory($do(() => proxyProps({ ...props }, false)) as P, parentProps);
        } catch (error) {
          const newErr = new Error(`[${snippetName}] failed to render.`);
          captureStack.error.external(
            `Render error: uncaught render exception in ${snippetName}.`,
            error as Error,
            snippet
          );
          return newErr.message;
        }
      });

    const prevContext = getContextStore();
    setContextStore(context);

    return (
      <>
        {children()}
        <Finish context={prevContext} />
      </>
    );
  }
  const Snippet = optimized ? SnippetBody : memoize(SnippetBody);
  (Snippet as SnippetView<P>).displayName = snippetName;

  return Snippet as SnippetView<P>;
}

export type SnippetProps<T> = {
  data?: T | (() => T);
  children: (data: T) => ReactNode;
};

export type SnippetType = <T>(props: SnippetProps<T>) => ReactNode;

/**
 * Isolate the rendering of a component fragment to get a fine-grained rendering control.
 * Particularly useful for rendering a reactive part of a mostly static UI.
 *
 * @param props.children - The content to render.
 * @returns The rendered content or null.
 */
export const Snippet = snippet<SnippetProps<unknown>>(
  ({ children, data }) => {
    if (typeof children !== 'function') {
      return <>[Snippet Error: Snippet must pass function as the children]</>;
    }
    return children(typeof data === 'function' ? data() : data);
  },
  'Snippet',
  'Slot',
  false
) as SnippetType;

/**
 * Create an inline reactive boundary to isolate re-render.
 * @param renderer - The renderer function to wrap.
 * @param provider - Optional function returning data to forward to the renderer for destructuring.
 * @returns JSX Element.
 */
export function $inline<T>(renderer: (data: T) => ReactNode, provider: () => T): ReactNode;
/**
 * Create an inline reactive boundary to isolate re-render.
 * @param renderer - The renderer function to wrap.
 * @param args - Optional arguments to forward to the renderer for destructuring.
 * @returns JSX Element.
 */
export function $inline<A extends AnyType[]>(renderer: (...args: A) => ReactNode, ...args: A): ReactNode;

export function $inline<A extends AnyType[]>(renderer: (...args: A) => ReactNode, ...args: A) {
  const [fn] = args;
  return <Snippet>{() => renderer(...(typeof fn === 'function' ? ([fn()] as A) : args))}</Snippet>;
}

/**
 * Creates a standalone reactive template component that relies only on its own props.
 *
 * The `template` HOC creates a reactive view that is independent of parent context.
 * It functions as a standalone reactive component that responds only to changes in
 * its own props, making it reusable across different parts of an application.
 *
 * Key characteristics:
 * - Standalone component with no dependency on parent context
 * - Relies purely on its own props for reactivity
 * - Can be used anywhere in the application like a regular component
 * - Maintains its own reactive lifecycle
 *
 * @template P - The props type for the template
 * @param {Template<P>} factory - A function that receives props and returns React nodes
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @returns {TemplateView<P>} A memoized functional component that re-executes when its props change
 */
export function template<P>(factory: Template<P>, displayName?: string): TemplateView<P> {
  return snippet(factory, displayName, 'Template', false) as TemplateView<P>;
}

/**
 * @deprecated Use `template` instead. This alias will be removed in a future version.
 */
export const view = template;

/**
 * Higher-Order Component that creates and immediately renders a reactive JSX.
 *
 * The `render` function combines the functionality of `snippet` with immediate execution,
 * creating a reactive renderer and returning its rendered output. This is useful when you
 * want to create and render a reactive component in a single step rather than defining
 * it separately and then using it in JSX.
 *
 * This function follows the same reactive principles as `snippet`, responding to state
 * changes and maintaining the modern component lifecycle approach.
 *
 * @param {SnippetNode<GenericProps>} View - A function that receives props and returns React nodes
 * @param {string} [displayName] - Optional display name for debugging purposes
 * @returns {ReactNode} The rendered output of the reactive component
 */
export function render<P>(View: View<P>, displayName?: string): ReactNode {
  const Snippet = snippet<Record<string, unknown>>(View as SnippetNode<unknown>, displayName, 'Render', true, true);
  return <Snippet />;
}
