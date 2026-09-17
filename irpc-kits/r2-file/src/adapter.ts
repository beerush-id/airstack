import type { IRPCBlob } from '@irpclib/irpc';
import { HandlerError } from '@irpclib/irpc';
import { createDriverCtx } from './context.js';
import type {
  AnyType,
  CopyOptions,
  DriverContext,
  ExistsOptions,
  FileAdapterOptions,
  FileEncoding,
  FileInfo,
  FileInput,
  FileOperation,
  FileOptions,
  LinkOptions,
  ListOptions,
  ListResult,
  MkdirOptions,
  MoveOptions,
  ReadOptions,
  RemoveOptions,
  RollbackFn,
  SearchOptions,
  StatOptions,
  WriteOptions,
} from './types.js';

/**
 * Pluggable storage driver contract.
 *
 * Concern: one medium per driver, coordinated only through `ctx`. A driver
 * that fulfils an operation must seal `ctx.result` regardless of its value;
 * a driver that cannot must return without touching it so the next medium
 * gets the call. Deliberately unrelated to `IRPCDriver` — the filesystem
 * engine is standalone and carries no RPC surface.
 */
export interface FileDriver {
  mkdir?(ctx: DriverContext<FileInfo>, path: string, options?: MkdirOptions): Promise<void>;
  write?(ctx: DriverContext<FileInfo>, path: string, data: FileInput, options?: WriteOptions): Promise<void>;
  read?(
    ctx: DriverContext<IRPCBlob | string | Record<string, AnyType> | AnyType[] | undefined>,
    path: string,
    options?: ReadOptions
  ): Promise<void>;
  stat?(ctx: DriverContext<FileInfo | undefined>, path: string, options?: StatOptions): Promise<void>;
  exists?(ctx: DriverContext<boolean>, path: string, options?: ExistsOptions): Promise<void>;
  list?(ctx: DriverContext<ListResult>, path?: string, options?: ListOptions): Promise<void>;
  search?(ctx: DriverContext<ListResult>, query: string, options?: SearchOptions): Promise<void>;
  copy?(ctx: DriverContext<boolean>, source: string, destination: string, options?: CopyOptions): Promise<void>;
  move?(ctx: DriverContext<boolean>, source: string, destination: string, options?: MoveOptions): Promise<void>;
  link?(ctx: DriverContext<FileInfo>, target: string, path: string, options?: LinkOptions): Promise<void>;
  remove?(ctx: DriverContext<boolean>, path: string, options?: RemoveOptions): Promise<void>;
  restore?(ctx: DriverContext<FileInfo>, path: string, options?: FileOptions): Promise<void>;
}

/**
 * Standalone filesystem engine orchestrating a chain of storage drivers.
 *
 * Concern: pure pipeline orchestration. The adapter never resolves, normalizes,
 * or inspects storage content, delegating `(path, options)` untouched to the
 * registered drivers. It owns exactly three things the drivers cannot:
 * reverse-order rollback compensation when a driver halts, terminal resolution
 * when no driver sealed a result, and stripping the storage `mountPoint` from
 * result paths so callers only ever receive canonical paths.
 */
export class FileAdapter {
  /** Wiring the adapter was constructed with, readable by callers that re-scope drivers. */
  readonly options: FileAdapterOptions;

  private readonly drivers: FileDriver[] = [];

  constructor(options?: FileAdapterOptions) {
    this.options = { ...options };
  }

  /** Appends a driver to the chain; registration order is execution order. */
  use(driver: FileDriver): this {
    this.drivers.push(driver);
    return this;
  }

  /** Creates a directory across every medium. */
  mkdir(path: string, options?: MkdirOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('mkdir', [path, options]).then((info) => this.unmountInfo(info));
  }

  /** Persists a payload across every medium. */
  write(path: string, data: FileInput, options?: WriteOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('write', [path, data, options]).then((info) => this.unmountInfo(info));
  }

  /** Reads the binary delivery reference for a stored file. */
  read(path: string, options?: ReadOptions<undefined>): Promise<IRPCBlob | undefined>;
  /** Reads a stored file as its requested wire representation. */
  read(path: string, options: ReadOptions<'text' | 'base64' | 'data-url'>): Promise<string | undefined>;
  /** Reads a stored file as parsed JSON. */
  read<T = unknown>(path: string, options: ReadOptions<'json'>): Promise<T | undefined>;
  read(path: string, options?: ReadOptions<FileEncoding | undefined>): Promise<any> {
    return this.query('read', [path, options], undefined);
  }

  /** Describes a stored entry, or `undefined` when absent. */
  stat(path: string, options?: StatOptions): Promise<FileInfo | undefined> {
    return this.query<FileInfo | undefined>('stat', [path, options], undefined).then((info) =>
      info === undefined ? undefined : this.unmountInfo(info)
    );
  }

