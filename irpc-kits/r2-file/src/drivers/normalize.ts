import { HandlerError } from '@irpclib/irpc';
import type { FileDriver } from '../adapter.js';
import { DEFAULT_MAX_ENCODING_SIZE, DEFAULT_MAX_SIZE } from '../context.js';
import type {
  CopyOptions,
  DriverContext,
  ExistsOptions,
  FileDriverOptions,
  FileEncoding,
  FileInfo,
  FileInput,
  LinkOptions,
  ListOptions,
  ListResult,
  MkdirOptions,
  MoveOptions,
  ReadOptions,
  RemoveOptions,
  SearchOptions,
  StatOptions,
  UrlContent,
  WriteOptions,
} from '../types.js';
import { resolve } from '../utils/path.js';
import { isSizeAllowed, isTypeAllowed, parseSize, resolveType, validateType } from '../utils/type.js';
import { resolveUrl } from '../utils/url.js';

const encoder = new TextEncoder();

/**
 * First driver in the adapter chain normalizing paths and enforcing boundaries.
 *
 * Each operation resolves once through the shared resolver, which owns
 * boundary truth, then populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`
 * (plus `ctx.destination` for `copy`, `move`, and `link`) for downstream
 * storage drivers. Boundary gating (`EACCES`) runs before content limits so
 * a denial never leaks storage policy. It never seals `ctx.result`, always
 * passing execution down the pipeline.
 */
export class NormalizerDriver implements FileDriver {
  private readonly mountPoint: string;
  private readonly maxSize?: number | string;
  private readonly maxEncodingSize: number | string;
  private readonly allowedTypes?: string[];

  /** Binds resolution to `mountPoint` with `maxSize`, `maxEncodingSize`, and `allowedTypes` budgets. */
  constructor(options?: FileDriverOptions) {
    this.mountPoint = options?.mountPoint ?? '/';
    this.maxSize = options?.maxSize;
    this.maxEncodingSize = options?.maxEncodingSize ?? DEFAULT_MAX_ENCODING_SIZE;
    this.allowedTypes = options?.allowedTypes;
  }

