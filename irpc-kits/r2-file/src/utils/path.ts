import { HandlerError } from '@irpclib/irpc';
import { DEFAULT_HOME_DIR, fsContext } from '../context.js';
import type { FileOperation, PathInfo } from '../types.js';

/**
 * Effective working directory with home fallback.
 *
 * @param cwd - Explicit working directory override.
 * @returns Effective cwd for relative resolution.
 */
export function resolveCwd(cwd?: string): string {
  return cwd ?? fsContext.get()?.homeDir ?? DEFAULT_HOME_DIR;
}
export interface PathResolver {
  /**
   * Resolves a user-space path into a canonical PathInfo object while validating boundaries,
   * enforcing access controls, and normalizing path semantics. This function is the linchpin for
   * all path resolution, ensuring consistent and secure path handling across the storage driver.
   *
   * The resolution process includes:
   * 1. Determining the effective working directory (cwd), defaulting to the home directory if not provided
   * 2. Resolving home directory shortcuts (`~` or `~/`)
   * 3. Normalizing path segments (collapsing duplicate slashes, resolving `.` and `..` segments, and clamping traversals at root)
   * 4. Applying access control rules to determine if the operation is permitted at the resolved path
   * 5. Mapping the canonical path to the storage-specific path by prepending the mount point
   * 6. Extracting the filename and parent directory from the storage path
   *
   * @param mountPoint - The base mount point for the storage (e.g., `/data`, `/media/usb`).
   *   This value is prepended directly to the resolved path without evaluation.
   * @param path - The user-provided path to resolve. Can be absolute, relative, or contain home directory shortcuts.
   * @param cwd - The optional working directory, used for resolving relative paths.
   *   If omitted, the effective working directory is determined from the current context.
   * @param action - The file operation being performed (e.g., 'read', 'write', 'mkdir'),
   *   used to check against access control lists.
   *
   * @returns A `PathInfo` object containing the normalized storage path, filename, parent directory, and effective working directory.
   *
   * @throws `HandlerError` with code `EACCES` if the resolved path is outside the allowed boundaries,
   *   if access rules explicitly deny the operation, or if no matching access rule permits the action.
   */
  (mountPoint: string, path: string, cwd?: string, action?: FileOperation): PathInfo;

  /**
   * Returns the effective working directory.
   * @param cwd - Optional explicit working directory override.
   * @returns Effective working directory path.
   */
  cwd(cwd?: string): string;
}

/**
 * Maps a user-space path to storage PathInfo with capability gating.
 *
 * @param mountPoint - Storage mount prepended without evaluation.
 * @param path - User-space target path.
 * @param cwd - Working directory for relatives.
 * @param action - Operation gated against allow lists.
 * @returns Storage PathInfo with effective cwd.
 */
const baseResolve = (mountPoint: string, path: string, cwd?: string, action?: FileOperation): PathInfo => {
  const ctx = fsContext.get();
  const home = ctx?.homeDir ?? DEFAULT_HOME_DIR;
  const normHome = normalizeSegments(home);
  const rules = ctx?.accessRules;
  const effectiveCwd = resolveCwd(cwd);

  let canonical: string;
  if (path === '~' || path.startsWith('~/')) {
    const rest = path === '~' ? '' : path.slice(1);
    canonical = normalizeSegments(`${home}${rest}`);
  } else if (path.startsWith('/')) {
    canonical = normalizeSegments(path);
  } else {
    canonical = normalizeSegments(path ? `${effectiveCwd}/${path}` : effectiveCwd);
  }

  if (!isSubpath(canonical, normHome)) {
    if (rules?.length) {
      const matching = rules.find((rule) => {
        const pattern = typeof rule === 'string' ? rule : rule.path;
        return matchPattern(canonical, pattern);
      });
      if (matching) {
        if (typeof matching !== 'string' && matching.allow?.length && action) {
          if (!matching.allow.includes(action)) {
            throw new HandlerError(
              'EACCES',
              'Permission denied',
              new Error(`Operation '${action}' not permitted on '${canonical}' outside accessRules`)
            );
          }
        }
      } else if (action) {
        throw new HandlerError(
          'EACCES',
          'Permission denied',
          new Error(
            `Permission denied for path '${canonical}' outside accessRules (operation '${action}' not permitted)`
          )
        );
      } else {
        throw new HandlerError(
          'EACCES',
          'Permission denied',
          new Error(`Permission denied for path '${canonical}' outside accessRules`)
        );
      }
    }
  }

  const storagePath = normalizeSegments(`${mountPoint}/${canonical}`);
  return {
    path: storagePath,
    name: basename(storagePath),
    directory: dirname(storagePath),
    cwd: effectiveCwd,
  };
};

