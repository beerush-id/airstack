import { HTTPTransport } from '@irpclib/http';
import type { IRPCBlob } from '@irpclib/irpc';
import { createPackage, HandlerError, IRPCFile } from '@irpclib/irpc';
import type {
  AnyType,
  CopyOptions,
  ExistsOptions,
  FileInfo,
  FileInput,
  FileOptions,
  IRPCRemoveOptions,
  LinkOptions,
  ListOptions,
  ListResult,
  MkdirOptions,
  MoveOptions,
  ReadOptions,
  SearchOptions,
  StatOptions,
  WriteOptions,
} from './types.js';

export type * from './types.js';

/**
 * Where the client points when calling a remote filesystem worker:
 * its origin, its RPC endpoint, and the API key attached to requests.
 */
export type ClientConfig = {
  baseUrl?: string;
  endpoint?: string;
  apiKey?: string;
};

/**
 * The IRPC package every r2-file call belongs to. Server-side code
 * registers its handlers on this package via `implement()`.
 */
export const fileModule = createPackage({
  name: 'r2-file',
  version: '1.0.0',
});

/**
 * HTTP transport carrying every stub call; targets same-origin
 * `/irpc` until `configure` points it elsewhere.
 */
export const transport = new HTTPTransport({ endpoint: '/irpc' });
fileModule.use(transport);

/**
 * The filesystem settings your calls run under: the remote origin in
 * use and the payload limits `write` enforces before upload —
 * `maxSize` starts at 25MB (26214400 bytes), `maxEncodingSize` at
 * 500KB (512000 bytes).
 */
export const FS_CONFIG: { baseUrl: string; maxSize: number; maxEncodingSize: number } = {
  baseUrl: '',
  maxSize: 26214400,
  maxEncodingSize: 512000,
};

/**
 * Points the client at a remote filesystem worker and attaches API key
 * credentials to every subsequent call.
 *
 * @param config Remote origin, RPC endpoint, and API key
 */
export function configure(config: ClientConfig): void {
  if (config.baseUrl !== undefined) {
    FS_CONFIG.baseUrl = config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : '';
    transport.config.baseURL = FS_CONFIG.baseUrl;
  }

  if (config.endpoint !== undefined) {
    transport.config.endpoint = config.endpoint;
  }

  if (config.apiKey) {
    transport.sign({ apiKey: config.apiKey });
  }
}

/**
 * Initial descriptor shown by readers before a call resolves, for
 * operations that always return a `FileInfo`.
 */
const seedFileInfo = (): FileInfo => ({
  path: '',
  name: '',
  size: 0,
  type: '',
  mtime: new Date(),
  isDirectory: false,
});

/**
 * Initial empty page shown by readers before a call resolves, for
 * listing operations.
 */
const seedListResult = (): ListResult => ({ entries: [] });

/**
 * Creates a directory.
 *
 * @param path Directory path (`~`, absolute, or relative to the working directory)
 * @param options Visibility and custom metadata for the new directory
 * @returns Metadata of the created directory
 */
export type MkdirFn = (path: string, options?: MkdirOptions) => Promise<FileInfo>;

/**
 * Registered write handler; the public `write` overloads narrow the
 * payload per input shape.
 *
 * @param path Target file path
 * @param data Binary file, text string, or JSON value
 * @param options Type, visibility, metadata, and representation
 * @returns Metadata of the written file
 */
type WriteStubFn = (path: string, data: FileInput, options?: WriteOptions) => Promise<FileInfo>;

/**
 * Registered read handler; the public `read` overloads narrow the
 * result per requested representation.
 *
 * @param path Target file path
 * @param options Requested representation
 * @returns Blob, decoded string, parsed JSON, or `undefined` when the file does not exist
 */
type ReadStubFn = (
  path: string,
  options?: ReadOptions
) => Promise<IRPCBlob | string | Record<string, AnyType> | AnyType[] | undefined>;

/**
 * Gets metadata for a file or directory without fetching its content.
 * For a link, returns the target's metadata. Pass `trash: true` to
 * resolve a soft-deleted entry.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Lookup scope, including the `trash` opt-in
 * @returns Entry metadata, or `undefined` when nothing is there
 */
export type StatFn = (path: string, options?: StatOptions) => Promise<FileInfo | undefined>;

/**
 * Checks whether a file or directory exists. Soft-deleted entries
 * count as missing.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Lookup scope
 * @returns `true` when the entry exists
 */
export type ExistsFn = (path: string, options?: ExistsOptions) => Promise<boolean>;

/**
 * Lists the entries inside a directory, one page at a time.
 *
 * @param path Directory to list; defaults to the working directory
 * @param options Page size, cursor, ordering, filters, hidden and trash visibility
 * @returns One page of entries, plus a cursor when more pages follow
 */
export type ListFn = (path?: string, options?: ListOptions) => Promise<ListResult>;

