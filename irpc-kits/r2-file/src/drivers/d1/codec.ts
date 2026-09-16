import { type AnyType, IRPCFile } from '@irpclib/irpc';
import { DEFAULT_MAX_ENCODING_SIZE } from '../../context.js';
import type { FileEncoding, FileInfo, FileInput, WriteOptions } from '../../types.js';
import { parseSize } from '../../utils/type.js';

const DEFAULT_MAX_ENCODING_BYTES = parseSize(DEFAULT_MAX_ENCODING_SIZE);

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

  let content: string;
  if (options?.encoding === 'base64' && typeof data === 'string') {
    content = Buffer.from(data, 'base64').toString('utf-8');
  } else if (options?.encoding === 'data-url' && typeof data === 'string') {
    const raw = data.slice(data.indexOf(',') + 1);
    content = data.includes(';base64') ? Buffer.from(raw, 'base64').toString('utf-8') : decodeURIComponent(raw);
  } else if (typeof data === 'string') {
    content = data;
  } else {
    content = JSON.stringify(data);
  }

  const size = Buffer.byteLength(content, 'utf-8');
  return {
    content,
    size,
    type: options?.type as string,
    shouldInline: size <= maxEncodingBytes,
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
export function decodePayload(raw: string, type: string, encoding?: FileEncoding): AnyType {
  if (encoding === 'text') {
    return raw;
  }
  if (encoding === 'json') {
    return JSON.parse(raw);
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
    metadata: effective.metadata ? JSON.parse(effective.metadata) : undefined,
  };
}
