import { type AnyType, HandlerError, IRPCFile } from '@irpclib/irpc';
import { DEFAULT_MAX_ENCODING_SIZE } from '../../context.js';
import type { FileEncoding, FileInfo, FileInput, UrlContent, WriteOptions } from '../../types.js';
import { parseSize, resolveType } from '../../utils/type.js';

const DEFAULT_MAX_ENCODING_BYTES = parseSize(DEFAULT_MAX_ENCODING_SIZE);

/** Strict UTF-8 decoding: invalid bytes throw rather than turn into U+FFFD. */
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Encapsulates prepared payload details for relational metadata storage and inlining.
 */
export type PreparedPayload = {
  content: string | null;
  size: number;
  type: string;
  shouldInline: boolean;
};

/**
 * Normalizes an inbound write payload into metadata attributes and conditional inline text.
 *
 * @param data - Inbound file payload.
 * @param options - Write options declaring explicit type and encoding.
 * @param maxEncodingBytes - Maximum allowable size for SQLite payload inlining.
 * @returns Serialized payload attributes.
 */
export function preparePayload(
  data: FileInput,
  options?: WriteOptions,
  maxEncodingBytes: number = DEFAULT_MAX_ENCODING_BYTES
): PreparedPayload {
  if (data instanceof IRPCFile) {
    return {
      content: null,
      size: data.meta.size,
      type: data.meta.type,
      shouldInline: false,
    };
  }

  if (options?.encoding === 'base64' && typeof data === 'string') {
    return prepareBytes(Buffer.from(data, 'base64'), resolveType(data, options), maxEncodingBytes);
  }
  if (options?.encoding === 'data-url' && typeof data === 'string' && data.includes(';base64')) {
    const raw = data.slice(data.indexOf(',') + 1);
    return prepareBytes(Buffer.from(raw, 'base64'), resolveType(data, options), maxEncodingBytes);
  }

  let content: string;
  try {
    if (options?.encoding === 'data-url' && typeof data === 'string') {
      content = decodeURIComponent(data.slice(data.indexOf(',') + 1));
    } else if (typeof data === 'string') {
      content = data;
    } else {
      content = JSON.stringify(data);
    }
  } catch (cause) {
    throw new HandlerError('EINVAL', 'Invalid file content', cause as Error);
  }

  const size = Buffer.byteLength(content, 'utf-8');
  return {
    content,
    size,
    type: resolveType(data, options),
    shouldInline: size <= maxEncodingBytes,
  };
}

/**
 * Prepares what a `url` write resolved to for the index: bytes in hand are inlined like any
 * decoded payload, while a stream is left whole to the blob medium, recorded by its size.
 *
 * @param content - Resolved URL content.
 * @param maxEncodingBytes - Maximum allowable size for SQLite payload inlining.
 * @returns Serialized payload attributes.
 */
export function prepareContent(content: UrlContent, maxEncodingBytes: number): PreparedPayload {
  if (content.body instanceof Uint8Array) {
    return prepareBytes(content.body, content.type, maxEncodingBytes);
  }
  return { content: null, size: content.size, type: content.type, shouldInline: false };
}

/**
 * Prepares decoded bytes for the index, inlining them only as the text they exactly are.
 *
 * Concern: inlined content is stored as text, and bytes that aren't valid UTF-8, such as an
 * image, can't survive that round trip, so they are left to the blob medium to serve.
 *
 * @param bytes - Decoded payload bytes.
 * @param type - MIME type to store.
 * @param maxEncodingBytes - Maximum allowable size for SQLite payload inlining.
 * @returns Serialized payload attributes, with `content` `null` when the bytes aren't text.
 */
export function prepareBytes(bytes: Uint8Array, type: string, maxEncodingBytes: number): PreparedPayload {
  const content = textOf(bytes);
  return {
    content,
    size: bytes.byteLength,
    type,
    shouldInline: content !== null && bytes.byteLength <= maxEncodingBytes,
  };
}

/**
 * Decodes inlined raw text content into the caller's requested wire representation.
 *
 * @param raw - Stored raw UTF-8 string.
 * @param type - File MIME type.
 * @param encoding - Requested wire representation.
 * @returns Decoded value formatted as requested.
 */
export function decodePayload(raw: string, type: string, encoding: FileEncoding): AnyType {
  if (encoding === 'text') {
    return raw;
  }
  if (encoding === 'json') {
    return parseJson(raw, 'EINVAL', 'Invalid JSON content');
  }
  if (encoding === 'base64') {
    return Buffer.from(raw, 'utf-8').toString('base64');
  }
  if (encoding === 'data-url') {
    const b64 = Buffer.from(raw, 'utf-8').toString('base64');
    return `data:${type};base64,${b64}`;
  }
  return raw;
}

/**
 * Transforms a D1 database record and optional dynamic symlink target into a clean FileInfo.
 *
 * @param row - Primary database row from `_r2_files`.
 * @param targetRow - Optional dynamically resolved target row when `row.link` is set.
 * @returns Typed `FileInfo` stat descriptor.
 */
export function toFileInfo(row: Record<string, AnyType>, targetRow?: Record<string, AnyType> | null): FileInfo {
  const effective = targetRow ?? row;
  return {
    path: row.path,
    name: row.name,
    size: effective.size,
    type: effective.type,
    mtime: new Date(effective.mtime),
    etag: effective.etag ?? undefined,
    isDirectory: effective.type === 'inode/directory',
    public: Boolean(effective.public),
    hidden: Boolean(effective.hidden),
    link: row.link ?? undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    metadata: effective.metadata ? parseJson(effective.metadata, 'EIO', 'Failed to read file metadata') : undefined,
  };
}

/**
 * Parses JSON while retaining decoding failures as internal causes of filesystem errors.
 *
 * @param raw - Serialized JSON value.
 * @param code - Filesystem error code for invalid content or corrupt metadata.
 * @param message - Safe public description of the failure.
 * @returns The decoded JSON value.
 * @throws {HandlerError} When the value cannot be parsed as JSON.
 */
function parseJson(raw: string, code: 'EINVAL' | 'EIO', message: string): AnyType {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new HandlerError(code, message, cause as Error);
  }
}

/** Decodes bytes as UTF-8 text, keeping a byte order mark, or answers `null` when they aren't text. */
function textOf(bytes: Uint8Array): string | null {
  try {
    return utf8.decode(bytes);
  } catch {
    return null;
  }
}
