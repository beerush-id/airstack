import type { D1Database } from '@cloudflare/workers-types';
import { type AnyType, HandlerError } from '@irpclib/irpc';
import type { FileDriver } from '../../adapter.js';
import { DEFAULT_MAX_ENCODING_SIZE, DEFAULT_OWNER_KEY, fsContext } from '../../context.js';
import type {
  CopyOptions,
  D1DriverOptions,
  DriverContext,
  ExistsOptions,
  FileInfo,
  FileInput,
  FileOptions,
  LinkOptions,
  ListOptions,
  ListResult,
  MkdirOptions,
  MoveOptions,
  ReadOptions,
  RemoveOptions,
  SearchOptions,
  StatOptions,
  WriteOptions,
} from '../../types.js';
import { basename, dirname } from '../../utils/path.js';
import { parseSize } from '../../utils/type.js';
import { decodePayload, preparePayload, toFileInfo } from './codec.js';
import { buildListQuery, buildSearchQuery, encodeCursor } from './query.js';
import { ensureSchema } from './schema.js';

/**
 * Cloudflare D1 storage and relational metadata driver.
 *
 * Implements the FileDriver contract to provide sub-millisecond SQLite
 * metadata indexing, tiered content inlining for small payloads, and relational
 * search/sort capabilities across the two-table architecture.
 */
export class D1Driver implements FileDriver {
  private readonly db: D1Database;
  private readonly ownerKey: string;
  private readonly strict: boolean;
  private readonly softDelete: boolean;
  private readonly maxEncodingBytes: number;
  private readonly indexableKeys?: string[];

  /**
   * Initializes the D1Driver with the provided D1 database binding and configuration options.
   *
   * @param database - Cloudflare D1 database binding.
   * @param options - Storage constraints, tenancy binding, and indexing options.
   */
  constructor(database: D1Database, options?: D1DriverOptions) {
    this.db = database;
    this.ownerKey = options?.ownerKey || DEFAULT_OWNER_KEY;
    this.strict = options?.strict ?? false;
    this.softDelete = options?.softDelete ?? false;
    this.maxEncodingBytes = parseSize(options?.maxEncodingSize ?? DEFAULT_MAX_ENCODING_SIZE);
    this.indexableKeys = options?.indexableKeys;
  }

  /**
   * Records directory existence in the metadata index as an inode entry.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target directory path.
   * @param options - Directory creation options.
   */
  async mkdir(ctx: DriverContext<FileInfo>, _path: string, options?: MkdirOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const name = ctx.name!;
    const dir = ctx.dirname!;
    const mtime = Date.now();
    const owner = this.getOwner();
    const pub = options?.public ? 1 : 0;
    const meta = options?.metadata ? JSON.stringify(options.metadata) : null;

    await this.db
      .prepare(
        `INSERT INTO _r2_files (path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}")
        VALUES (?, ?, 0, 'inode/directory', ?, NULL, ?, NULL, 0, ?, NULL, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          size = excluded.size,
          type = excluded.type,
          mtime = excluded.mtime,
          etag = excluded.etag,
          directory = excluded.directory,
          link = excluded.link,
          hidden = excluded.hidden,
          public = excluded.public,
          deleted_at = NULL,
          metadata = excluded.metadata,
          "${this.ownerKey}" = excluded."${this.ownerKey}"`
      )
      .bind(target, name, mtime, dir, pub, meta, owner)
      .run();

    ctx.rollback.add(async () => {
      await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(target).run();
    });

    ctx.result = {
      path: target,
      name,
      size: 0,
      type: 'inode/directory',
      mtime: new Date(mtime),
      isDirectory: true,
      public: Boolean(options?.public),
      hidden: false,
      metadata: options?.metadata,
    };
  }