/**
 * Finds files by a name or metadata fragment. Without an index
 * deployed, always answers an empty page.
 *
 * @param query Fragment to match against names and indexed metadata
 * @param options Page size, cursor, ordering, and filters
 * @returns One page of matches, plus a cursor when more pages follow
 */
export type SearchFn = (query: string, options?: SearchOptions) => Promise<ListResult>;

/**
 * Copies a file, or a directory with everything inside it. Rejects
 * when the destination already exists — remove it first to replace.
 *
 * @param source Path to copy from
 * @param destination Path to copy to
 * @param options Visibility for the copy
 * @returns `true` when the copy completes
 */
export type CopyFn = (source: string, destination: string, options?: CopyOptions) => Promise<boolean>;

/**
 * Moves a file, or a directory with everything inside it. Rejects
 * when the destination already exists — remove it first to replace.
 *
 * @param source Path to move from
 * @param destination Path to move to
 * @param options Move scope
 * @returns `true` when the move completes
 */
export type MoveFn = (source: string, destination: string, options?: MoveOptions) => Promise<boolean>;

/**
 * Creates a shortcut (symbolic link) to another path. Reading or
 * statting the link always gets the target's current content and
 * metadata.
 *
 * @param target Path the link points to
 * @param path Path the link is created at
 * @param options Visibility and custom metadata for the link
 * @returns Metadata of the created link, including the target path
 */
export type LinkFn = (target: string, path: string, options?: LinkOptions) => Promise<FileInfo>;

/**
 * Deletes a file, or with `recursive: true` a directory and everything
 * inside it. With `soft: true` the entry goes to the trash instead and
 * can be brought back with `restore`.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Recursion and trash behavior
 * @returns `true` when something was deleted, `false` when it was already gone
 */
export type RemoveFn = (path: string, options?: IRPCRemoveOptions) => Promise<boolean>;

/**
 * Brings a soft-deleted entry back from the trash, with its original
 * metadata intact.
 *
 * @param path Trashed entry path
 * @param options Restoration scope
 * @returns Metadata of the restored entry
 */
export type RestoreFn = (path: string, options?: FileOptions) => Promise<FileInfo>;

/**
 * Creates a directory.
 *
 * @param path Directory path (`~`, absolute, or relative to the working directory)
 * @param options Visibility and custom metadata for the new directory
 * @returns Metadata of the created directory
 */
export const mkdir = fileModule.declare<MkdirFn>('mkdir', seedFileInfo);

/**
 * Wire-level write stub the public `write` overloads delegate to;
 * server implementations register their handler on this stub.
 */
export const writeStub = fileModule.declare<WriteStubFn>('write', seedFileInfo);

// Bundled on both client and server: the size budget is enforced before upload and again on arrival.
fileModule.hook(writeStub, (req) => {
  const data = req.args[1];
  const options = req.args[2];

  if (data instanceof IRPCFile && data.meta.size > FS_CONFIG.maxSize) {
    throw new HandlerError(
      'EFBIG',
      'File size exceeds limit',
      new Error(`write: File size ${data.meta.size} exceeds maxSize ${FS_CONFIG.maxSize}`)
    );
  }

  if (typeof data === 'string' && data.length > FS_CONFIG.maxEncodingSize) {
    throw new HandlerError(
      'EFBIG',
      'File size exceeds limit',
      new Error(`write: String length ${data.length} exceeds maxEncodingSize ${FS_CONFIG.maxEncodingSize}`)
    );
  }

  /* istanbul ignore next */
  if (typeof data === 'string') {
    req.args[2] = { encoding: 'text', ...options };
  } else if (data && typeof data === 'object') {
    req.args[2] = { encoding: 'json', ...options };
  }
});

/**
 * Writes a binary file. The file's metadata carries its name and
 * MIME type. Rejects with `EFBIG` before upload when the file exceeds
 * `FS_CONFIG.maxSize`.
 *
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param data Binary payload as an `IRPCFile`
 * @param options Visibility and custom metadata
 * @returns Metadata of the written file
 */
export function write(path: string, data: IRPCFile, options?: WriteOptions): Promise<FileInfo>;
/**
 * Writes a text file; its type is `text/plain` unless you give one.
 * Pass `encoding: 'base64'` or `'data-url'` when the string is in that
 * representation instead of plain text. Rejects with `EFBIG` before
 * upload when the string exceeds `FS_CONFIG.maxEncodingSize`.
 *
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param data Text content
 * @param options Type, visibility, custom metadata, and string representation
 * @returns Metadata of the written file
 */
export function write(
  path: string,
  data: string,
  options?: WriteOptions<'text' | 'base64' | 'data-url'>
): Promise<FileInfo>;
/**
 * Writes a JSON file from an object or array; its type is
 * `application/json`.
 *
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param data JSON-compatible value
 * @param options Visibility and custom metadata
 * @returns Metadata of the written file
 */
