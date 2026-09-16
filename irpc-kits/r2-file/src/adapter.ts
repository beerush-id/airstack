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
 * Concern: pure pipeline orchestration. The adapter is 100% blind — it never
 * resolves, normalizes, or inspects paths or storage content, delegating
 * `(path, options)` untouched to the registered drivers. It owns exactly two
 * things the drivers cannot: reverse-order rollback compensation when a
 * driver halts, and terminal resolution when no driver sealed a result.
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
    return this.mutate<FileInfo>('mkdir', [path, options]);
  }

  /** Persists a payload across every medium. */
  write(path: string, data: FileInput, options?: WriteOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('write', [path, data, options]);
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
    return this.query<FileInfo | undefined>('stat', [path, options], undefined);
  }

  /** Reports whether a stored entry is present and active. */
  exists(path: string, options?: ExistsOptions): Promise<boolean> {
    return this.query<boolean>('exists', [path, options], false);
  }

  /** Pages the entries of a directory. */
  list(path?: string, options?: ListOptions): Promise<ListResult> {
    return this.query<ListResult>('list', [path, options], { entries: [] });
  }

  /** Pages the entries matching a name or metadata query. */
  search(query: string, options?: SearchOptions): Promise<ListResult> {
    return this.query<ListResult>('search', [query, options], { entries: [] });
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
    return this.mutate<FileInfo>('link', [target, path, options]);
  }

  /** Purges or trashes an entry across every medium. */
  remove(path: string, options?: RemoveOptions): Promise<boolean> {
    return this.mutate<boolean>('remove', [path, options]);
  }

  /** Returns a trashed entry to active state across every medium. */
  restore(path: string, options?: FileOptions): Promise<FileInfo> {
    return this.mutate<FileInfo>('restore', [path, options]);
  }

  /** Mutating terminal: an unsealed pipeline means no medium could fulfil it. */
  private async mutate<T>(operation: FileOperation, args: unknown[]): Promise<T> {
    const ctx = await this.dispatch<T>(operation, args);
    if ('result' in ctx) {
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
