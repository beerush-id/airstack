import type { FileInfo } from '../../types.js';

/** Internal filesystem system metadata stamped on R2 objects. */
export type R2Metadata = Record<string, string | undefined> & {
  _fs_type?: string;
  _fs_deleted?: string;
  _fs_link?: string;
  _fs_public?: string;
  _fs_hidden?: string;
};

export type HeadShape = {
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  customMetadata?: R2Metadata;
};

export type ListedShape = {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  customMetadata?: R2Metadata;
};

/**
 * Extracts caller-provided metadata while excluding internal `_fs_` stamps.
 *
 * @param meta - Stored custom metadata from object head.
 * @returns User-defined metadata record or undefined when empty.
 */
export function extractUserMetadata(meta?: R2Metadata): Record<string, string> | undefined {
  if (!meta) return undefined;
  const user: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!k.startsWith('_fs_') && v !== undefined) user[k] = v;
  }
  return Object.keys(user).length > 0 ? user : undefined;
}

/**
 * Parses a numeric or ISO soft-delete timestamp into a Date instance.
 *
 * @param stamp - Raw string stamp stored under `_fs_deleted`.
 * @returns Resolved deletion Date.
 */
export function parseDeletedAt(stamp: string): Date {
  const numeric = Number(stamp);
  return new Date(Number.isNaN(numeric) ? stamp : numeric);
}

/**
 * Builds an authoritative file `FileInfo` from a live R2 head.
 *
 * @param canonical - Canonical filesystem path.
 * @param head - R2 head result.
 * @param meta - Resolved custom metadata record.
 * @returns Populated file descriptor.
 */
export function fileInfoFromHead(canonical: string, head: HeadShape, meta?: R2Metadata): FileInfo {
  const name = canonical.slice(canonical.lastIndexOf('/') + 1);
  const metadata = extractUserMetadata(meta);
  const link = meta?._fs_link;
  const isLink = link !== undefined;
  return {
    path: canonical,
    name,
    size: isLink ? 0 : head.size,
    type: isLink ? 'inode/symlink' : (head.httpMetadata?.contentType ?? 'application/octet-stream'),
    mtime: head.uploaded,
    etag: head.etag,
    isDirectory: false,
    ...(isLink ? { link } : {}),
    ...(meta?._fs_public === 'true' ? { public: true } : {}),
    ...(meta?._fs_hidden === 'true' || name.startsWith('.') ? { hidden: true } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Builds a directory `FileInfo` from a live directory marker head.
 *
 * @param canonical - Canonical directory path.
 * @param head - R2 marker head result.
 * @param meta - Resolved custom metadata record.
 * @returns Zero-sized directory descriptor.
 */
export function directoryInfo(canonical: string, head?: Partial<HeadShape>, meta?: R2Metadata): FileInfo {
  const metadata = extractUserMetadata(meta);
  return {
    path: canonical,
    name: canonical.slice(canonical.lastIndexOf('/') + 1),
    size: 0,
    type: 'inode/directory',
    mtime: head?.uploaded ?? new Date(),
    ...(head?.etag !== undefined ? { etag: head.etag } : {}),
    isDirectory: true,
    ...(meta?._fs_public === 'true' ? { public: true } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Builds a listing entry from a standalone listed R2 object.
 *
 * @param object - Listed R2 object.
 * @param meta - Resolved custom metadata record.
 * @returns Formatted `FileInfo` entry.
 */
export function listEntry(object: ListedShape, meta?: R2Metadata): FileInfo {
  const isDir = object.key.endsWith('/') || (meta?._fs_type ?? '').includes('directory');
  const canonical = `/${isDir ? object.key.replace(/\/$/, '') : object.key}`;
  const name = canonical.slice(canonical.lastIndexOf('/') + 1);
  const metadata = extractUserMetadata(meta);
  return {
    path: canonical,
    name,
    size: isDir ? 0 : object.size,
    type: isDir ? 'inode/directory' : (object.httpMetadata?.contentType ?? 'application/octet-stream'),
    mtime: object.uploaded,
    etag: object.etag,
    isDirectory: isDir,
    ...(meta?._fs_link !== undefined ? { link: meta._fs_link } : {}),
    ...(meta?._fs_public === 'true' ? { public: true } : {}),
    ...(meta?._fs_hidden === 'true' || name.startsWith('.') ? { hidden: true } : {}),
    ...(meta?._fs_deleted !== undefined ? { deletedAt: parseDeletedAt(meta._fs_deleted) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Sorts file entries in place according to requested sort order.
 *
 * @param entries - List of entries to sort.
 * @param sort - One or more sort criteria (e.g. 'name', '-size', 'mtime').
 */
export function applySort(entries: FileInfo[], sort: string | string[]): void {
  const orders = Array.isArray(sort) ? sort : [sort];
  entries.sort((a, b) => {
    for (const s of orders) {
      const desc = s.startsWith('-');
      const field = desc ? s.slice(1) : s;
      let cmp = 0;
      switch (field) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'mtime':
          cmp = a.mtime.getTime() - b.mtime.getTime();
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'hidden':
          cmp = Number(a.hidden ?? false) - Number(b.hidden ?? false);
          break;
        case 'public':
          cmp = Number(a.public ?? false) - Number(b.public ?? false);
          break;
        case 'deletedAt':
          cmp = (a.deletedAt?.getTime() ?? 0) - (b.deletedAt?.getTime() ?? 0);
          break;
      }
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}
