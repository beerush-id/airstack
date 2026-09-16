import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { IRPCFile } from '@irpclib/irpc';

/**
 * Open wire payload where the shape is caller-owned.
 *
 * Concern: lets JSON-compatible write/read surfaces stay permissive
 * without widening the storage contract.
 */
export type AnyType = any;

/**
 * Unified write payload crossing the filesystem boundary.
 *
 * Concern: one end-to-end write contract, so binary stays encapsulated
 * and encoded representations stay independent of stored bytes.
 */
export type FileInput = IRPCFile | string | Record<string, AnyType> | AnyType[];

/**
 * Lifecycle operation governed by capability rules.
 *
 * Concern: single vocabulary for authorization, resolution, and
 * driver pipeline handling.
 */
export type FileOperation =
  | 'mkdir'
  | 'write'
  | 'read'
  | 'stat'
  | 'exists'
  | 'list'
  | 'search'
  | 'copy'
  | 'move'
  | 'link'
  | 'remove'
  | 'restore';

/**
 * Authorized path and capability rule for shared access.
 *
 * Concern: grants cross-home collaboration without path drift;
 * omitted capabilities mean full access to the matched scope.
 */
export type AccessRule = {
  path: string;
  allow?: FileOperation[];
};

/**
 * Shorthand or explicit form of a shared-access grant.
 *
 * Concern: keeps common open grants terse while preserving
 * operation-scoped control where needed.
 */
export type AccessRuleEntry = string | AccessRule;

/**
 * Ambient execution context for filesystem scope and trust.
 *
 * Concern: carries actor identity, home scope, shared-access grants,
 * and privileged override without threading them through every call.
 */
export type FsContext = {
  ownerId?: string;
  onBehalf?: string;
  homeDir?: string;
  accessRules?: AccessRuleEntry[];
  enforced?: boolean;
};

/**
 * Discriminated wire representation for encoded transfers.
 *
 * Concern: declares the representation crossing the wire independently
 * of stored bytes, keeping read and write encodings decoupled.
 */
export type FileEncoding = 'json' | 'text' | 'base64' | 'data-url';

/**
 * Resolved path descriptor from inward resolution.
 *
 * Concern: gives every driver the same canonical target, storage key,
 * and working-directory scope for the current call.
 */
export type PathInfo = {
  path: string;
  name: string;
  directory: string;
  cwd: string;
};

/**
 * Pure filesystem stat descriptor for a stored entry.
 *
 * Concern: describes what is stored and how it is visible; tenancy
 * stays a re-bindable dimension and never surfaces here.
 */
export type FileInfo = {
  path: string;
  name: string;
  size: number;
  type: string;
  mtime: Date;
  etag?: string;
  isDirectory: boolean;
  public?: boolean;
  hidden?: boolean;
  link?: string;
  deletedAt?: Date;
  metadata?: Record<string, string>;
};

/**
 * Base per-call scope for working directory and identity.
 *
 * Concern: anchors relative paths and impersonated authorship
 * for a single operation.
 */
export type FileOptions = {
  cwd?: string;
  onBehalf?: string;
};

/**
 * Creation scope with visibility and caller metadata.
 *
 * Concern: lets new entries declare openness and attached
 * attributes at creation time.
 */
export type FileCreateOptions = FileOptions & {
  public?: boolean;
  metadata?: Record<string, string>;
};

/**
 * Read scope with requested wire representation.
 *
 * Concern: selects the decoded form returned to the caller
 * without changing what is stored.
 *
 * @template E Requested wire representation; omitted means binary delivery.
 */
export type ReadOptions<E extends FileEncoding | undefined = FileEncoding | undefined> = FileOptions & {
  encoding?: E;
};

/**
 * Scoped lookup for entry metadata.
 *
 * Concern: pins stat calls to the same per-call scope as all queries, and
 * exposes the same `trash` opt-in as listings so a soft-deleted entry can be
 * resolved deliberately instead of only read as absent.
 */
export type StatOptions = FileOptions & {
  trash?: boolean;
};

/**
 * Scoped lookup for entry presence.
 *
 * Concern: pins presence checks to the same per-call scope as all queries.
 */
export type ExistsOptions = FileOptions;

/**
 * Scoped relocation within the same per-call scope.
 *
 * Concern: keeps moves anchored to working directory and identity
 * without extra creation attributes.
 */
export type MoveOptions = FileOptions;

/**
 * Duplication scope with destination visibility.
 *
 * Concern: carries openness to the duplicated entry while sharing
 * the base per-call scope.
 */
export type CopyOptions = FileOptions & {
  public?: boolean;
};

/**
 * Directory creation scope.
 *
 * Concern: reuses the creation contract so directories and files
 * declare visibility and metadata identically.
 */
export type MkdirOptions = FileCreateOptions;

/**
 * Alias creation scope.
 *
 * Concern: reuses the creation contract so links carry the same
 * visibility and metadata as the entries they point to.
 */
export type LinkOptions = FileCreateOptions;

