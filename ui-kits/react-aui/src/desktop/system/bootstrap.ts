import { mutable } from '@airlib/react';
import { system } from './system.js';
import type { AUISystemSeed, AUISystemState } from './types.js';

let booted = false;
let devMode = false;

/**
 * Starts the system with what it begins with — its settings, its installed apps — each given key
 * replacing the system's own, without merging inside it. What a key holds turns reactive, so an
 * app installed later shows in the launcher as it's added. Only the first call counts, and only it
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
  for (const [key, value] of Object.entries(keys)) {
    (system as Record<string, unknown>)[key] = value !== null && typeof value === 'object' ? mutable(value) : value;
  }
  return system;
}