  /**
   * Persists file metadata and conditionally inlines content into the SQLite index.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target file path.
   * @param data - Inbound payload.
   * @param options - Write options and wire encoding.
   */
  async write(ctx: DriverContext<FileInfo>, _path: string, data: FileInput, options?: WriteOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const name = ctx.name!;
    const dir = ctx.dirname!;
    const mtime = Date.now();
    const owner = this.getOwner();
    const pub = options?.public ? 1 : 0;
    const hidden = options?.hidden ? 1 : 0;
    const meta = options?.metadata ? JSON.stringify(options.metadata) : null;

    const prepared = preparePayload(data, options, this.maxEncodingBytes);

    await this.db
      .prepare(
        `INSERT INTO _r2_files (path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}")
        VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, NULL, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          size = excluded.size,
          type = excluded.type,
          mtime = excluded.mtime,
          etag = excluded.etag,
          directory = excluded.directory,
          link = excluded.link,
          hidden = excluded.hidden,
          public = excluded.public,
          deleted_at = NULL,
          metadata = excluded.metadata,
          "${this.ownerKey}" = excluded."${this.ownerKey}"`
      )
      .bind(target, name, prepared.size, prepared.type ?? null, mtime, dir, hidden, pub, meta, owner)
      .run();

    if (prepared.shouldInline && prepared.content !== null) {
      await this.db
        .prepare(
          `INSERT INTO _r2_contents (path, content) VALUES (?, ?)
          ON CONFLICT(path) DO UPDATE SET content = excluded.content`
        )
        .bind(target, prepared.content)
        .run();
    } else {
      await this.db.prepare('DELETE FROM _r2_contents WHERE path = ?').bind(target).run();
    }

    ctx.rollback.add(async () => {
      await this.db.prepare('DELETE FROM _r2_contents WHERE path = ?').bind(target).run();
      await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(target).run();
    });

    ctx.result = {
      path: target,
      name,
      size: prepared.size,
      type: prepared.type,
      mtime: new Date(mtime),
      isDirectory: false,
      public: Boolean(options?.public),
      hidden: Boolean(options?.hidden),
      metadata: options?.metadata,
    };
  }

  /**
   * Resolves inlined content from SQLite, delegating to downstream media if absent.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target file path.
   * @param options - Read options and wire decoding requested.
   */
  async read(ctx: DriverContext<FileInput | undefined>, _path: string, options?: ReadOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const fileRow = await this.db
      .prepare('SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NULL')
      .bind(target)
      .first<{ type: string }>();

    if (!fileRow) {
      return;
    }

    const contentRow = await this.db
      .prepare('SELECT content FROM _r2_contents WHERE path = ?')
      .bind(target)
      .first<{ content: string }>();

    if (!contentRow || contentRow.content === null) {
      return;
    }

    ctx.result = decodePayload(contentRow.content, fileRow.type, options?.encoding);
  }

  /**
   * Retrieves file metadata from the index, resolving symlink targets dynamically.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target entry path.
   * @param options - Stat options including trash opt-in.
   */
  async stat(ctx: DriverContext<FileInfo | undefined>, _path: string, options?: StatOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const trash = options?.trash ?? false;
    const sql = trash
      ? 'SELECT * FROM _r2_files WHERE path = ?'
      : 'SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NULL';

    const row = await this.db.prepare(sql).bind(target).first<Record<string, AnyType>>();
    if (!row) {
      return;
    }

    let targetRow: Record<string, AnyType> | null = null;
    if (row.link) {
      targetRow = await this.db
        .prepare('SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NULL')
        .bind(row.link)
        .first<Record<string, AnyType>>();
    }

    ctx.result = toFileInfo(row, targetRow);
  }

  /**
   * Checks whether an active entry exists in the index.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target entry path.
   * @param _options - Exists check options.
   */
  async exists(ctx: DriverContext<boolean>, _path: string, _options?: ExistsOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const row = await this.db
      .prepare('SELECT 1 FROM _r2_files WHERE path = ? AND deleted_at IS NULL')
      .bind(target)
      .first();

    if (row) {
      ctx.result = true;
    }
  }

