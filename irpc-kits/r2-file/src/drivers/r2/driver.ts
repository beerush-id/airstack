import type {
  R2Bucket,
  R2GetOptions,
  R2ListOptions,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
  R2Range,
} from '@cloudflare/workers-types';
import { HandlerError } from '@irpclib/irpc';
import type { FileDriver } from '../../adapter.js';
import { DEFAULT_MAX_ENCODING_SIZE, DEFAULT_OWNER_KEY, fsContext } from '../../context.js';
import type {
  CopyOptions,
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
  R2DriverOptions,
  ReadOptions,
  RemoveOptions,
  SearchOptions,
  StatOptions,
  WriteOptions,
} from '../../types.js';
import { decodeCursor, encodeCursor } from '../../utils/cursor.js';
import { assertEncodingBudget, parseSize } from '../../utils/type.js';
import type { Decodable } from './codec.js';
import { decodeBody, toStorable } from './codec.js';
import type { HeadShape, ListedShape, R2Metadata } from './entry.js';
import { applySort, directoryInfo, fileInfoFromHead, listEntry, parseDeletedAt } from './entry.js';

/**
 * Decorates an `R2Bucket` so every binding rejection surfaces as a typed `EIO`
 * instead of a bare error, honoring the zero-plain-errors contract at the single
 * point where the driver touches storage. Only the five methods the driver calls
 * are guarded; the underlying binding is otherwise used as-is.
 *
 * @param bucket - Raw R2 binding supplied by the runtime.
 * @returns The same binding with `head`/`get`/`put`/`delete`/`list` wrapped.
 */
function guardBucket(bucket: R2Bucket): R2Bucket {
  const guard = async <T>(op: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (cause) {
      throw new HandlerError('EIO', `Failed to ${op}`, cause as Error);
    }
  };
  return {
    head: (key: string) => guard('stat', () => bucket.head(key)),
    get: (key: string, options?: R2GetOptions) => guard('read', () => bucket.get(key, options)),
    put: (key: string, value: Parameters<R2Bucket['put']>[1], options?: R2PutOptions) =>
      guard('write', () => bucket.put(key, value, options)),
    delete: (keys: string | string[]) => guard('remove', () => bucket.delete(keys)),
    list: (options?: R2ListOptions) => guard('list', () => bucket.list(options)),
  } as unknown as R2Bucket;
}

