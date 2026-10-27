/*
 * Where every app context is made: what the system hands an app's boot. Internal to the desktop's
 * parts, so only the system makes one.
 */
import type { WindowApp } from '../window/registry.js';
import type { AUIAppContext, AUIAppEntry, AUIOpenOptions, AUITools, AUIWindow } from './types.js';

/**
 * Launches an installed app: boots its entry with the system's side of it. Internal like the
 * context itself: apps and pages launch by name, through the system's `launch`.
 *
 * @param entry - The installed app.
 * @returns What its boot returns: the handle to end it with, now or once booted.
 */
export function launchApp(entry: AUIAppEntry): ReturnType<AUIAppEntry['main']> {
  return entry.main(createAppCtx());
}

/**
 * Makes the system's side of an app — the context its boot receives. The one place a context is
 * made, so everything an app can ask the system for is granted here.
 *
 * @returns The context to boot an app with.
 */
export function createAppCtx(): AUIAppContext {
  return {
    open<D, T extends AUITools>(view: WindowApp<D>, options?: AUIOpenOptions<D, T>): AUIWindow<D, T> {
      return view.open(options?.data, options) as AUIWindow<D, T>;
    },
  };
}
