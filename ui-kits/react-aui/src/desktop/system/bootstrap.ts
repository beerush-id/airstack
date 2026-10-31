import { mutable } from '@airlib/react';
import { system } from './system.js';
import type { AUISystemSeed, AUISystemState } from './types.js';

let booted = false;
let devMode = false;

/**
 * Starts the system with what it begins with — its settings, its installed apps — each given key
 * merged one level over the system's own, so what's given wins and the rest stays. What a key holds
 * turns reactive, so an app installed later shows in the launcher as it's added. Only the first call counts, and only it
 * gets the system back — the kernel's one bridge to the UI — so nothing that runs later can reseed
 * or reach a running system. When the first seed turns on `devMode`, later calls reseed and get
 * the system too, as reloaded code needs.
 *
 * @param seed - Top-level keys to start with, e.g. `{ system: { apps: [] } }`.
 * @returns The system; undefined, having done nothing, on a later call outside dev mode.
 */
export function bootstrap(seed: AUISystemSeed): AUISystemState | undefined {
  if (booted && !devMode) return undefined;
  if (!booted) devMode = seed.devMode === true;
  booted = true;

  const { devMode: _, ...keys } = seed;
  const state = system as Record<string, unknown>;
  for (const [key, value] of Object.entries(keys)) {
    const merged = isObject(value) ? { ...(state[key] as object), ...value } : value;
    state[key] = key === 'system' ? seedSystem(merged as AUISystemState['system']) : reactive(merged);
  }
  return system;
}

/**
 * Makes the `system` key: each object in it reactive, as any key is, but only which apps there are
 * for `apps`. What an app entry holds is its own, functions and React elements among it, and an
 * element can't be read through a proxy. Shallow itself, so nothing wraps the list again.
 *
 * @param seed - What the key starts with.
 * @returns The key's state.
 */
function seedSystem(seed: AUISystemState['system']): AUISystemState['system'] {
  const { apps, ...rest } = seed;
  const keys = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, reactive(value)]));
  return mutable({ ...keys, ...(apps && { apps: mutable(apps, { recursive: false }) }) }, { recursive: false });
}

/**
 * A seeded value as the system keeps it.
 *
 * @param value - The value.
 * @returns An object made reactive; anything else as it is.
 */
function reactive(value: unknown): unknown {
  return isObject(value) ? mutable(value) : value;
}

/**
 * Whether a seeded value is an object.
 *
 * @param value - The value.
 * @returns True for anything with keys of its own.
 */
function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}