/** Coerces a listing filter time bound into epoch milliseconds. */
function toMillis(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

/**
 * Cloudflare R2 storage driver persisting blobs and directory markers.
 *
 * Reuses `ctx.path` directly, stripping the leading slash only at the R2
 * boundary. Trusts `NormalizerDriver` for all boundary, size, and type gating.
 */
export class R2Driver implements FileDriver {
  private readonly bucket: R2Bucket;
  private readonly ownerKey: string;
  private readonly strict: boolean;
  private readonly softDelete: boolean;
  private readonly maxEncodingBytes: number;

  /** Binds blob persistence to `bucket` with tenancy, strict, and trash policy. */
  constructor(bucket: R2Bucket, options?: R2DriverOptions) {
    this.bucket = guardBucket(bucket);
    this.ownerKey = options?.ownerKey ?? `_fs_${DEFAULT_OWNER_KEY}`;
    this.strict = options?.strict ?? false;
    this.softDelete = options?.softDelete ?? false;
    this.maxEncodingBytes = parseSize(options?.maxEncodingSize ?? DEFAULT_MAX_ENCODING_SIZE);
  }

  /** Records a directory marker unconditionally and seals `FileInfo`. */
  async mkdir(ctx: DriverContext<FileInfo>, _path: string, options?: MkdirOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const customMetadata = this.stamped(options?.onBehalf, {
      _fs_type: 'inode/directory',
      ...(options?.public === true ? { _fs_public: 'true' } : {}),
      ...this.callerMetadata(options?.metadata),
    });
    await this.preserve(ctx, key);
    const put = (await this.bucket.put(key, '', {
      httpMetadata: { contentType: 'inode/directory' },
      customMetadata,
    }))!;
    ctx.result = directoryInfo(canonical, put as HeadShape, customMetadata);
  }

  /** Uploads the blob and seals authoritative `FileInfo`; restores prior state on rollback. */
  async write(ctx: DriverContext<FileInfo>, _path: string, data: FileInput, options?: WriteOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const type = options?.type ?? 'application/octet-stream';
    const body = await toStorable(data, options);
    const customMetadata = this.stamped(options?.onBehalf, {
      ...(options?.public === true ? { _fs_public: 'true' } : {}),
      ...(options?.hidden === true ? { _fs_hidden: 'true' } : {}),
      ...this.callerMetadata(options?.metadata),
    });

    await this.preserve(ctx, key);
    const put = (await this.bucket.put(key, body as string, {
      httpMetadata: { contentType: type },
      customMetadata,
    }))!;
    ctx.result = fileInfoFromHead(canonical, put as HeadShape, customMetadata);
  }

  /** Returns stored bytes or decoded representation; seals `undefined` on absence. */
  async read(ctx: DriverContext<unknown>, _path: string, options?: ReadOptions): Promise<void> {
    if ('result' in ctx) return;
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const getOptions: R2GetOptions = {};
    const range = (options as { range?: R2Range } | undefined)?.range;
    if (range) {
      getOptions.range = range;
    }

    const found = await this.bucket.get(key, getOptions);
    if (found === null) {
      ctx.result = undefined;
      return;
    }
    const meta = (found as unknown as { customMetadata?: R2Metadata }).customMetadata;
    if (meta?._fs_deleted !== undefined || meta?._fs_type === 'inode/directory') {
      ctx.result = undefined;
      return;
    }
    const link = meta?._fs_link;
    if (link !== undefined) {
      const target = await this.bucket.get(link.slice(1), getOptions);
      if (target === null) {
        ctx.result = undefined;
        return;
      }
      const targetMeta = (target as unknown as { customMetadata?: R2Metadata }).customMetadata;
      if (targetMeta?._fs_deleted !== undefined || targetMeta?._fs_type === 'inode/directory') {
        ctx.result = undefined;
        return;
      }
      assertEncodingBudget(target.size, this.maxEncodingBytes, options?.encoding);
      ctx.result = await decodeBody(target as unknown as Decodable, options?.encoding);
      return;
    }
    assertEncodingBudget(found.size, this.maxEncodingBytes, options?.encoding);
    ctx.result = await decodeBody(found as unknown as Decodable, options?.encoding);
  }

  /** Returns live `FileInfo` resolving symlinks and trash metadata; seals `undefined` on absence. */
  async stat(ctx: DriverContext<FileInfo | undefined>, _path: string, options?: StatOptions): Promise<void> {
    if ('result' in ctx) return;
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const direct = await this.bucket.head(key);
    const slashed = direct === null ? await this.bucket.head(`${key}/`) : null;
    const head = direct ?? slashed;
    if (head !== null) {
      const meta = (head as unknown as { customMetadata?: R2Metadata }).customMetadata;
      const trashedAt = meta?._fs_deleted;
      const allowTrash = (options as { trash?: boolean } | undefined)?.trash === true;
      if (trashedAt !== undefined && !allowTrash) {
        ctx.result = undefined;
        return;
      }
      const info = this.describeHead(canonical, head, meta);
      const resolved = meta?._fs_link !== undefined ? await this.resolveLinkTarget(meta._fs_link, info) : info;
      ctx.result = trashedAt === undefined ? resolved : { ...resolved, deletedAt: parseDeletedAt(trashedAt) };
      return;
    }
    if (await this.hasChildren(key)) {
      ctx.result = directoryInfo(canonical);
      return;
    }
    ctx.result = undefined;
  }

  /** Confirms presence; honors trash filter options. */
  async exists(ctx: DriverContext<boolean>, _path: string, options?: ExistsOptions): Promise<void> {
    if (ctx.result === true) return;
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const allowTrash = (options as { trash?: boolean } | undefined)?.trash === true;
    const direct = await this.bucket.head(key);
    if (direct !== null) {
      const meta = (direct as unknown as { customMetadata?: R2Metadata }).customMetadata;
      if (meta?._fs_deleted === undefined || allowTrash) {
        ctx.result = true;
        return;
      }
    }
    const slashed = await this.bucket.head(`${key}/`);
    if (slashed !== null) {
      const meta = (slashed as unknown as { customMetadata?: R2Metadata }).customMetadata;
      if (meta?._fs_deleted === undefined || allowTrash) {
        ctx.result = true;
        return;
      }
    }
    if (await this.hasActiveChild(key)) {
      ctx.result = true;
      return;
    }
    ctx.result = false;
  }

  /** Lists the standalone prefix, applying the full filter set and over-fetching to `limit`. */
  async list(ctx: DriverContext<ListResult>, _path?: string, options?: ListOptions): Promise<void> {
    if ('result' in ctx) return;
    const canonical = ctx.path!;
    const stripped = canonical === '/' ? '' : canonical.slice(1).replace(/\/$/, '');
    const prefix = stripped === '' ? '' : `${stripped}/`;
    const delimiter = options?.recursive ? undefined : '/';
    const limit = options?.limit;
    const target = limit === undefined ? undefined : limit + 1;
    const offset = decodeCursor(options?.cursor);

    const entries: FileInfo[] = [];
    let cursor: string | undefined;
    let skipped = 0;
    let filled = false;

    do {
      const page = await this.bucket.list({ prefix, delimiter, cursor });
      for (const entry of await this.pageEntries(page, stripped, options)) {
        if (skipped < offset) {
          skipped++;
          continue;
        }
        entries.push(entry);
        if (target !== undefined && entries.length >= target) {
          filled = true;
          break;
        }
      }
      cursor = page.truncated ? (page as unknown as { cursor?: string }).cursor : undefined;
    } while (!filled && cursor !== undefined);

    if (options?.sort) {
      applySort(entries, options.sort);
    }

    if (target !== undefined && entries.length >= target) {
      entries.length = limit!;
      ctx.result = { entries, nextCursor: encodeCursor(offset + limit!) };
      return;
    }
    ctx.result = { entries };
  }

  /** Builds the qualifying entries from one R2 list page, resolving metadata and applying the filter set. */
  private async pageEntries(page: R2Objects, stripped: string, options?: ListOptions): Promise<FileInfo[]> {
    const entries: FileInfo[] = [];
    for (const p of page.delimitedPrefixes) {
      const clean = p.replace(/\/$/, '');
      const name = clean.slice(clean.lastIndexOf('/') + 1);
      /* istanbul ignore next */
      if (!options?.all && name.startsWith('.')) continue;
      const marker = ((await this.bucket.head(clean)) ?? (await this.bucket.head(p))) as unknown as {
        customMetadata?: R2Metadata;
      } | null;
      const stamp = marker?.customMetadata?._fs_deleted;
      const base = directoryInfo(`/${clean}`);
      const entry = stamp !== undefined ? { ...base, deletedAt: parseDeletedAt(stamp) } : base;
      if (this.qualifies(entry, options)) entries.push(entry);
    }
    for (const object of page.objects as unknown as ListedShape[]) {
      if (object.key === `${stripped}/`) continue;
      // R2 list may omit per-object metadata; resolve the authoritative head when the listing carries none.
      const resolved =
        object.customMetadata && Object.keys(object.customMetadata).length > 0
          ? object
          : ((await this.bucket.head(object.key)) as unknown as ListedShape);
      const entry = listEntry(resolved, resolved.customMetadata);
      if (this.qualifies(entry, options)) entries.push(entry);
    }
    return entries;
  }

  /** Reports whether an entry satisfies the trash, hidden, and `FileFilter` predicates, mirroring the D1 index. */
  private qualifies(entry: FileInfo, options?: ListOptions): boolean {
    const filter = options?.filter;
    const deleted = entry.deletedAt !== undefined;
    if (filter?.deleted !== undefined) {
      if (deleted !== filter.deleted) return false;
    } else if (options?.trash === true) {
      if (!deleted) return false;
    } else if (deleted) {
      return false;
    }
    if (options?.all !== true && entry.hidden === true) return false;
    if (filter === undefined) return true;
    if (filter.public !== undefined && (entry.public ?? false) !== filter.public) return false;
    if (filter.type !== undefined && entry.type !== filter.type) return false;
    if (filter.size?.min !== undefined && entry.size < filter.size.min) return false;
    if (filter.size?.max !== undefined && entry.size > filter.size.max) return false;
    if (filter.mtime?.min !== undefined && entry.mtime.getTime() < toMillis(filter.mtime.min)) return false;
    if (filter.mtime?.max !== undefined && entry.mtime.getTime() > toMillis(filter.mtime.max)) return false;
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (entry.metadata?.[key] !== value) return false;
      }
    }
    return true;
  }

  /** Passes unconditionally: key-addressed storage has no index for text queries. */
  async search(_ctx: DriverContext<ListResult>, _query: string, _options?: SearchOptions): Promise<void> {
    return;
  }

  /** Duplicates the source subtree into a fresh destination, streaming each object. */
  async copy(ctx: DriverContext<boolean>, _source: string, _destination: string, options?: CopyOptions): Promise<void> {
    const srcCanonical = ctx.path!;
    const dstCanonical = ctx.destination!;
    const srcKey = srcCanonical.slice(1);
    const dstKey = dstCanonical.slice(1);
    const directSrc = await this.bucket.head(srcKey);
    const slashedSrc = directSrc === null ? await this.bucket.head(`${srcKey}/`) : null;
    const srcHead = (directSrc ?? slashedSrc) as unknown as { customMetadata?: R2Metadata } | null;
    if (srcHead === null || srcHead.customMetadata?._fs_deleted !== undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`copy: Source path '${srcCanonical}' does not exist`)
      );
    }
    const resolvedSrcKey = directSrc !== null ? srcKey : `${srcKey}/`;
    const pairs = await this.subtreePairs(srcKey, resolvedSrcKey, dstKey);
    await this.assertNoConflict('copy', dstCanonical, pairs);

    for (const [src, dst] of pairs) {
      const obj = await this.bucket.get(src);
      /* istanbul ignore next */
      if (obj === null) continue;
      const customMetadata = this.entryMeta(
        obj.customMetadata,
        options?.onBehalf,
        src === resolvedSrcKey ? options?.public : undefined
      );
      await this.copyBody(dst, obj, { httpMetadata: obj.httpMetadata, customMetadata });
      ctx.rollback.add(async () => {
        await this.bucket.delete(dst);
      });
    }
    ctx.result = true;
  }

  /** Relocates the source subtree into a fresh destination, streaming each object. */
  async move(ctx: DriverContext<boolean>, _source: string, _destination: string, options?: MoveOptions): Promise<void> {
    const srcCanonical = ctx.path!;
    const dstCanonical = ctx.destination!;
    const srcKey = srcCanonical.slice(1);
    const dstKey = dstCanonical.slice(1);
    const directSrc = await this.bucket.head(srcKey);
    const slashedSrc = directSrc === null ? await this.bucket.head(`${srcKey}/`) : null;
    const srcHead = (directSrc ?? slashedSrc) as unknown as { customMetadata?: R2Metadata } | null;
    if (srcHead === null || srcHead.customMetadata?._fs_deleted !== undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`move: Source path '${srcCanonical}' does not exist`)
      );
    }
    if (srcKey === dstKey) {
      ctx.result = true;
      return;
    }
    const resolvedSrcKey = directSrc !== null ? srcKey : `${srcKey}/`;
    const pairs = await this.subtreePairs(srcKey, resolvedSrcKey, dstKey);
    await this.assertNoConflict('move', dstCanonical, pairs);

    for (const [src, dst] of pairs) {
      const obj = await this.bucket.get(src);
      /* istanbul ignore next */
      if (obj === null) continue;
      const customMetadata =
        options?.onBehalf === undefined
          ? { ...obj.customMetadata }
          : this.stamped(options.onBehalf, { ...obj.customMetadata });
      await this.copyBody(dst, obj, { httpMetadata: obj.httpMetadata, customMetadata });
    }
    await this.deleteKeys(pairs.map(([src]) => src));
    ctx.result = true;
    ctx.rollback.add(async () => {
      for (const [src, dst] of pairs) {
        const obj = await this.bucket.get(dst);
        /* istanbul ignore next */
        if (obj !== null) {
          await this.copyBody(src, obj, { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata });
        }
        await this.bucket.delete(dst);
      }
    });
  }

  /** Records a 0-byte symlink marker pointing at the canonical target. */
  async link(ctx: DriverContext<FileInfo>, _target: string, _path: string, options?: LinkOptions): Promise<void> {
    const aliasCanonical = ctx.path!;
    const targetCanonical = ctx.destination!;
    const aliasKey = aliasCanonical.slice(1);
    const customMetadata = this.stamped(options?.onBehalf, {
      _fs_link: targetCanonical,
      _fs_type: 'inode/symlink',
      ...(options?.public === true ? { _fs_public: 'true' } : {}),
      ...this.callerMetadata(options?.metadata),
    });
    await this.preserve(ctx, aliasKey);
    const put = (await this.bucket.put(aliasKey, '', { customMetadata }))!;
    ctx.result = fileInfoFromHead(aliasCanonical, put as HeadShape, customMetadata);
  }

  /** Purges or soft-stamps; strict non-empty directories require context enforcement. */
  async remove(ctx: DriverContext<boolean>, _path: string, options?: RemoveOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const directHead = await this.bucket.head(key);
    const slashedHead = directHead === null ? await this.bucket.head(`${key}/`) : null;
    const head = (directHead ?? slashedHead) as unknown as { customMetadata?: R2Metadata } | null;
    const targetKey = directHead !== null ? key : slashedHead !== null ? `${key}/` : undefined;
    const children = await this.listKeys(key);
    if (head === null && children.length === 0) {
      ctx.result = false;
      return;
    }
    if (this.strict && children.length > 0 && fsContext.get()?.enforced !== true) {
      throw new HandlerError(
        'ENOTEMPTY',
        'Directory not empty',
        new Error(`remove: Directory '${canonical}' is not empty without context enforcement`)
      );
    }
    const soft = options?.force === true ? false : (options?.soft ?? this.softDelete);
    if (soft) {
      const keys = targetKey !== undefined ? [targetKey, ...children] : children;
      const stampedAt = Date.now().toString();
      const changed = await this.rewriteSubtree(keys, (meta) =>
        meta._fs_deleted !== undefined ? null : { ...meta, _fs_deleted: stampedAt }
      );
      ctx.result = true;
      ctx.rollback.add(this.rollbackSubtree(changed));
      return;
    }
    if (options?.recursive === true && children.length > 0) {
      const victims = [...children];
      if (head !== null) victims.push(key);
      if (await this.bucket.head(`${key}/`)) victims.push(`${key}/`);
      const saved: {
        key: string;
        body: ArrayBuffer;
        httpMetadata?: Record<string, string>;
        meta?: Record<string, string>;
      }[] = [];
      for (const victim of victims) {
        const current = await this.bucket.get(victim);
        if (current === null) continue;
        saved.push({
          key: victim,
          body: (await (current as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0),
          httpMetadata: (current as unknown as { httpMetadata?: Record<string, string> }).httpMetadata,
          meta: (current as unknown as { customMetadata?: Record<string, string> }).customMetadata,
        });
      }
      await this.bucket.delete(victims);
      ctx.result = true;
      ctx.rollback.add(async () => {
        for (const item of saved) {
          await this.bucket.put(item.key, item.body, {
            httpMetadata: item.httpMetadata,
            customMetadata: item.meta,
          });
        }
      });
      return;
    }
    if (children.length > 0) {
      throw new HandlerError(
        'ENOTEMPTY',
        'Directory not empty',
        new Error(`remove: Directory '${canonical}' is not empty without recursive removal`)
      );
    }
    const current = (await this.bucket.get(targetKey!))!;
    const httpMetadata = (current as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const meta = (current as unknown as { customMetadata?: Record<string, string> }).customMetadata;
    const snapshot = (await (current as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0);
    await this.bucket.delete(targetKey!);
    ctx.result = true;
    ctx.rollback.add(async () => {
      await this.bucket.put(targetKey!, snapshot, { httpMetadata, customMetadata: meta });
    });
  }

  /** Clears the soft-delete stamp across the subtree; halts `ENOENT` when the path was never trashed. */
  async restore(ctx: DriverContext<FileInfo>, _path: string, _options?: FileOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const directHead = await this.bucket.head(key);
    const slashedHead = directHead === null ? await this.bucket.head(`${key}/`) : null;
    const head = (directHead ?? slashedHead) as unknown as { customMetadata?: R2Metadata } | null;
    if (head === null || head.customMetadata?._fs_deleted === undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`restore: Source path '${canonical}' does not exist`)
      );
    }
    const targetKey = directHead !== null ? key : `${key}/`;
    const children = await this.listKeys(key);
    const changed = await this.rewriteSubtree([targetKey, ...children], (meta) => {
      const next = { ...meta };
      delete next._fs_deleted;
      return next;
    });
    const updated = (await this.bucket.head(targetKey)) as unknown as HeadShape;
    ctx.result = this.describeHead(canonical, updated, updated.customMetadata);
    ctx.rollback.add(this.rollbackSubtree(changed));
  }

  /**
   * Rewrites each object under `keys` whose metadata the transform accepts, one
   * body at a time so peak memory stays flat. Returns the prior metadata of every
   * rewritten key so compensation can replay it without holding any body.
   *
   * @param keys - Object keys to visit (a resolved target plus its descendants).
   * @param transform - Returns the next metadata, or `null` to leave the object untouched.
   * @returns The key and prior metadata of each rewritten object.
   */
  private async rewriteSubtree(
    keys: string[],
    transform: (meta: R2Metadata) => R2Metadata | null
  ): Promise<{ key: string; before: R2Metadata }[]> {
    const changed: { key: string; before: R2Metadata }[] = [];
    for (const key of keys) {
      const obj = await this.bucket.get(key);
      /* istanbul ignore next */
      if (obj === null) continue;
      const before = (obj as unknown as { customMetadata: R2Metadata }).customMetadata;
      const after = transform(before);
      if (after === null) continue;
      await this.bucket.put(key, await (obj as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer(), {
        httpMetadata: (obj as unknown as { httpMetadata?: Record<string, string> }).httpMetadata,
        customMetadata: after as Record<string, string>,
      });
      changed.push({ key, before });
    }
    return changed;
  }

  /** Builds compensation reinstating each rewritten key's prior metadata, re-fetching bodies on replay. */
  private rollbackSubtree(changed: { key: string; before: R2Metadata }[]): () => Promise<void> {
    return async () => {
      for (const { key, before } of changed) {
        const obj = await this.bucket.get(key);
        /* istanbul ignore next */
        if (obj === null) continue;
        await this.bucket.put(key, await (obj as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer(), {
          httpMetadata: (obj as unknown as { httpMetadata?: Record<string, string> }).httpMetadata,
          customMetadata: before as Record<string, string>,
        });
      }
    };
  }

  private describeHead(canonical: string, head: unknown, meta?: R2Metadata): FileInfo {
    return meta?._fs_type === 'inode/directory'
      ? directoryInfo(canonical, head as HeadShape, meta)
      : fileInfoFromHead(canonical, head as HeadShape, meta);
  }

  /**
   * Overlays a symlink target's live metadata onto the alias descriptor.
   *
   * @param link - Canonical target path referenced by the alias.
   * @param alias - Alias `FileInfo` carrying the link's own path, name, and reference.
   * @returns The alias enriched with the target's size, type, and timestamps, or the untouched alias when the target is absent or trashed.
   */
  private async resolveLinkTarget(link: string, alias: FileInfo): Promise<FileInfo> {
    const targetKey = link.slice(1);
    const targetHead = (await this.bucket.head(targetKey)) ?? (await this.bucket.head(`${targetKey}/`));
    if (targetHead === null) return alias;
    const targetMeta = (targetHead as unknown as { customMetadata?: R2Metadata }).customMetadata;
    if (targetMeta?._fs_deleted !== undefined) return alias;
    const target = this.describeHead(link, targetHead, targetMeta);
    return {
      ...alias,
      size: target.size,
      type: target.type,
      mtime: target.mtime,
      etag: target.etag,
      isDirectory: target.isDirectory,
      ...(target.metadata ? { metadata: target.metadata } : {}),
    };
  }

  /**
   * Screens caller-supplied metadata, dropping reserved `_fs_*` keys.
   *
   * Concern: system state (type, visibility, trash, links) and ownership are
   * driver-authoritative; letting a caller inject `_fs_*` keys would allow
   * spoofing an owner or forging a deleted, public, or link flag.
   *
   * @param metadata - Raw metadata object from the caller's write options.
   * @returns Only the caller's non-reserved metadata keys.
   */
  private callerMetadata(metadata?: Record<string, string>): Record<string, string> {
    if (metadata === undefined) return {};
    return Object.fromEntries(Object.entries(metadata).filter(([key]) => !key.startsWith('_fs_')));
  }

  /** Stamps the owner identity under `_fs_<ownerKey>` over caller metadata. */
  private stamped(onBehalf: string | undefined, base: Record<string, string>): Record<string, string> {
    const actor = onBehalf ?? fsContext.get()?.onBehalf ?? fsContext.get()?.ownerId;
    if (actor === undefined) return { ...base };
    return { ...base, [this.ownerKey]: actor };
  }

  /**
   * Captures the prior state of a bucket key and registers compensation that restores it.
   *
   * @param ctx - Pipeline context receiving the compensation handler.
   * @param key - Bucket key whose pre-operation state is preserved.
   * @returns A promise that resolves once the prior state is captured and the rollback is registered.
   */
  private async preserve(ctx: DriverContext<unknown>, key: string): Promise<void> {
    const previous = await this.bucket.get(key);
    if (previous === null) {
      ctx.rollback.add(async () => {
        await this.bucket.delete(key);
      });
      return;
    }
    const body = (await (previous as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0);
    const httpMetadata = (previous as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const customMetadata = (previous as unknown as { customMetadata?: Record<string, string> }).customMetadata;
    ctx.rollback.add(async () => {
      await this.bucket.put(key, body, { httpMetadata, customMetadata });
    });
  }

  /** Maps the resolved source marker and every descendant to its destination key. */
  private async subtreePairs(srcKey: string, resolvedSrcKey: string, dstKey: string): Promise<[string, string][]> {
    const sourceKeys = [resolvedSrcKey, ...(await this.listKeys(srcKey))];
    return sourceKeys.map((src) => [src, dstKey + src.slice(srcKey.length)] as [string, string]);
  }

  /** Halts with `EEXIST` when any mapped destination key already exists, before any mutation. */
  private async assertNoConflict(op: string, dstCanonical: string, pairs: [string, string][]): Promise<void> {
    for (const [, dst] of pairs) {
      if (await this.bucket.head(dst)) {
        throw new HandlerError(
          'EEXIST',
          'Destination exists',
          new Error(`${op}: Destination path '${dstCanonical}' already exists`)
        );
      }
    }
  }

  /** Derives destination metadata from a source entry, applying the owner stamp and an optional public override. */
  private entryMeta(
    srcMeta: Record<string, string> | undefined,
    onBehalf: string | undefined,
    publicOverride?: boolean
  ): Record<string, string> {
    const preserved = { ...srcMeta };
    if (publicOverride !== undefined) {
      if (publicOverride) preserved._fs_public = 'true';
      else delete preserved._fs_public;
    }
    return this.stamped(onBehalf, preserved);
  }

  /** Deletes keys in chunks within the R2 per-call limit. */
  private async deleteKeys(keys: string[]): Promise<void> {
    for (let offset = 0; offset < keys.length; offset += 1000) {
      await this.bucket.delete(keys.slice(offset, offset + 1000));
    }
  }

  /** Copies a stored object's body into a destination key, buffering one object at a time. */
  private async copyBody(dstKey: string, source: R2ObjectBody, options: R2PutOptions): Promise<void> {
    await this.bucket.put(dstKey, await source.arrayBuffer(), options);
  }

  /** Reports whether any object lives under the directory prefix. */
  private async hasChildren(key: string): Promise<boolean> {
    const page = await this.bucket.list({ prefix: `${key}/`, limit: 1 });
    return (page.objects as unknown[]).length > 0;
  }

  /** Reports whether any active object lives under the directory prefix. */
  private async hasActiveChild(key: string): Promise<boolean> {
    const page = await this.bucket.list({ prefix: `${key}/`, limit: 10 });
    for (const object of page.objects as unknown as ListedShape[]) {
      const head = (await this.bucket.head(object.key)) as unknown as {
        customMetadata?: R2Metadata;
      };
      if (head.customMetadata?._fs_deleted === undefined) return true;
    }
    return false;
  }

  /** Collects every key under the directory prefix across continuations. */
  private async listKeys(key: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix: `${key}/`, cursor });
      for (const object of page.objects as unknown as { key: string }[]) {
        if (object.key !== `${key}/`) keys.push(object.key);
      }
      cursor = (page as unknown as { truncated?: boolean; cursor?: string }).truncated
        ? (page as unknown as { cursor?: string }).cursor
        : undefined;
    } while (cursor !== undefined);
    return keys;
  }
}
