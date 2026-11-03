import {
  $symbol,
  anchor,
  captureStack,
  createStack,
  getContextStore,
  getScope,
  onGlobalCleanup,
  type RefStack,
  setCleanUpHandler,
  setScope,
  STACK_SYMBOL,
  untrack,
} from '@airlib/core';
import { RenderContext } from './context.js';
import { PROPS_SYMBOL, proxyProps } from './props.js';
import type { CleanupHandler, Lifecycle, MountHandler } from './types.js';

const MOUNT_HANDLER_SYMBOL = $symbol('mount-handler');
const CLEANUP_HANDLER_SYMBOL = $symbol('mount-cleanup');

/**
 * Creates a new lifecycle manager for handling component mount, cleanup, and rendering operations.
 *
 * The lifecycle manager provides three core methods:
 * - `mount()`: Schedules and executes mount handlers and effects
 * - `cleanup()`: Schedules and executes cleanup handlers and clears all handlers
 * - `render()`: Executes a render function within the component's context
 *
 * This function manages:
 * - Mount handlers registered via `onMount()`
 * - Cleanup handlers registered via `onCleanup()`
 * - Effects registered via `effect()`
 *
 * It also handles the proper execution order and cleanup of effects with their cleanup functions.
 *
 * @returns A Lifecycle object with mount, cleanup, and render methods
 */
export function createLifecycle(setupProps: Record<string, unknown>, name?: string): Lifecycle {
  const mountHandlers = new Set<MountHandler>();
  const cleanupHandlers = new Set<CleanupHandler>();

  const context = new RenderContext(name ?? 'Anonymous', getContextStore());
  const propsRef = anchor({ ...setupProps }, { recursive: false, trapOwnKeys: false });

  const stack = createStack();
  const props = proxyProps(propsRef);

  return {
    stack,
    props,
    propsRef: propsRef,
    context,
    mount() {
      mountHandlers.forEach((mount) => {
        try {
          const cleanup = mount();
          if (typeof cleanup === 'function') {
            cleanupHandlers.add(cleanup);
          }
        } catch (error) {
          captureStack.error.external('An error occurred while executing a mount handler.', error as Error);
        }
      });
    },
    cleanup() {
      cleanupHandlers.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          captureStack.error.external('An error occurred while executing a cleanup handler.', error as Error);
        }
      });

      mountHandlers.clear();
      cleanupHandlers.clear();
    },
    render<R>(fn: () => R) {
      const prevMountHandlers = getScope<Set<MountHandler>>(MOUNT_HANDLER_SYMBOL),
        prevCleanupHandlers = getScope<Set<CleanupHandler>>(CLEANUP_HANDLER_SYMBOL),
        prevStack = getScope<RefStack>(STACK_SYMBOL),
        prevProps = getScope<Record<string, unknown>>(PROPS_SYMBOL);

      setScope(STACK_SYMBOL, stack);
      setScope(PROPS_SYMBOL, props);
      setScope(MOUNT_HANDLER_SYMBOL, mountHandlers);
      setScope(CLEANUP_HANDLER_SYMBOL, cleanupHandlers);

      try {
        return untrack(fn) as R;
      } finally {
        setScope(STACK_SYMBOL, prevStack);
        setScope(PROPS_SYMBOL, prevProps);
        setScope(MOUNT_HANDLER_SYMBOL, prevMountHandlers);
        setScope(CLEANUP_HANDLER_SYMBOL, prevCleanupHandlers);
      }
    },
  };
}

/**
 * Registers a mount handler function that will be executed when the component is mounted.
 *
 * Mount handlers are executed when the component is being set up and can optionally
 * return a cleanup function that will be called when the component is unmounted.
 *
 * @param fn - The mount handler function to register
 *
 * @throws {Error} If called outside a Setup component context
 */
export function onMount(fn: MountHandler) {
  const currentMountHandlers = getScope<Set<MountHandler>>(MOUNT_HANDLER_SYMBOL);

  if (!currentMountHandlers) {
    const error = new Error('Out of Setup component.');
    captureStack.violation.general(
      'Mount handler declaration violation detected:',
      'Attempted to use mount handler outside of Setup component.',
      error,
      undefined,
      onMount
    );
  }

  currentMountHandlers?.add(fn);
}

/**
 * Registers a cleanup handler function that will be executed when the component is cleaned up.
 *
 * Cleanup handlers are executed when the component is being torn down, typically to
 * clean up resources like event listeners, timers, or subscriptions.
 *
 * @param fn - The cleanup handler function to register
 *
 * @throws {Error} If called outside a Setup component context
 */
export function onCleanup(fn: CleanupHandler) {
  const currentCleanupHandlers = getScope<Set<CleanupHandler>>(CLEANUP_HANDLER_SYMBOL);

  if (currentCleanupHandlers) {
    currentCleanupHandlers?.add(fn);
  } else {
    return onGlobalCleanup(fn);
  }
}

// Hook up cleanup handler to the Anchor's core lifecycle.
setCleanUpHandler(onCleanup);