  /**
   * Queries directory contents with relational sorting, filtering, and cursor pagination.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Directory path to list.
   * @param options - Listing filter, sorting, and pagination controls.
   */
  async list(ctx: DriverContext<ListResult>, _path?: string, options?: ListOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const query = buildListQuery(target, options);

    const { results } = await this.db
      .prepare(query.sql)
      .bind(...query.params)
      .all<Record<string, AnyType>>();
    let nextCursor: string | undefined;
    let rows = results;

    if (query.limit !== undefined && rows.length > query.limit) {
      rows = rows.slice(0, query.limit);
      nextCursor = encodeCursor(query.offset + query.limit);
    }

    const entries = rows.map((r) => toFileInfo(r));
    ctx.result = { entries, nextCursor };
  }

  /**
   * Searches entries by name and configured indexable keys scoped to working directory.
   *
   * @param ctx - Pipeline execution context.
   * @param query - Search term.
   * @param options - Search options including working directory scope.
   */
  async search(ctx: DriverContext<ListResult>, query: string, options?: SearchOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const cwd = ctx.cwd!;
    const preparedQuery = buildSearchQuery(query, cwd, this.indexableKeys, options);

    const { results } = await this.db
      .prepare(preparedQuery.sql)
      .bind(...preparedQuery.params)
      .all<Record<string, AnyType>>();

    let nextCursor: string | undefined;
    let rows = results;

    if (preparedQuery.limit !== undefined && rows.length > preparedQuery.limit) {
      rows = rows.slice(0, preparedQuery.limit);
      nextCursor = encodeCursor(preparedQuery.offset + preparedQuery.limit);
    }

    const entries = rows.map((r) => toFileInfo(r));
    ctx.result = { entries, nextCursor };
  }

  /**
   * Duplicates an entry record and any inlined content in the index.
   *
   * @param ctx - Pipeline execution context.
   * @param source - Source path.
   * @param destination - Destination path.
   * @param options - Copy options.
   */
  async copy(ctx: DriverContext<boolean>, _source: string, _destination: string, options?: CopyOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const src = ctx.path!;
    const dest = ctx.destination!;

    const sourceRow = await this.db
      .prepare('SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NULL')
      .bind(src)
      .first<Record<string, AnyType>>();

    if (!sourceRow) {
      throw new HandlerError('ENOENT', 'Resource not found', new Error(`copy: Source path '${src}' does not exist`));
    }

    ctx.info = toFileInfo(sourceRow);
    const destName = basename(dest);
    const destDir = dirname(dest);
    const mtime = Date.now();
    const isPublic = options?.public !== undefined ? (options.public ? 1 : 0) : sourceRow.public;
    const owner = this.getOwner();

    await this.db
      .prepare(
        `INSERT INTO _r2_files (path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          size = excluded.size,
          type = excluded.type,
          mtime = excluded.mtime,
          etag = excluded.etag,
          directory = excluded.directory,
          link = excluded.link,
          hidden = excluded.hidden,
          public = excluded.public,
          deleted_at = NULL,
          metadata = excluded.metadata,
          "${this.ownerKey}" = excluded."${this.ownerKey}"`
      )
      .bind(
        dest,
        destName,
        sourceRow.size,
        sourceRow.type,
        mtime,
        sourceRow.etag,
        destDir,
        sourceRow.link,
        sourceRow.hidden,
        isPublic,
        sourceRow.metadata,
        owner
      )
      .run();

    const contentRow = await this.db
      .prepare('SELECT content FROM _r2_contents WHERE path = ?')
      .bind(src)
      .first<{ content: string }>();

    if (contentRow && contentRow.content !== null) {
      await this.db
        .prepare(
          `INSERT INTO _r2_contents (path, content) VALUES (?, ?)
          ON CONFLICT(path) DO UPDATE SET content = excluded.content`
        )
        .bind(dest, contentRow.content)
        .run();
    }

    ctx.rollback.add(async () => {
      await this.db.prepare('DELETE FROM _r2_contents WHERE path = ?').bind(dest).run();
      await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(dest).run();
    });

    ctx.result = true;
  }

