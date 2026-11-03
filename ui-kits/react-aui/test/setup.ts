import { createLifecycle, type StateUnsubscribe, withContext } from '@airlib/react';
import { auiConfig } from '../src/config.js';

type Config = Record<string, unknown>;

let baseline: Config | undefined;

function isConfig(value: unknown): value is Config {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (!isConfig(value)) return value;

  const copy: Config = {};

  for (const [key, item] of Object.entries(value)) {
    copy[key] = clone(item);
  }

  return copy as T;
}

function restore(target: Config, snapshot: Config): Config {
  for (const key of Object.keys(target)) {
    if (!(key in snapshot)) delete target[key];
  }

  for (const [key, value] of Object.entries(snapshot)) {
    const current = target[key];
    target[key] = isConfig(current) && isConfig(value) ? restore(current, value) : clone(value);
  }

  return target;
}

export function snapshotConfig() {
  baseline = clone(auiConfig as unknown as Config);
}

export function restoreConfig() {
  if (baseline) restore(auiConfig as unknown as Config, baseline);
}

export function runApp(fn: () => void | Promise<void>): Promise<StateUnsubscribe> {
  return withContext(async () => {
    const scope = createLifecycle();

    await scope.run(fn);

    return () => {
      scope.destroy();
    };
  });
}
