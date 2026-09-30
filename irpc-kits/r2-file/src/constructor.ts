import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { credential, getContext, GuardError, IRPCBlob } from '@irpclib/irpc';
import type { FileAdapter } from './adapter.js';
import { createFs } from './fs/index.js';
import {
  copy,
  exists,
  fileModule,
  link,
  list,
  mkdir,
  move,
  readStub,
  remove,
  restore,
  search,
  stat,
  writeStub,
} from './index.js';
import type { FileAdapterOptions, FileEncoding, ReadOptions } from './types.js';
import { signUrl } from './utils/security.js';

/**
 * Server-side wiring options for the filesystem stubs.
 *
 * Pass `adapter` to serve a filesystem you built yourself, or pass the
 * storage bindings and constraints to have one built for you.
 */
export interface FileImplementOptions extends FileAdapterOptions {
  adapter?: FileAdapter;
}

/**
 * Worker environment bindings the server side reads at request time:
 * storage media, the API key protecting mutations, and the secret
 * signing delivery URLs.
 */
export interface FileWorkerEnv {
  BUCKET: R2Bucket;
  DB?: D1Database;
  FILE_API_KEY?: string;
  FILE_SECRET?: string;
}

/**
 * Lifetime in seconds of a signed delivery URL.
 */
const DELIVERY_URL_TTL = 3600;

/**
 * Registers the filesystem handlers so every client stub executes
 * against your storage.
 *
 * Call once at worker startup. When `FILE_API_KEY` is configured, every
 * RPC call must carry it; reads of binary content answer with a delivery
 * URL — signed when `FILE_SECRET` is set — and encoded reads answer with
 * the decoded content inline.
 *
 * @param options Storage bindings and constraints, or a prebuilt `adapter`
 */
export function implement(options: FileImplementOptions): void {
  const adapter = options.adapter ?? createFs(options);

  fileModule.guard(async () => {
    const required = getContext<FileWorkerEnv | undefined>('env')?.FILE_API_KEY;
    if (required === undefined) return;
    if (credential<string>('apiKey') !== required) {
      throw GuardError.failed('Unauthorized: Valid API key required');
    }
  });

  fileModule.construct(mkdir, (path, options) => adapter.mkdir(path, options));

  fileModule.construct(writeStub, (path, data, options) => adapter.write(path, data, options));

  fileModule.construct(readStub, async (path, options) => {
    if (options?.encoding !== undefined) {
      return adapter.read(path, options as ReadOptions<FileEncoding>);
    }

    const info = await adapter.stat(path);
    /* istanbul ignore next */
    if (info === undefined || info.isDirectory) return undefined;

    const secret = getContext<FileWorkerEnv | undefined>('env')?.FILE_SECRET;
    const url = secret === undefined ? info.path : await signUrl(info.path, secret, DELIVERY_URL_TTL);
    return new IRPCBlob(url, { type: info.type, size: info.size, name: info.name });
  });

  fileModule.construct(stat, (path, options) => adapter.stat(path, options));

  fileModule.construct(exists, (path, options) => adapter.exists(path, options));

  fileModule.construct(list, (path, options) => adapter.list(path, options));

  fileModule.construct(search, (query, options) => adapter.search(query, options));

  fileModule.construct(copy, (source, destination, options) => adapter.copy(source, destination, options));

  fileModule.construct(move, (source, destination, options) => adapter.move(source, destination, options));

  fileModule.construct(link, (target, path, options) => adapter.link(target, path, options));

  fileModule.construct(remove, (path, options) => adapter.remove(path, options));

  fileModule.construct(restore, (path, options) => adapter.restore(path, options));
}