/**
 * Write scope with stored shape and wire representation.
 *
 * Concern: declares stored content description, visibility, and the
 * inbound representation independently of how reads decode it.
 *
 * @template E Inbound wire representation; omitted means binary payload.
 */
export type WriteOptions<E extends FileEncoding | undefined = FileEncoding | undefined> = FileCreateOptions & {
  type?: string;
  hidden?: boolean;
  encoding?: E;
};

/**
 * Single listing order with direction by sign prefix.
 *
 * Concern: one vocabulary for relational and storage ordering,
 * including visibility and lifecycle dimensions.
 */
export type SortOrder =
  | 'name'
  | '-name'
  | 'size'
  | '-size'
  | 'mtime'
  | '-mtime'
  | 'type'
  | '-type'
  | 'hidden'
  | '-hidden'
  | 'public'
  | '-public'
  | 'deletedAt'
  | '-deletedAt';

/**
 * Listing order as one key or an ordered multi-key sequence.
 *
 * Concern: supports single-field and compound ordering without
 * a separate compound type.
 */
export type Sort = SortOrder | SortOrder[];

/**
 * Bounded predicate for a filterable dimension.
 *
 * Concern: expresses lower and upper bounds uniformly across
 * numeric and time dimensions.
 *
 * @template T Bound value shape for the filtered dimension.
 */
export type Range<T = number> = {
  min?: T;
  max?: T;
};

/**
 * Listing predicate over stored entry attributes.
 *
 * Concern: narrows directory and search results by visibility,
 * lifecycle, size, time, and caller metadata.
 */
export type FileFilter = {
  public?: boolean;
  type?: string;
  deleted?: boolean;
  size?: Range<number>;
  mtime?: Range<Date | number>;
  metadata?: Record<string, string>;
};

/**
 * Directory listing scope with paging, order, and predicates.
 *
 * Concern: keeps dense index queries expressive while hiding
 * physical mount details from callers.
 */
export type ListOptions = FileOptions & {
  recursive?: boolean;
  limit?: number;
  cursor?: string;
  all?: boolean;
  trash?: boolean;
  sort?: Sort;
  filter?: FileFilter;
};

/**
 * One listing page with continuation state.
 *
 * Concern: carries dense index results plus the cursor for the
 * next page, including empty pages as explicit results.
 */
export type ListResult = {
  entries: FileInfo[];
  nextCursor?: string;
};

/**
 * Name and metadata search scope anchored to working directory.
 *
 * Concern: reuses the listing contract for index queries where
 * recursion has no meaning.
 */
export type SearchOptions = Omit<ListOptions, 'recursive'>;

/**
 * Deletion intent with safety and lifecycle control.
 *
 * Concern: separates recursive descent, permanent purge, and
 * trash lifecycle so safe defaults never accumulate hidden cost.
 */
export type RemoveOptions = FileOptions & {
  recursive?: boolean;
  force?: boolean;
  soft?: boolean;
};

/**
 * Wire-safe deletion intent for external callers.
 *
 * Concern: exposes the trash lifecycle across the network while
 * keeping permanent purge a server-side decision under strict policy.
 */
export type IRPCRemoveOptions = Omit<RemoveOptions, 'force'>;

/**
 * Shared storage constraints and mount scope for all layers.
 *
 * Concern: one configuration source for mounting, tenancy binding,
 * deletion safety, and content limits from drivers to edge delivery.
 */
export interface FileDriverOptions {
  mountPoint?: string;
  ownerKey?: string;
  strict?: boolean;
  softDelete?: boolean;
  maxSize?: number | string;
  maxEncodingSize?: number | string;
  allowedTypes?: string[];
}

/**
 * Blob storage constraints for the R2 medium.
 *
 * Concern: scopes the shared storage contract to binary persistence.
 */
export interface R2DriverOptions extends FileDriverOptions {}

/**
 * Relational index constraints for the D1 medium.
 *
 * Concern: extends the shared storage contract with searchable
 * metadata dimensions for dense listings.
 */
export interface D1DriverOptions extends FileDriverOptions {
  indexableKeys?: string[];
}

/**
 * Standalone filesystem wiring with optional media.
 *
 * Concern: one place to attach index and blob media plus the shared
 * constraints they both enforce.
 */
export interface FileAdapterOptions extends FileDriverOptions {
  bucket?: R2Bucket;
  indexer?: D1Database;
  indexableKeys?: string[];
}

/**
 * Reverse-order compensation for a failed pipeline.
 *
 * Concern: undoes a driver's partial mutation so multi-medium
 * operations stay atomic from the caller's view.
 *
 * @returns Optional promise settling when the compensation completes.
 */
export type RollbackFn = () => Promise<void> | void;

/**
 * One-shot pipeline state for a single operation invocation.
 *
 * Concern: carries resolved paths, cached source metadata, terminal
 * result sealing, and failure compensation across the driver chain.
 *
 * @template T Terminal result shape sealed by the capable driver.
 */
export type DriverContext<T = unknown> = {
  path: string;
  name: string;
  dirname: string;
  cwd: string;
  destination?: string;
  info?: FileInfo;
  rollback: Set<RollbackFn>;
  result?: T;
};
