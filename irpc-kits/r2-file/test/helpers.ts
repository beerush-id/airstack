import { createContextStore, HandlerError, withContext } from '@irpclib/irpc';
import { expect } from 'vitest';
import type { FsContext } from '../src/context.js';
import { fsContext } from '../src/context.js';

/** Exact public messages for the five operation-independent error codes. */
const PUBLIC_MESSAGE = {
  EACCES: 'Permission denied',
  EEXIST: 'Destination exists',
  EFBIG: 'File size exceeds limit',
  EINVAL: 'Invalid file type',
  ENOENT: 'Resource not found',
  ENOTEMPTY: 'Directory not empty',
} as const;

export type DenialCode = keyof typeof PUBLIC_MESSAGE | 'EIO';

/**
 * Full denial contract shared by every suite: typed `HandlerError` variant,
 * exact code, exact public message, `Error` cause carrying the decisive
 * server fragment, and a leak-free public surface.
 *
 * `EIO` derives its per-operation message from the cause fragment because
 * bare-adapter terminals report `Failed to <operation>` while naming that
 * same operation in the cause.
 *
 * @param probe - Filesystem invocation expected to reject.
 * @param code - Expected filesystem error code.
 * @param causeFragment - Decisive server-cause fragment (path, policy, or
 *   bare operation name for `EIO`).
 * @param sealed - Value the public message must never leak (optional).
 */
export async function expectDenial(
  probe: () => Promise<unknown>,
  code: DenialCode,
  causeFragment: string,
  sealed?: string
): Promise<void> {
  const expected = code === 'EIO' ? `Failed to ${causeFragment}` : PUBLIC_MESSAGE[code];
  const failure = await Promise.resolve()
    .then(probe)
    .then(
      () => {
        throw new Error(`expected ${code} denial, probe resolved`);
      },
      (error: unknown) => error
    );
  expect(failure).toBeInstanceOf(HandlerError);
  const denial = failure as Error & { code: unknown; cause: unknown };
  expect(denial.code).toBe(code);
  expect(denial.message).toBe(expected);
  expect(denial.message).not.toMatch(/[/\\]/);
  expect(denial.cause).toBeInstanceOf(Error);
  expect((denial.cause as Error).message).toContain(causeFragment);
  if (sealed !== undefined) expect(denial.message).not.toContain(sealed);
}

/**
 * Runs a probe inside ambient filesystem scope.
 *
 * @param value - Actor identity, home scope, and rule set.
 * @param probe - Filesystem invocation reading ambient scope.
 * @returns Probe result.
 */
export async function withFs<T>(value: FsContext, probe: () => Promise<T>): Promise<T> {
  return withContext(createContextStore(), () => {
    fsContext.set(value);
    return probe();
  });
}

/** Execution context double: waiting promises settle inline, nothing deferred. */
export const mockCtx = {
  waitUntil: (promise: Promise<unknown>) => promise,
  passThroughOnException: () => {},
} as never;

/**
 * In-memory CacheStorage double keyed by request URL, mirroring platform
 * `caches.default` closely enough for delivery cache assertions.
 */
export function createMockCache() {
  const store = new Map<string, Response>();
  return {
    match: async (request: Request | string) => {
      const key = typeof request === 'string' ? request : request.url;
      const cached = store.get(key);
      return cached ? cached.clone() : undefined;
    },
    put: async (request: Request | string, response: Response) => {
      const key = typeof request === 'string' ? request : request.url;
      store.set(key, response.clone());
      return;
    },
    delete: async (request: Request | string) => {
      const key = typeof request === 'string' ? request : request.url;
      return store.delete(key);
    },
  };
}
