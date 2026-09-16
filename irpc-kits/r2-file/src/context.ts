import { createContext } from '@irpclib/irpc';
import type { AccessRuleEntry, DriverContext } from './types.js';

export const DEFAULT_HOME_DIR = '/home';
export const DEFAULT_OWNER_KEY = 'user_id';
export const DEFAULT_MAX_ENCODING_SIZE = '500kb';

/**
 * Ambient filesystem execution context for tenant, identity, and path scoping.
 */
export type FsContext = {
  /** Authenticated user or service identity. */
  ownerId?: string;
  /** Impersonated identity for delegated operations. */
  onBehalf?: string;
  /** User's home folder ($HOME chroot). */
  homeDir?: string;
  /** Access rules for path and capability authorization. */
  accessRules?: AccessRuleEntry[];
  /** Privileged bypass flag for server-side operations. */
  enforced?: boolean;
};

/**
 * Ambient filesystem execution context reader/accessor.
 */
export const fsContext = createContext<FsContext>();

/**
 * Creates an initial driver execution context for a single pipeline dispatch.
 *
 * Concern: Allocates a fresh rollback registry and casts the seed state
 * to {@link DriverContext}, delegating path resolution and metadata population
 * to the normalizer driver before storage execution.
 *
 * @template T - Expected terminal result type sealed by the capable driver.
 * @returns Initialized driver context with an empty rollback set.
 */
export function createDriverCtx<T = unknown>(): DriverContext<T> {
  return { rollback: new Set() } as DriverContext<T>;
}
