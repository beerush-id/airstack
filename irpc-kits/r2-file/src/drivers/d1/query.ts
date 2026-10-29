import type { AnyType } from '@irpclib/irpc';
import type { FileFilter, ListOptions, SearchOptions, Sort } from '../../types.js';
import { decodeCursor, encodeCursor } from '../../utils/cursor.js';

export { decodeCursor, encodeCursor };

export type PreparedQuery = {
  sql: string;
  params: AnyType[];
  limit?: number;
  offset: number;
};

/**
 * SQL condition matching the entries inside a folder, bound with {@link inside}.
 *
 * Concern: D1 refuses LIKE patterns longer than 50 bytes, which real folder paths exceed, so a
 * folder's contents are matched as a range on the indexed `path` column instead of a LIKE prefix.
 * A range also takes `%` and `_` in a path literally, and compares case-sensitively, as paths are.
 */
export const INSIDE = '(path > ? AND path < ?)';

/**
 * Bounds of the paths inside a folder, for {@link INSIDE}: every path that starts with
 * `<folder>/` sorts strictly between `<folder>/` and `<folder>0`, since `0` is the character
 * after `/`, and nothing else does.
 *
 * @param folder - Folder path.
 * @returns The exclusive lower and upper bounds.
 */
export function inside(folder: string): [string, string] {
  return [`${folder}/`, `${folder}0`];
}

/**
 * Builds the SQL SELECT statement and bound parameters for a directory listing query.
 *
 * @param target - Resolved directory path.
 * @param options - Listing options including recursion, filtering, sorting, and pagination.
 * @returns Prepared query containing the SQL string, bind parameters, limit, and offset.
 */
export function buildListQuery(target: string, options?: ListOptions): PreparedQuery {
  const normalizedTarget = target === '' || target === '/' ? '/' : target;
  const isRecursive = options?.recursive ?? false;
  const showTrash = options?.trash ?? false;
  const showHidden = options?.all ?? false;

  const clauses: string[] = [];
  const params: AnyType[] = [];

  if (isRecursive) {
    if (normalizedTarget === '/') {
      clauses.push('path != ?');
      params.push('/');
    } else {
      clauses.push(INSIDE);
      params.push(...inside(normalizedTarget));
    }
  } else {
    clauses.push('directory = ?');
    params.push(normalizedTarget);
  }

  applyPredicates(clauses, params, {
    showTrash,
    showHidden,
    filter: options?.filter,
  });

  const orderBy = buildOrderBy(options?.sort);
  const limit = options?.limit;
  const offset = decodeCursor(options?.cursor);

  let sql = `SELECT * FROM _r2_files WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`;
  if (limit !== undefined) {
    sql += ` LIMIT ${limit + 1} OFFSET ${offset}`;
  } else if (offset > 0) {
    sql += ` LIMIT -1 OFFSET ${offset}`;
  }

  return { sql, params, limit, offset };
}

/**
 * Builds the SQL SELECT statement and bound parameters for a keyword search query.
 *
 * @param query - Search term.
 * @param cwd - Resolved working directory scope.
 * @param indexableKeys - Configured metadata keys to inspect.
 * @param options - Search options including filtering, sorting, and pagination.
 * @returns Prepared query containing the SQL string, bind parameters, limit, and offset.
 */
export function buildSearchQuery(
  query: string,
  cwd: string,
  indexableKeys?: string[],
  options?: SearchOptions
): PreparedQuery {
  const normalizedCwd = cwd === '' || cwd === '/' ? '/' : cwd;
  const showTrash = options?.trash ?? false;
  const showHidden = options?.all ?? false;

  const clauses: string[] = [];
  const params: AnyType[] = [];

  if (normalizedCwd !== '/') {
    clauses.push(INSIDE);
    params.push(...inside(normalizedCwd));
  }

  const searchConditions = ['name LIKE ?'];
  params.push(`%${query}%`);

  if (indexableKeys?.length) {
    for (const key of indexableKeys) {
      searchConditions.push('metadata LIKE ?');
      params.push(`%"${key}":%${query}%`);
    }
  }
  clauses.push(`(${searchConditions.join(' OR ')})`);

  applyPredicates(clauses, params, {
    showTrash,
    showHidden,
    filter: options?.filter,
  });

  const orderBy = buildOrderBy(options?.sort);
  const limit = options?.limit;
  const offset = decodeCursor(options?.cursor);

  let sql = `SELECT * FROM _r2_files WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`;
  if (limit !== undefined) {
    sql += ` LIMIT ${limit + 1} OFFSET ${offset}`;
  } else if (offset > 0) {
    sql += ` LIMIT -1 OFFSET ${offset}`;
  }

  return { sql, params, limit, offset };
}

/**
 * Constructs an SQL ORDER BY clause matching the specified sort options.
 *
 * @param sort - Single sort field or list of sort fields.
 * @returns SQL order by fragment (defaults to 'name ASC').
 */
export function buildOrderBy(sort?: Sort): string {
  if (!sort?.length) return 'name ASC';

  const sorts = Array.isArray(sort) ? sort : [sort];
  const parts: string[] = [];

  for (const s of sorts) {
    const desc = s.startsWith('-');
    const field = desc ? s.slice(1) : s;
    const dir = desc ? 'DESC' : 'ASC';

    switch (field) {
      case 'name':
        parts.push(`name ${dir}`);
        break;
      case 'size':
        parts.push(`size ${dir}`);
        break;
      case 'mtime':
        parts.push(`mtime ${dir}`);
        break;
      case 'type':
        parts.push(`type ${dir}`);
        break;
      case 'hidden':
        parts.push(`hidden ${dir}`);
        break;
      case 'public':
        parts.push(`public ${dir}`);
        break;
      case 'deletedAt':
        parts.push(`deleted_at ${dir}`);
        break;
      default:
        parts.push(`name ${dir}`);
    }
  }

  return parts.join(', ');
}

function applyPredicates(
  clauses: string[],
  params: AnyType[],
  opts: { showTrash: boolean; showHidden: boolean; filter?: FileFilter }
): void {
  if (opts.filter?.deleted !== undefined) {
    clauses.push(opts.filter.deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
  } else if (opts.showTrash) {
    clauses.push('deleted_at IS NOT NULL');
  } else {
    clauses.push('deleted_at IS NULL');
  }

  if (!opts.showHidden) {
    clauses.push('hidden = 0');
  }

  if (opts.filter) {
    const f = opts.filter;
    if (f.public !== undefined) {
      clauses.push('public = ?');
      params.push(f.public ? 1 : 0);
    }
    if (f.type !== undefined) {
      clauses.push('type = ?');
      params.push(f.type);
    }
    if (f.size?.min !== undefined) {
      clauses.push('size >= ?');
      params.push(f.size.min);
    }
    if (f.size?.max !== undefined) {
      clauses.push('size <= ?');
      params.push(f.size.max);
    }
    if (f.mtime?.min !== undefined) {
      const minVal = f.mtime.min instanceof Date ? f.mtime.min.getTime() : f.mtime.min;
      clauses.push('mtime >= ?');
      params.push(minVal);
    }
    if (f.mtime?.max !== undefined) {
      const maxVal = f.mtime.max instanceof Date ? f.mtime.max.getTime() : f.mtime.max;
      clauses.push('mtime <= ?');
      params.push(maxVal);
    }
    if (f.metadata) {
      for (const [key, val] of Object.entries(f.metadata)) {
        clauses.push(`json_extract(metadata, ?) = ?`);
        params.push(`$.${key}`, val);
      }
    }
  }
}
