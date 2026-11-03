import type { IRPCFile, IRPCFileMeta } from '@irpclib/irpc';

/**
 * Stages of the multi-step image upload workflow.
 */
export type UploadStep = 'original' | 'variants' | 'resize' | 'complete';
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/**
 * Progressive reactive state emitted during image upload.
 */
export type ImageUploadState = {
  /** Current step in the upload pipeline. */
  step?: UploadStep;

  /** Human-readable progress description for the current step. */
  progress?: string;

  /** Normalized path in storage (e.g. '/photos/vacation.png'). */
  path?: string;

  /** MIME type of the uploaded file matching standard File/Blob dict. */
  type?: string;

  /** Size in bytes. */
  size?: number;
};

export type ImageFileMeta = IRPCFileMeta & {
  width: number;
  height: number;
};

/**
 * Standard Cloudflare Worker fetch handler contract.
 */
export interface ImageWorkerHandler<Env = ImageWorkerEnv> {
  /**
   * IRPC endpoint path for upload and mutation operations.
   */
  endpoint: string;
  /**
   * Main fetch dispatch entry point for the Cloudflare Worker.
   */
  fetch(request: Request, env: Env): Promise<Response>;
}

export interface ImageOptions {
  /** Target output format. */
  format?: ImageFormat;

  /** Compression quality between 1 and 100. */
  quality?: number;

  /**
   * Maximum file size in bytes.
   * Files larger than this will be rejected with a 413 error.
   * @default 10485760 (10MB)
   */
  maxSize?: number;

  /**
   * Default resize variants to generate automatically on upload when not explicitly provided.
   */
  sizes?: Resize[];

  /**
   * Whitelist of permitted dimensions or presets.
   * On upload or on-demand delivery, sizes not matching this list are skipped.
   */
  allowedSizes?: (number | Resize)[];
}

/**
 * Configuration options for registering image IRPC constructors.
 */
export interface ImageConstructorConfig extends ImageOptions {
  /**
   * Optional folder prefix under which rendered variants are stored in R2.
   * When undefined (default), variants are stored co-located alongside the original file
   * as `${file}-${variant}.${ext}` for predictable public bucket URLs.
   *
   * @default undefined
   */
  variantPrefix?: string;
}

/**
 * Top-level configuration options for initializing the image service worker.
 */
export interface ImageWorkerConfig extends ImageConstructorConfig {
  /**
   * Whether on-demand dynamic resizing via the container is permitted on cache misses.
   * When false, only pre-rendered variants stored in R2 will be served.
   * @default true
   */
  onDemand?: boolean;

  /**
   * Custom IRPC endpoint path for upload and mutation operations.
   * Useful when embedding within a full-stack application to prevent route collision.
   * @default '/irpc'
   */
  endpoint?: string;

  /**
   * Cache control parameters.
   */
  cache?: {
    /**
     * Browser Cache-Control max-age in seconds.
     * @default 86400 (1 day)
     */
    browserTtl?: number;

    /**
     * Cloudflare Edge Cache s-maxage in seconds.
     * @default 2592000 (30 days)
     */
    edgeTtl?: number;
  };
}

/**
 * Client-side configuration options for @irpclib/r2-image.
 */
export interface ClientConfig extends ImageOptions {
  /**
   * Base URL of the image service (e.g. 'https://images.example.com').
   */
  baseUrl?: string;

  /**
   * Custom IRPC endpoint path for upload and mutation operations (e.g. '/r2-image-irpc').
   * @default '/irpc'
   */
  endpoint?: string;

  /**
   * Optional secret API key for signing mutating operations.
   */
  apiKey?: string;

  /**
   * Whether on-demand dynamic resizing via the container is permitted.
   * When false, client resize is enforced.
   * @default true
   */
  onDemand?: boolean;
}

// --------------------------------------------------------------------------
// Domain Models & Request Payloads
// --------------------------------------------------------------------------

/**
 * Metadata inspection details for a stored image.
 */
export type ImageMetadata = {
  /** Normalized path in storage (e.g. '/photos/vacation.png'). */
  path: string;

  /** MIME type matching standard File/Blob dict. */
  type: string;

  /** Size in bytes. */
  size: number;

  /** ISO timestamp when the file was uploaded. */
  uploadedAt: string;

  /** Entity tag (ETag) of the R2 object. */
  etag: string;
};

/**
 * Resize specifications for generating an image variant.
 */
export interface Resize {
  /** Optional semantic variant name (e.g. 'thumbnail', 'avatar', 'cover'). */
  name?: string;

  /** Target bounding box size capping the longest edge in pixels. */
  size?: number;

  /** Target width in pixels. */
  width?: number;

  /** Target height in pixels. */
  height?: number;

  /** Target output format. */
  format?: ImageFormat;

  /** Compression quality between 1 and 100. */
  quality?: number;

  /** Fitting/crop mode. */
  fit?: 'cover' | 'contain' | 'inside';

  /** Optional blur radius for placeholders/LQIP. */
  blur?: number;
}

/**
 * Client-resized variant to be persisted directly into storage without invoking the container.
 */
export interface Variant extends Resize {
  /** Client-rendered image file. */
  file: IRPCFile;
}

/**
 * Acceptable input image source for local resizing.
 */
export type ImageSource = IRPCFile | Blob | Uint8Array | ArrayBuffer;

/**
 * Options provided when uploading an image.
 */
export interface ImageUploadOptions {
  /** Target sizes for eager server-side resizing via the container. */
  sizes?: Resize[];

  /** Client-resized variants to store directly into R2. */
  variants?: Variant[];
}

// --------------------------------------------------------------------------
// Cloudflare Environment & Primitives
// --------------------------------------------------------------------------

/**
 * Expected Cloudflare environment variables and bindings.
 */
export interface ImageWorkerEnv {
  /** R2 bucket binding storing original images and cached variants. */
  IMAGES: R2Bucket;

  /** Container binding: Durable Object Container namespace, Service Binding Fetcher, or URL string. */
  RESIZER: DurableObjectNamespace | Fetcher | string;

  /** Optional API key required for upload and mutation operations. */
  R2_IMAGE_API_KEY?: string;

  /** Optional comma-separated list of allowed origins for access control and hotlinking prevention. */
  R2_IMAGE_ORIGINS?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
  name?: string;
}

export interface DurableObjectStub extends Fetcher {
  readonly id: DurableObjectId;
  readonly name?: string;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions
  ): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
  customMetadata?: Record<string, string>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}
