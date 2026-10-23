/*
 * The dock's own record of the answers above it. Internal to the desktop's parts — never
 * re-exported — so answers change only through `dockWidget`.
 */
import { mutable } from '@airlib/react';
import type { DockWidgetEntry } from './registry.js';

/**
 * The answers by id, oldest first. Only adding and dismissing change it;
 * each answer owns its own live `data`, so nothing here reacts to an answer
 * as it arrives.
 */
export const dockWidgetEntries: Map<string, DockWidgetEntry> = mutable(new Map<string, DockWidgetEntry>(), {
  recursive: false,
});

/** Counts every change to the answers — one added, changing, or dismissed — so the stack wakes on each. */
export const dockWidgetActivity = mutable({ count: 0 });
