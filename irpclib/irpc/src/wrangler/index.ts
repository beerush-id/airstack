/* istanbul ignore file */

import type { AnyType } from '@airlib/core';

let envResolver: Promise<AnyType> | undefined;

/**
 * Resolves Cloudflare environment bindings, transparently falling back
 * to local emulation via `getPlatformProxy()` during development when
 * bindings are absent.
 *
 * @param env - Ambient or passed-in worker environment.
 * @returns Effective environment containing active or emulated bindings.
 */
export async function resolveBinding<T extends object = Record<string, AnyType>>(env?: T): Promise<T> {
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') {
    return { ...env } as T;
  }

  try {
    envResolver ??= import('wrangler').then(async ({ getPlatformProxy }) => {
      return (await getPlatformProxy()).env;
    });

    const resolved = await envResolver;
    return { ...resolved, ...env } as T;
  } catch {
    return { ...env } as T;
  }
}
