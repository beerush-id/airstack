/*
 * The desktop's own record of every window: what's defined, what's open, and what's in front.
 * Internal to the desktop's parts — never re-exported — so an app reaches only its own windows.
 */
import { createContext, mutable } from '@airlib/react';
import type { WindowApp, WindowHostScope, WindowInstance } from './registry.js';

/**
 * Every open window, across all definitions, by id, oldest first. Only
 * opening and closing change it; each window owns its own live state, so
 * nothing here reacts to a window moving.
 */
export const openWindows: Map<string, WindowInstance> = mutable(new Map<string, WindowInstance>(), {
  recursive: false,
});

/**
 * Every defined window app, in definition order — what launchers list.
 */
export const windowApps: WindowApp[] = [];

/** Managed window ids back to front, mirroring the desktop stack through each window's raise event. */
export const stackOrder: string[] = mutable<string[]>([]);

/** The open window a `<Window>` draws, set by the host around each copy's render. */
export const windowInstanceCtx = createContext<WindowInstance>();

/** The host a `<Window>` was drawn by, for the settings it lends. */
export const windowHostCtx = createContext<WindowHostScope>();

/**
 * The open window with an id.
 *
 * @param id - The window's id.
 * @returns The window, or undefined once it has closed.
 */
export function findWindow(id: string): WindowInstance | undefined {
  return openWindows.get(id);
}

/**
 * Whether a host limited to `apps` renders this window; matched by name,
 * since stored copies are wrapped.
 *
 * @param apps - The apps a host or launcher is limited to, if any.
 * @param instance - The window to check.
 * @returns True when the window belongs to one of the apps, or no limit is set.
 */
export function hostsWindow(apps: WindowApp[] | undefined, instance: WindowInstance): boolean {
  return !apps || apps.some((app) => app.name === instance.app.name);
}