  /** Validates boundaries (`EACCES`) and enforces trailing-slash directory form. Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async mkdir(ctx: DriverContext<FileInfo>, path: string, options?: MkdirOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'mkdir');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`), MIME format and `allowedTypes` (`EINVAL`), and payload size against `maxSize`/`maxEncodingSize` (`EFBIG`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`, and for a `url` write, `ctx.content`. */
  async write(ctx: DriverContext<FileInfo>, path: string, data: FileInput, options?: WriteOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'write');
    if (options?.encoding === 'url') {
      this.checkEncodedSize(data, options.encoding);
      ctx.content = await this.resolveContent(ctx, data, options);
    } else {
      this.checkType(resolveType(data, options));
      this.checkWriteSize(data, options?.encoding);
    }
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`) and the encoded-transfer budget (`EFBIG`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async read(ctx: DriverContext<unknown>, path: string, options?: ReadOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'read');
    this.checkEncodedRead(options?.encoding);
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async stat(ctx: DriverContext<FileInfo | undefined>, path: string, options?: StatOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'stat');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async exists(ctx: DriverContext<boolean>, path: string, options?: ExistsOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'exists');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`); an omitted path resolves against `ctx.cwd`. Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async list(ctx: DriverContext<ListResult>, path?: string, options?: ListOptions): Promise<void> {
    const target = path ?? '';
    const info = resolve(this.mountPoint, target, options?.cwd, 'list');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`). Populates `ctx.path`, `ctx.name`, `ctx.dirname`, and `ctx.cwd`. */
  async search(ctx: DriverContext<ListResult>, _query: string, options?: SearchOptions): Promise<void> {
    const info = resolve(this.mountPoint, '', options?.cwd, 'search');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries for source and destination (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd` from the source and `ctx.destination` from the destination. */
  async copy(ctx: DriverContext<boolean>, source: string, destination: string, options?: CopyOptions): Promise<void> {
    const origin = resolve(this.mountPoint, source, options?.cwd, 'copy');
    const target = resolve(this.mountPoint, destination, options?.cwd, 'copy');
    ctx.path = origin.path;
    ctx.name = origin.name;
    ctx.dirname = origin.directory;
    ctx.cwd = origin.cwd;
    ctx.destination = target.path;
  }

  /** Validates boundaries for source and destination (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd` from the source and `ctx.destination` from the destination. */
  async move(ctx: DriverContext<boolean>, source: string, destination: string, options?: MoveOptions): Promise<void> {
    const origin = resolve(this.mountPoint, source, options?.cwd, 'move');
    const target = resolve(this.mountPoint, destination, options?.cwd, 'move');
    ctx.path = origin.path;
    ctx.name = origin.name;
    ctx.dirname = origin.directory;
    ctx.cwd = origin.cwd;
    ctx.destination = target.path;
  }

  /** Validates boundaries for target and link path (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd` from the link path and `ctx.destination` from the target. */
  async link(ctx: DriverContext<FileInfo>, target: string, path: string, options?: LinkOptions): Promise<void> {
    const origin = resolve(this.mountPoint, target, options?.cwd, 'link');
    const info = resolve(this.mountPoint, path, options?.cwd, 'link');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
    ctx.destination = origin.path;
  }

  /** Validates boundaries (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async remove(ctx: DriverContext<boolean>, path: string, options?: RemoveOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'remove');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  /** Validates boundaries (`EACCES`). Populates `ctx.path`, `ctx.dirname`, and `ctx.cwd`. */
  async restore(ctx: DriverContext<FileInfo>, path: string, options?: RemoveOptions): Promise<void> {
    const info = resolve(this.mountPoint, path, options?.cwd, 'restore');
    ctx.path = info.path;
    ctx.name = info.name;
    ctx.dirname = info.directory;
    ctx.cwd = info.cwd;
  }

  private checkType(type: string): void {
    validateType(type);
    if (!isTypeAllowed(type, this.allowedTypes)) {
      throw new HandlerError('EINVAL', 'Invalid file type', new Error(`validateType: Unsupported MIME type '${type}'`));
    }
  }

  /**
   * Resolves what a `url` write's URL serves, once, for every medium to store, and checks its type.
   *
   * @param ctx - Pipeline context, given a compensation that releases a stream no medium consumed.
   * @param data - The URL.
   * @param options - Write options; an explicit `type` overrides the one the URL gives.
   * @returns The body, its byte size, and its type.
   */
  private async resolveContent(
    ctx: DriverContext<FileInfo>,
    data: FileInput,
    options: WriteOptions
  ): Promise<UrlContent> {
    const content = await resolveUrl(data, parseSize(this.maxSize ?? DEFAULT_MAX_SIZE));
    const body = content.body;
    if (body instanceof ReadableStream) {
      ctx.rollback.add(async () => {
        if (!body.locked) await body.cancel();
      });
    }
    content.type = options.type ?? content.type;
    this.checkType(content.type);
    return content;
  }

  private checkWriteSize(data: FileInput, encoding: FileEncoding | undefined): void {
    const raw = byteSize(data);
    if (!isSizeAllowed(raw, this.maxSize)) {
      throw new HandlerError(
        'EFBIG',
        'File size exceeds limit',
        new Error(`File size ${raw} exceeds maxSize ${this.maxSize}`)
      );
    }
    if (encoding === undefined) return;
    this.checkEncodedSize(data, encoding);
  }

  /** Refuses with `EFBIG` a payload whose wire representation exceeds `maxEncodingSize`. */
  private checkEncodedSize(data: FileInput, encoding: FileEncoding): void {
    const encoded = encodedSize(data, encoding);
    if (!isSizeAllowed(encoded, this.maxEncodingSize)) {
      throw new HandlerError(
        'EFBIG',
        'File size exceeds limit',
        new Error(`File size ${encoded} exceeds maxEncodingSize ${this.maxEncodingSize}`)
      );
    }
  }

  /** Encoded reads carry an unknown downstream payload, so a budget that cannot
   * fit even one byte forbids the transfer upfront. */
  private checkEncodedRead(encoding: FileEncoding | undefined): void {
    if (encoding === undefined) {
      return;
    }
    if (!isSizeAllowed(1, this.maxEncodingSize)) {
      throw new HandlerError(
        'EFBIG',
        'File size exceeds limit',
        new Error(`Encoded transfer exceeds maxEncodingSize ${this.maxEncodingSize}`)
      );
    }
  }
}

function byteSize(data: FileInput): number {
  if (typeof data === 'string') {
    return encoder.encode(data).length;
  }
  const sized = (data as { size?: unknown } | null)?.size;
  if (typeof sized === 'number') {
    return sized;
  }
  return encoder.encode(JSON.stringify(data)).length;
}

function encodedSize(data: FileInput, encoding: FileEncoding): number {
  if (encoding === 'json' && typeof data !== 'string') {
    return encoder.encode(JSON.stringify(data)).length;
  }
  return byteSize(data);
}
