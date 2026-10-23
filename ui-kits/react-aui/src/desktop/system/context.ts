/*
 * Where every app context is made: what the system hands an app's boot. Internal to the desktop's
 * parts, so only the system makes one.
 */
import type { WindowApp } from '../window/registry.js';
import type { AUIAppContext, AUIOpenOptions, AUITools, AUIWindow } from './types.js';

/**
 * Makes the system's side of an app — the context its boot receives. The one place a context is
 * made, so everything an app can ask the system for is granted here.
 *
 * @returns The context to boot an app with.
 */
export function createAppCtx(): AUIAppContext {
  return {
    open<D, T extends AUITools>(view: WindowApp<D>, options?: AUIOpenOptions<D, T>): AUIWindow<D, T> {
      return view.open(options?.data, options?.tools) as AUIWindow<D, T>;
    },
  };
}
