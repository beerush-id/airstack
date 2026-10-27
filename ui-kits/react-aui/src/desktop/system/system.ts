/*
 * The system object: one per page, private to the desktop's own parts — the desktop, the dock, the
 * window host — and never re-exported, so apps and pages can't import it. Flat: each key is
 * reactive, and what's inside a key keeps its own reactivity.
 */
import { mutable } from '@airlib/react';
import { arrangeWindows, type WindowInstance } from '../window/registry.js';
import { openWindows, stackOrder } from '../window/store.js';
import { launchApp } from './context.js';
import type { AUISystemState } from './types.js';

export const system: AUISystemState = mutable<AUISystemState>(
  {
    system: {},
    window: { arrangeWindows },
    activeWindow: undefined,
    tools: {},
    get: (path: string) => readPath(system, path),
    launch: (name: string) => {
      const entry = system.system.apps?.find((app) => app.manifest.name === name);
      return entry ? launchApp(entry) : undefined;
    },
  },
  { recursive: false }
);

/** Names that reach an object's machinery rather than its data; a path through one reads nothing. */
const BLOCKED = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Reads the value at a path, never throwing: a missing step, a blocked name, or a getter that fails
 * all read as undefined. Steps reach an object's own keys and its class's accessors — never what
 * every object or function inherits — and a map's entries by key.
 *
 * @param root - Where the path starts.
 * @param path - Dot and bracket steps, e.g. `activeWindow.state.width` or `window["window-memo-1"]`.
 * @returns The value at the path, or undefined when the path doesn't reach one.
 */
function readPath(root: unknown, path: string): unknown {
  let current = root;
  for (const step of parsePath(path)) {
    if (current === null || current === undefined || BLOCKED.has(step)) return undefined;
    if (current instanceof Map) {
      current = current.get(step);
      continue;
    }
    if (typeof current !== 'object' && typeof current !== 'function') return undefined;
    if (!Object.hasOwn(current, step) && (!(step in current) || step in Object.prototype || step in Function.prototype)) {
      return undefined;
    }
    try {
      current = (current as Record<string, unknown>)[step];
    } catch {
      return undefined;
    }
  }
  return current;
}

/**
 * Splits a path into its steps: dot-separated names, and bracketed keys with or without quotes.
 *
 * @param path - E.g. `window["window-memo-1"].state.width`.
 * @returns The steps, e.g. `['window', 'window-memo-1', 'state', 'width']`.
 */
function parsePath(path: string): string[] {
  const steps: string[] = [];
  for (const match of path.matchAll(/\[\s*(?:"([^"]*)"|'([^']*)'|([^\]]*?))\s*\]|[^.[\]]+/g)) {
    steps.push(match[1] ?? match[2] ?? match[3] ?? match[0]);
  }
  return steps;
}

/**
 * Makes a window the active one, from its own raise event: the one place a window becomes active.
 *
 * @param instance - The window that came to the front.
 */
export function activateWindow(instance: WindowInstance): void {
  const depth = stackOrder.indexOf(instance.id);
  if (depth > -1) stackOrder.splice(depth, 1);
  stackOrder.push(instance.id);
  system.activeWindow = instance;
}

/**
 * Takes the active window away. Pressing the desktop leaves none active; the active window being
 * minimized or closed hands it to the next window in front, as the window stack brings it forward.
 *
 * @param instance - The window going away; omitted when the desktop itself was pressed.
 */
export function deactivateWindow(instance?: WindowInstance): void {
  if (!instance) {
    system.activeWindow = undefined;
    return;
  }
  if (system.activeWindow === instance) system.activeWindow = nextWindow(instance);
}

/**
 * The front-most window still showing, other than the one going away.
 *
 * @param except - The window going away.
 * @returns The next window in front, or undefined when none is showing.
 */
function nextWindow(except: WindowInstance): WindowInstance | undefined {
  for (let i = stackOrder.length - 1; i >= 0; i--) {
    const candidate = openWindows.get(stackOrder[i]);
    if (candidate && candidate !== except && candidate.state.open && !candidate.state.minimized) return candidate;
  }
  return undefined;
}