  /**
   * Relocates an entry record and its inlined content atomically in the index.
   *
   * @param ctx - Pipeline execution context.
   * @param source - Source path.
   * @param destination - Destination path.
   * @param _options - Move options.
   */
  async move(
    ctx: DriverContext<boolean>,
    _source: string,
    _destination: string,
    _options?: MoveOptions
  ): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const src = ctx.path!;
    const dest = ctx.destination!;

    const sourceRow = await this.db
      .prepare('SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NULL')
      .bind(src)
      .first<Record<string, AnyType>>();

    if (!sourceRow) {
      throw new HandlerError('ENOENT', 'Resource not found', new Error(`move: Source path '${src}' does not exist`));
    }

    ctx.info = toFileInfo(sourceRow);
    const destName = basename(dest);
    const destDir = dirname(dest);

    await this.db.prepare('DELETE FROM _r2_contents WHERE path = ?').bind(dest).run();
    await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(dest).run();

    await this.db
      .prepare(
        `INSERT INTO _r2_files (
          path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dest,
        destName,
        sourceRow.size,
        sourceRow.type,
        Date.now(),
        sourceRow.etag,
        destDir,
        sourceRow.link,
        sourceRow.hidden,
        sourceRow.public,
        sourceRow.deleted_at,
        sourceRow.metadata,
        sourceRow[this.ownerKey] ?? null
      )
      .run();

    await this.db.prepare('UPDATE _r2_contents SET path = ? WHERE path = ?').bind(dest, src).run();
    await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(src).run();

    ctx.rollback.add(async () => {
      await this.db
        .prepare(
          `INSERT INTO _r2_files (
            path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          src,
          sourceRow.name,
          sourceRow.size,
          sourceRow.type,
          sourceRow.mtime,
          sourceRow.etag,
          sourceRow.directory,
          sourceRow.link,
          sourceRow.hidden,
          sourceRow.public,
          sourceRow.deleted_at,
          sourceRow.metadata,
          sourceRow[this.ownerKey] ?? null
        )
        .run();
      await this.db.prepare('UPDATE _r2_contents SET path = ? WHERE path = ?').bind(src, dest).run();
      await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(dest).run();
    });

    ctx.result = true;
  }

  /**
   * Creates a symbolic link entry pointing to a target path in the index.
   *
   * @param ctx - Pipeline execution context.
   * @param target - Target resource path the symlink references.
   * @param path - Path of the symlink alias.
   * @param options - Link creation options.
   */
  async link(ctx: DriverContext<FileInfo>, _target: string, _path: string, options?: LinkOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const linkPath = ctx.path!;
    const targetPath = ctx.destination!;
    const name = ctx.name!;
    const dir = ctx.dirname!;
    const mtime = Date.now();
    const owner = this.getOwner();
    const pub = options?.public ? 1 : 0;
    const meta = options?.metadata ? JSON.stringify(options.metadata) : null;

    await this.db
      .prepare(
        `INSERT INTO _r2_files (path, name, size, type, mtime, etag, directory, link, hidden, public, deleted_at, metadata, "${this.ownerKey}")
        VALUES (?, ?, 0, 'inode/symlink', ?, NULL, ?, ?, 0, ?, NULL, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          size = excluded.size,
          type = excluded.type,
          mtime = excluded.mtime,
          etag = excluded.etag,
          directory = excluded.directory,
          link = excluded.link,
          hidden = excluded.hidden,
          public = excluded.public,
          deleted_at = NULL,
          metadata = excluded.metadata,
          "${this.ownerKey}" = excluded."${this.ownerKey}"`
      )
      .bind(linkPath, name, mtime, dir, targetPath, pub, meta, owner)
      .run();

    ctx.rollback.add(async () => {
      await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(linkPath).run();
    });

    ctx.result = {
      path: linkPath,
      name,
      size: 0,
      type: 'inode/symlink',
      mtime: new Date(mtime),
      isDirectory: false,
      public: Boolean(options?.public),
      hidden: false,
      link: targetPath,
      metadata: options?.metadata,
    };
  }

  /**
   * Removes or soft-deletes entry records from the index, subject to strict safety policy.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target path to remove.
   * @param options - Deletion options (recursive, force, soft).
   */
  async remove(ctx: DriverContext<boolean>, _path: string, options?: RemoveOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const isRecursive = options?.recursive ?? false;
    const isSoft = options?.soft === true || (this.softDelete && !options?.force);

    const childCountRow = await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM _r2_files
        WHERE (path LIKE ? OR directory = ? OR directory LIKE ?) AND path != ? AND deleted_at IS NULL`
      )
      .bind(`${target}/%`, target, `${target}/%`, target)
      .first<{ cnt: number }>();

    const hasChildren = childCountRow!.cnt > 0;

    if (this.strict && hasChildren && !fsContext.get()?.enforced) {
      throw new HandlerError(
        'ENOTEMPTY',
        'Directory not empty',
        new Error(`remove: Directory '${target}' is not empty without context enforcement`)
      );
    }

    const sqlFind = isRecursive
      ? 'SELECT path, deleted_at FROM _r2_files WHERE path = ? OR path LIKE ?'
      : 'SELECT path, deleted_at FROM _r2_files WHERE path = ?';

    const params = isRecursive ? [target, `${target}/%`] : [target];
    const existing = await this.db
      .prepare(sqlFind)
      .bind(...params)
      .all<{ path: string; deleted_at: number | null }>();

    if (!existing.results || existing.results.length === 0) {
      ctx.result = false;
      return;
    }

    if (isSoft) {
      const now = Date.now();
      if (isRecursive) {
        await this.db
          .prepare('UPDATE _r2_files SET deleted_at = ? WHERE path = ? OR path LIKE ?')
          .bind(now, target, `${target}/%`)
          .run();
      } else {
        await this.db.prepare('UPDATE _r2_files SET deleted_at = ? WHERE path = ?').bind(now, target).run();
      }
      ctx.rollback.add(async () => {
        for (const r of existing.results) {
          await this.db.prepare('UPDATE _r2_files SET deleted_at = ? WHERE path = ?').bind(r.deleted_at, r.path).run();
        }
      });
    } else {
      if (isRecursive) {
        await this.db
          .prepare('DELETE FROM _r2_contents WHERE path = ? OR path LIKE ?')
          .bind(target, `${target}/%`)
          .run();
        await this.db.prepare('DELETE FROM _r2_files WHERE path = ? OR path LIKE ?').bind(target, `${target}/%`).run();
      } else {
        await this.db.prepare('DELETE FROM _r2_contents WHERE path = ?').bind(target).run();
        await this.db.prepare('DELETE FROM _r2_files WHERE path = ?').bind(target).run();
      }
    }

    ctx.result = true;
  }

  /**
   * Restores a soft-deleted entry in the index back to active status.
   *
   * @param ctx - Pipeline execution context.
   * @param path - Target path to restore.
   * @param _options - Restore options.
   */
  async restore(ctx: DriverContext<FileInfo>, _path: string, _options?: FileOptions): Promise<void> {
    await ensureSchema(this.db, this.ownerKey);
    const target = ctx.path!;
    const row = await this.db
      .prepare('SELECT * FROM _r2_files WHERE path = ? AND deleted_at IS NOT NULL')
      .bind(target)
      .first<Record<string, AnyType>>();

    if (!row) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`restore: Target path '${target}' does not exist in trash`)
      );
    }

    await this.db.prepare('UPDATE _r2_files SET deleted_at = NULL WHERE path = ?').bind(target).run();

    const prevDeleted = row.deleted_at;
    ctx.rollback.add(async () => {
      await this.db.prepare('UPDATE _r2_files SET deleted_at = ? WHERE path = ?').bind(prevDeleted, target).run();
    });

    ctx.result = toFileInfo({ ...row, deleted_at: null });
  }

  private getOwner(): string | null {
    const ctx = fsContext.get();
    return ctx?.onBehalf ?? ctx?.ownerId ?? null;
  }
}