export const resolve: PathResolver = Object.assign(baseResolve, { cwd: resolveCwd });

/**
 * Extracts the file or folder name from a path.
 *
 * @param path - Normalized or raw path string.
 * @returns Basename string.
 */
export function basename(path: string): string {
  const clean = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? clean : clean.slice(idx + 1);
}

/**
 * Extracts the parent directory path from a path.
 *
 * @param path - Normalized or raw path string.
 * @returns Directory path string.
 */
export function dirname(path: string): string {
  const clean = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  const idx = clean.lastIndexOf('/');
  if (idx <= 0) return '/';
  return clean.slice(0, idx);
}

/**
 * Maps a canonical path onto its physical storage location under a mount.
 *
 * @param mountPoint - Storage mount prepended without evaluation.
 * @param path - Canonical path relative to the mount root.
 * @returns Physical storage path.
 */
export function mountAt(mountPoint: string, path: string): string {
  return normalizeSegments(`${mountPoint}/${path}`);
}

/**
 * Recovers the outward canonical path by removing the physical mount prefix.
 *
 * @param mountPoint - Storage mount the physical path was scoped under.
 * @param path - Physical storage path.
 * @returns Canonical path with the mount hidden, unchanged when unmounted.
 */
export function stripMount(mountPoint: string, path: string): string {
  const mount = normalizeSegments(mountPoint);
  const target = normalizeSegments(path);
  if (mount === '/') {
    return target;
  }
  return target.startsWith(`${mount}/`) ? normalizeSegments(target.slice(mount.length)) : target;
}

/**
 * Evaluates whether a virtual path matches an access rule pattern.
 *
 * Pattern matching semantics:
 * - Exact match: When no wildcard is present, matches exact path only.
 * - Single wildcard `*`: Matches a single path segment (excludes `/`).
 * - Recursive wildcard `**`: Matches arbitrary descendant path segments.
 *
 * @param target - Normalized path to evaluate.
 * @param pattern - Path pattern (e.g. '/config.json', '/dir/*', '/tree/**').
 * @returns True if target matches the pattern.
 */
export function matchPattern(target: string, pattern: string): boolean {
  const normTarget = normalizeSegments(target);
  const normPattern = normalizeSegments(pattern);

  if (!normPattern.includes('*')) {
    if (normPattern === '/') {
      return true;
    }
    return normTarget === normPattern;
  }

  if (normPattern === '/**' || normPattern === '**') {
    return true;
  }

  if (normPattern.endsWith('/**')) {
    const base = normPattern.slice(0, -3);
    if (normTarget === base || normTarget.startsWith(`${base}/`)) {
      return true;
    }
  }

  const regexStr = normPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§GLOBSTAR§§')
    .replace(/\*/g, '[^/]+')
    .replace(/§§GLOBSTAR§§/g, '.*');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normTarget);
}

/**
 * Checks if a target path is equal to or a subpath of a root directory.
 *
 * @param target - Normalized target path.
 * @param root - Normalized root path.
 * @returns True if target is root or within root.
 */
function isSubpath(target: string, root: string): boolean {
  return target === root || target.startsWith(`${root}/`);
}

/**
 * Normalizes path segments by collapsing consecutive slashes, resolving dot segments,
 * and clamping parent directory traversals at the root boundary.
 *
 * @param rawPath - Unnormalized raw path string.
 * @returns Normalized absolute path.
 */
export function normalizeSegments(rawPath: string): string {
  const parts = rawPath.split('/').filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  return `/${stack.join('/')}`;
}
