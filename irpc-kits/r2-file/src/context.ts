import { createContext } from '@irpclib/irpc';
import type { AccessRuleEntry } from './types.js';

export const DEFAULT_HOME_DIR = '/home';

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
