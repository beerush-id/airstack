import type { D1Database } from '@cloudflare/workers-types';

const initializedDatabases = new WeakMap<D1Database, Map<string, Promise<void>>>();

/**
 * Ensures that the required D1 relational tables and dynamic tenancy columns exist.
 *
 * @param db - Cloudflare D1 database binding.
 * @param ownerKey - Tenancy column name to ensure on `_r2_files`.
 * @returns Promise that settles when schema preparation is complete.
 */
export async function ensureSchema(db: D1Database, ownerKey: string): Promise<void> {
  let dbTasks = initializedDatabases.get(db);
  if (!dbTasks) {
    dbTasks = new Map<string, Promise<void>>();
    initializedDatabases.set(db, dbTasks);
  }

  let task = dbTasks.get(ownerKey);
  if (!task) {
    task = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS _r2_files (
            path TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            size INTEGER NOT NULL DEFAULT 0,
            type TEXT NOT NULL,
            mtime INTEGER NOT NULL,
            etag TEXT,
            directory TEXT NOT NULL,
            link TEXT,
            hidden INTEGER NOT NULL DEFAULT 0,
            public INTEGER NOT NULL DEFAULT 0,
            deleted_at INTEGER,
            metadata TEXT,
            user_id TEXT
          )`
        )
        .run()
        .catch(() => {});

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS _r2_contents (
            path TEXT PRIMARY KEY REFERENCES _r2_files(path) ON DELETE CASCADE ON UPDATE CASCADE,
            content TEXT NOT NULL
          )`
        )
        .run()
        .catch(() => {});

      if (ownerKey) {
        try {
          await db.prepare(`ALTER TABLE _r2_files ADD COLUMN "${ownerKey}" TEXT`).run();
        } catch {
          // Column already exists
        }
      }
    })();
    dbTasks.set(ownerKey, task);
  }

  return task;
}