export function write(
  path: string,
  data: Record<string, AnyType> | AnyType[],
  options?: WriteOptions<'json'>
): Promise<FileInfo>;
export function write(path: string, data: FileInput, options?: WriteOptions): Promise<FileInfo> {
  return writeStub(path, data, options) as never;
}

/**
 * Wire-level read stub the public `read` overloads delegate to;
 * server implementations register their handler on this stub.
 */
export const readStub = fileModule.declare<ReadStubFn>('read');

/**
 * Reads a file as an `IRPCBlob`. Get its content with `.text()`,
 * `.arrayBuffer()`, `.stream()`, or `.slice()`.
 *
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param options Read scope
 * @returns The file as a blob, or `undefined` when it does not exist
 */
export function read(path: string, options?: ReadOptions): Promise<IRPCBlob | undefined>;
/**
 * Reads a file as a string: plain `text`, `base64`, or a ready-to-use
 * `data:` URL.
 *
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param options Requested representation: `text`, `base64`, or `data-url`
 * @returns The file content as a string, or `undefined` when it does not exist
 */
export function read(path: string, options: ReadOptions<'text' | 'base64' | 'data-url'>): Promise<string | undefined>;
/**
 * Reads a file and parses its content as JSON.
 *
 * @typeParam T Shape of the parsed value
 * @param path Target file path (`~`, absolute, or relative to the working directory)
 * @param options `encoding: 'json'`
 * @returns The parsed value, or `undefined` when the file does not exist
 */
export function read<T = unknown>(path: string, options: ReadOptions<'json'>): Promise<T | undefined>;
export function read(path: string, options?: ReadOptions): Promise<IRPCBlob | string | AnyType | undefined> {
  return readStub(path, options);
}

/**
 * Gets metadata for a file or directory without fetching its content.
 * For a link, returns the target's metadata. Pass `trash: true` to
 * resolve a soft-deleted entry.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Lookup scope, including the `trash` opt-in
 * @returns Entry metadata, or `undefined` when nothing is there
 */
export const stat = fileModule.declare<StatFn>('stat');

/**
 * Checks whether a file or directory exists. Soft-deleted entries
 * count as missing.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Lookup scope
 * @returns `true` when the entry exists
 */
export const exists = fileModule.declare<ExistsFn>('exists', () => false);

/**
 * Lists the entries inside a directory, one page at a time.
 *
 * @param path Directory to list; defaults to the working directory
 * @param options Page size, cursor, ordering, filters, hidden and trash visibility
 * @returns One page of entries, plus a cursor when more pages follow
 */
export const list = fileModule.declare<ListFn>('list', seedListResult);

/**
 * Finds files by a name or metadata fragment. Without an index
 * deployed, always answers an empty page.
 *
 * @param query Fragment to match against names and indexed metadata
 * @param options Page size, cursor, ordering, and filters
 * @returns One page of matches, plus a cursor when more pages follow
 */
export const search = fileModule.declare<SearchFn>('search', seedListResult);

/**
 * Copies a file, or a directory with everything inside it. Rejects
 * when the destination already exists — remove it first to replace.
 *
 * @param source Path to copy from
 * @param destination Path to copy to
 * @param options Visibility for the copy
 * @returns `true` when the copy completes
 */
export const copy = fileModule.declare<CopyFn>('copy', () => false);

/**
 * Moves a file, or a directory with everything inside it. Rejects
 * when the destination already exists — remove it first to replace.
 *
 * @param source Path to move from
 * @param destination Path to move to
 * @param options Move scope
 * @returns `true` when the move completes
 */
export const move = fileModule.declare<MoveFn>('move', () => false);

/**
 * Creates a shortcut (symbolic link) to another path. Reading or
 * statting the link always gets the target's current content and
 * metadata.
 *
 * @param target Path the link points to
 * @param path Path the link is created at
 * @param options Visibility and custom metadata for the link
 * @returns Metadata of the created link, including the target path
 */
export const link = fileModule.declare<LinkFn>('link', seedFileInfo);

/**
 * Deletes a file, or with `recursive: true` a directory and everything
 * inside it. With `soft: true` the entry goes to the trash instead and
 * can be brought back with `restore`.
 *
 * @param path Target path (`~`, absolute, or relative to the working directory)
 * @param options Recursion and trash behavior
 * @returns `true` when something was deleted, `false` when it was already gone
 */
export const remove = fileModule.declare<RemoveFn>('remove', () => false);

/**
 * Brings a soft-deleted entry back from the trash, with its original
 * metadata intact.
 *
 * @param path Trashed entry path
 * @param options Restoration scope
 * @returns Metadata of the restored entry
 */
export const restore = fileModule.declare<RestoreFn>('restore', seedFileInfo);

export default {
  configure,
  mkdir,
  write,
  read,
  stat,
  exists,
  list,
  search,
  copy,
  move,
  link,
  remove,
  restore,
};