  /** Reports whether a stored entry is present and active. */
  exists(path: string, options?: ExistsOptions): Promise<boolean> {
    return this.query<boolean>('exists', [path, options], false);
  }

  /** Pages the entries of a directory. */
  list(path?: string, options?: ListOptions): Promise<ListResult> {
    return this.query<ListResult>('list', [path, options], { entries: [] }).then((result) => this.unmountList(result));
  }

  /** Pages the entries matching a name or metadata query. */
  search(query: string, options?: SearchOptions): Promise<ListResult> {
    return this.query<ListResult>('search', [query, options], { entries: [] }).then((result) =>
      this.unmountList(result)
    );
  }

  /** Duplicates an entry across every medium. */
  copy(source: string, destination: string, options?: CopyOptions): Promise<boolean> {
    return this.mutate<boolean>('copy', [source, destination, options]);
  }

  /** Relocates an entry across every medium. */
  move(source: string, destination: string, options?: MoveOptions): Promise<boolean> {
    return this.mutate<boolean>('move', [source, destination, options]);
  }

  /** Records a symbolic link to a target across every medium. */
  link(target: string, path: string, options?: LinkOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('link', [target, path, options]).then((info) => this.unmountInfo(info));
  }

  /** Purges or trashes an entry across every medium. */
  remove(path: string, options?: RemoveOptions): Promise<boolean> {
    return this.mutate<boolean>('remove', [path, options]);
  }

  /** Returns a trashed entry to active state across every medium. */
  restore(path: string, options?: FileOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('restore', [path, options]).then((info) => this.unmountInfo(info));
  }

  /** Mutating terminal: an unsealed pipeline means no medium could fulfil it. */
  private async mutate<T>(operation: FileOperation, args: unknown[]): Promise<T> {
    const ctx = await this.dispatch<T>(operation, args);

    if ('result' in ctx) {
      if (ctx.result && typeof ctx.result === 'object') {
        ctx.result = this.unmountInfo(ctx.result as AnyType) as AnyType;
      }

      return ctx.result as T;
    }

    throw new HandlerError(
      'EIO',
      `Failed to ${operation}`,
      new Error(`${operation}: No capable storage driver handled operation`)
    );
  }

  /** Query terminal: an unsealed pipeline degrades to a safe neutral default. */
  private async query<T>(operation: FileOperation, args: unknown[], fallback: T): Promise<T> {
    const ctx = await this.dispatch<T>(operation, args);
    return 'result' in ctx ? (ctx.result as T) : fallback;
  }

  /** Runs one operation through the chain, compensating in reverse when a driver halts. */
  private async dispatch<T>(operation: FileOperation, args: unknown[]): Promise<DriverContext<T>> {
    const ctx = createDriverCtx<T>();
    try {
      for (const driver of this.drivers) {
        const handle = driver[operation] as DriverHandler | undefined;
        if (handle === undefined) continue;
        await handle.call(driver, ctx, ...args);
      }
    } catch (error) {
      await compensate(ctx.rollback);
      throw error;
    }
    return ctx;
  }

  /**
   * Strips the storage `mountPoint` prefix from a mounted result path.
   *
   * Concern: the mount is an absolute physical storage detail applied on input;
   * callers must only ever see canonical paths, so the adapter removes it on the
   * way out, guaranteeing the contract regardless of which driver sealed the result.
   *
   * @param path - Stored (mounted) path taken from a sealed driver result.
   * @returns The canonical path with the mount prefix removed.
   */
  private unmount(path: string): string {
    const mount = this.options.mountPoint ?? '/';
    if (mount === '/' || !path.startsWith(mount)) return path;
    return path.slice(mount.length) || '/';
  }

  /** Returns a copy of `info` reporting its canonical (un-mounted) path. */
  private unmountInfo(info: FileInfo): FileInfo {
    const result = { ...info, path: this.unmount(info.path) };
    if (result.link) {
      result.link = this.unmount(result.link);
    }
    return result;
  }

  /** Returns a copy of `result` reporting canonical (un-mounted) entry paths. */
  private unmountList(result: ListResult): ListResult {
    return { ...result, entries: result.entries.map((entry) => this.unmountInfo(entry)) };
  }
}

type DriverHandler = (ctx: DriverContext<any>, ...args: any[]) => Promise<void>;

/**
 * Unwinds registered compensations newest-first.
 *
 * @param rollback - Compensations drivers registered before the halt.
 */
async function compensate(rollback: Set<RollbackFn>): Promise<void> {
  for (const undo of [...rollback].reverse()) {
    try {
      await undo();
    } catch {
      // Unwinding must reach every medium; the halting error is what the caller needs.
    }
  }
}
