import type { R2Bucket, R2GetOptions, R2Range } from '@cloudflare/workers-types';
import { HandlerError } from '@irpclib/irpc';
import type { FileDriver } from '../../adapter.js';
import { DEFAULT_OWNER_KEY, fsContext } from '../../context.js';
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
import type { Decodable } from './codec.js';
import { decodeBody, toStorable } from './codec.js';
import type { HeadShape, ListedShape, R2Metadata } from './entry.js';
import { applySort, directoryInfo, fileInfoFromHead, listEntry, parseDeletedAt } from './entry.js';

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

  /** Binds blob persistence to `bucket` with tenancy, strict, and trash policy. */
  constructor(bucket: R2Bucket, options?: R2DriverOptions) {
    this.bucket = bucket;
    this.ownerKey = options?.ownerKey ?? `_fs_${DEFAULT_OWNER_KEY}`;
    this.strict = options?.strict ?? false;
    this.softDelete = options?.softDelete ?? false;
  }

  /** Records a directory marker unconditionally and seals `FileInfo`. */
  async mkdir(ctx: DriverContext<FileInfo>, _path: string, options?: MkdirOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const customMetadata = this.stamped(options?.onBehalf, {
      _fs_type: 'inode/directory',
      ...(options?.public === true ? { _fs_public: 'true' } : {}),
      ...(options?.metadata ?? {}),
    });
    const put = (await this.bucket.put(key, '', {
      httpMetadata: { contentType: 'inode/directory' },
      customMetadata,
    }))!;
    ctx.result = directoryInfo(canonical, put as HeadShape, customMetadata);
    ctx.rollback.add(async () => {
      await this.bucket.delete(key);
      await this.bucket.delete(`${key}/`);
    });
  }

  /** Uploads the blob and seals authoritative `FileInfo`; restores prior state on rollback. */
  async write(ctx: DriverContext<FileInfo>, _path: string, data: FileInput, options?: WriteOptions): Promise<void> {
    if (ctx.info !== undefined) return;
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const type = options?.type ?? 'application/octet-stream';
    const body = await toStorable(data, options);
    const customMetadata = this.stamped(options?.onBehalf, {
      ...(options?.public === true ? { _fs_public: 'true' } : {}),
      ...(options?.hidden === true ? { _fs_hidden: 'true' } : {}),
      ...(options?.metadata ?? {}),
    });

    const previous = await this.bucket.get(key);
    let prevBody: ArrayBuffer | undefined;
    let prevHttp: Record<string, string> | undefined;
    let prevMeta: Record<string, string> | undefined;
    if (previous !== null) {
      prevBody = (await (previous as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0);
      prevHttp = (previous as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
      prevMeta = (previous as unknown as { customMetadata?: Record<string, string> }).customMetadata;
    }

    const put = (await this.bucket.put(key, body as string, {
      httpMetadata: { contentType: type },
      customMetadata,
    }))!;
    ctx.result = fileInfoFromHead(canonical, put as HeadShape, customMetadata);

    if (prevBody !== undefined) {
      ctx.rollback.add(async () => {
        await this.bucket.put(key, prevBody, {
          httpMetadata: prevHttp,
          customMetadata: prevMeta,
        });
      });
    } else {
      ctx.rollback.add(async () => {
        await this.bucket.delete(key);
      });
    }
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
      ctx.result = await decodeBody(target as unknown as Decodable, options?.encoding);
      return;
    }
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
      ctx.result = trashedAt === undefined ? info : { ...info, deletedAt: parseDeletedAt(trashedAt) };
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
    if ('result' in ctx) return;
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

  /** Lists standalone prefix pages; applies in-memory sorting and hidden/trash filters. */
  async list(ctx: DriverContext<ListResult>, _path?: string, options?: ListOptions): Promise<void> {
    if ('result' in ctx) return;
    const canonical = ctx.path!;
    const stripped = canonical === '/' ? '' : canonical.slice(1).replace(/\/$/, '');
    const prefix = stripped === '' ? '' : `${stripped}/`;
    const page = await this.bucket.list({
      prefix,
      delimiter: options?.recursive ? undefined : '/',
      limit: options?.limit,
      cursor: options?.cursor,
    });

    const entries: FileInfo[] = [];

    for (const p of page.delimitedPrefixes) {
      const clean = p.replace(/\/$/, '');
      const itemCanonical = `/${clean}`;
      const name = clean.slice(clean.lastIndexOf('/') + 1);
      /* istanbul ignore next */
      if (!options?.all && name.startsWith('.')) continue;
      entries.push(directoryInfo(itemCanonical));
    }

    for (const object of page.objects as unknown as ListedShape[]) {
      if (object.key === `${stripped}/`) continue;

      const meta =
        object.customMetadata && Object.keys(object.customMetadata).length > 0
          ? object.customMetadata
          : ((await this.bucket.head(object.key)) as unknown as { customMetadata?: R2Metadata }).customMetadata;
      const deleted = meta?._fs_deleted !== undefined;
      if (!options?.trash && !options?.filter?.deleted && deleted) continue;
      if (options?.filter?.deleted === true && !deleted) continue;

      const entry = listEntry(object, meta);
      if (!options?.all && (entry.name.startsWith('.') || entry.hidden === true)) continue;
      entries.push(entry);
    }

    if (options?.sort) {
      applySort(entries, options.sort);
    }

    if (page.truncated && typeof (page as unknown as { cursor?: unknown }).cursor === 'string') {
      ctx.result = { entries, nextCursor: (page as unknown as { cursor: string }).cursor };
    } else {
      ctx.result = { entries };
    }
  }

  /** Passes unconditionally: key-addressed storage has no index for text queries. */
  async search(_ctx: DriverContext<ListResult>, _query: string, _options?: SearchOptions): Promise<void> {
    return;
  }

  /** Duplicates blob and metadata; inspects `ctx.info` for inlined skips. */
  async copy(ctx: DriverContext<boolean>, _source: string, _destination: string, options?: CopyOptions): Promise<void> {
    const srcCanonical = ctx.path!;
    const dstCanonical = ctx.destination!;
    const srcKey = srcCanonical.slice(1);
    const dstKey = dstCanonical.slice(1);
    const srcHead = ((await this.bucket.head(srcKey)) ?? (await this.bucket.head(`${srcKey}/`))) as unknown as {
      customMetadata?: R2Metadata;
    } | null;
    if (srcHead === null) {
      if (ctx.info !== undefined) {
        ctx.result = true;
        return;
      }
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`copy: Source path '${srcCanonical}' does not exist`)
      );
    }
    const meta = srcHead.customMetadata;
    if (meta?._fs_deleted !== undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`copy: Source path '${srcCanonical}' does not exist`)
      );
    }
    if (meta?._fs_type === 'inode/directory') {
      const customMetadata = this.stamped(options?.onBehalf, {
        _fs_type: 'inode/directory',
        ...(options?.public === true ? { _fs_public: 'true' } : {}),
      });
      await this.bucket.put(dstKey, '', {
        httpMetadata: { contentType: 'inode/directory' },
        customMetadata,
      });
      ctx.result = true;
      ctx.rollback.add(async () => {
        await this.bucket.delete(dstKey);
      });
      return;
    }
    const srcObj = (await this.bucket.get(srcKey))!;
    const srcMeta = (srcObj as unknown as { customMetadata: R2Metadata }).customMetadata;
    const httpMetadata = (srcObj as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const preserved = { ...srcMeta };
    if (options?.public !== undefined) {
      if (options.public) {
        preserved._fs_public = 'true';
      } else {
        delete preserved._fs_public;
      }
    }
    const customMetadata = this.stamped(options?.onBehalf, preserved as Record<string, string>);
    const body = await (srcObj as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer();
    await this.bucket.put(dstKey, body, { httpMetadata, customMetadata });
    ctx.result = true;
    ctx.rollback.add(async () => {
      await this.bucket.delete(dstKey);
    });
  }

  /** Relocates blob and metadata; inspects `ctx.info` for inlined skips. */
  async move(
    ctx: DriverContext<boolean>,
    _source: string,
    _destination: string,
    _options?: MoveOptions
  ): Promise<void> {
    const srcCanonical = ctx.path!;
    const dstCanonical = ctx.destination!;
    const srcKey = srcCanonical.slice(1);
    const dstKey = dstCanonical.slice(1);
    const srcHead = ((await this.bucket.head(srcKey)) ?? (await this.bucket.head(`${srcKey}/`))) as unknown as {
      customMetadata?: R2Metadata;
      httpMetadata?: Record<string, string>;
      size?: number;
    } | null;
    if (srcHead === null) {
      if (ctx.info !== undefined) {
        ctx.result = true;
        return;
      }
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`move: Source path '${srcCanonical}' does not exist`)
      );
    }
    const meta = srcHead.customMetadata;
    if (meta?._fs_deleted !== undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`move: Source path '${srcCanonical}' does not exist`)
      );
    }
    const srcObj = (await this.bucket.get(srcKey))!;
    const srcMeta = (srcObj as unknown as { customMetadata: R2Metadata }).customMetadata;
    const httpMetadata = (srcObj as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const customMetadata = this.stamped(undefined, { ...srcMeta } as Record<string, string>);
    const body = await (srcObj as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer();
    const snapshot = body.slice(0);
    await this.bucket.put(dstKey, body, { httpMetadata, customMetadata });
    await this.bucket.delete(srcKey);
    ctx.result = true;
    ctx.rollback.add(async () => {
      await this.bucket.put(srcKey, snapshot, {
        httpMetadata,
        customMetadata: { ...srcMeta } as Record<string, string>,
      });
      await this.bucket.delete(dstKey);
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
      ...(options?.metadata ?? {}),
    });
    const put = (await this.bucket.put(aliasKey, '', { customMetadata }))!;
    ctx.result = fileInfoFromHead(aliasCanonical, put as HeadShape, customMetadata);
    ctx.rollback.add(async () => {
      await this.bucket.delete(aliasKey);
    });
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
      const activeKey = targetKey ?? children[0];
      const target = (await this.bucket.get(activeKey))!;
      const meta = (target as unknown as { customMetadata?: R2Metadata }).customMetadata;
      if (meta?._fs_deleted !== undefined) {
        ctx.result = true;
        return;
      }
      const httpMetadata = (target as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
      const stampedAt = Date.now().toString();
      const body = await (target as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer();
      const snapshot = body.slice(0);
      const before = { ...meta } as Record<string, string>;
      await this.bucket.put(activeKey, body, {
        httpMetadata,
        customMetadata: { ...meta, _fs_deleted: stampedAt } as Record<string, string>,
      });
      ctx.result = true;
      ctx.rollback.add(async () => {
        await this.bucket.put(activeKey, snapshot, { httpMetadata, customMetadata: before });
      });
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
    const current = (await this.bucket.get(key))!;
    const httpMetadata = (current as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const meta = (current as unknown as { customMetadata?: Record<string, string> }).customMetadata;
    const snapshot = (await (current as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0);
    await this.bucket.delete(key);
    ctx.result = true;
    ctx.rollback.add(async () => {
      await this.bucket.put(key, snapshot, { httpMetadata, customMetadata: meta });
    });
  }

  /** Clears the soft-delete stamp; halts `ENOENT` when the path was never trashed. */
  async restore(ctx: DriverContext<FileInfo>, _path: string, _options?: FileOptions): Promise<void> {
    const canonical = ctx.path!;
    const key = canonical.slice(1);
    const head = (await this.bucket.head(key)) as unknown as {
      customMetadata?: R2Metadata;
    } | null;
    const trashedAt = head?.customMetadata?._fs_deleted;
    if (head === null || trashedAt === undefined) {
      throw new HandlerError(
        'ENOENT',
        'Resource not found',
        new Error(`restore: Source path '${canonical}' does not exist`)
      );
    }
    const current = (await this.bucket.get(key))!;
    const meta = { ...(current as unknown as { customMetadata: Record<string, string> }).customMetadata };
    delete meta._fs_deleted;
    const httpMetadata = (current as unknown as { httpMetadata?: Record<string, string> }).httpMetadata;
    const body = (await (current as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).slice(0);
    const put = (await this.bucket.put(key, body, { httpMetadata, customMetadata: meta }))!;
    ctx.result = this.describeHead(canonical, put, meta);
    ctx.rollback.add(async () => {
      await this.bucket.put(key, body, {
        httpMetadata,
        customMetadata: { ...meta, _fs_deleted: trashedAt },
      });
    });
  }

  private describeHead(canonical: string, head: unknown, meta?: R2Metadata): FileInfo {
    return meta?._fs_type === 'inode/directory'
      ? directoryInfo(canonical, head as HeadShape, meta)
      : fileInfoFromHead(canonical, head as HeadShape, meta);
  }

  /** Stamps the owner identity under `_fs_<ownerKey>` over caller metadata. */
  private stamped(onBehalf: string | undefined, base: Record<string, string>): Record<string, string> {
    const actor = onBehalf ?? fsContext.get()?.onBehalf ?? fsContext.get()?.ownerId;
    if (actor === undefined) return { ...base };
    return { ...base, [this.ownerKey]: actor };
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
      for (const object of page.objects as unknown as { key: string }[]) keys.push(object.key);
      cursor = (page as unknown as { truncated?: boolean; cursor?: string }).truncated
        ? (page as unknown as { cursor?: string }).cursor
        : undefined;
    } while (cursor !== undefined);
    return keys;
  }
}
