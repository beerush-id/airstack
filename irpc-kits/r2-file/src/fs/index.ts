import { FileAdapter } from '../adapter.js';
import { D1Driver, NormalizerDriver, R2Driver } from '../drivers/index.js';
import type { FileAdapterOptions } from '../types.js';
/**
 * Builds a standalone filesystem over the requested storage media.
 *
 * Concern: one wiring decision for both supported topologies. Normalization
 * always runs first so every medium sees the same resolved path; the
 * relational index is attached before blob storage so inlined payloads and
 * dense queries are resolved without an R2 round trip. With neither medium
 * configured the bare adapter is returned for custom `.use()` chaining.
 *
 * @param options - Media bindings plus the shared storage constraints.
 * @returns Configured `FileAdapter` exposing the full filesystem surface.
 */
export function createFs(options?: FileAdapterOptions): FileAdapter {
  const adapter = new FileAdapter(options);
  adapter.use(new NormalizerDriver(options));

  if (options?.indexer !== undefined) {
    adapter.use(new D1Driver(options.indexer, options));
  }

  if (options?.bucket !== undefined) {
    adapter.use(new R2Driver(options.bucket, options));
  }

  return adapter;
}
