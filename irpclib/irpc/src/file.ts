import { type AnyType, mutable, onCleanup } from '@airlib/core';
import { IRPC_FILE_STATUS, IRPC_STATUS } from './enum.js';
import { IRPC_STORE } from './store.js';

export type IRPCFileStatus = (typeof IRPC_FILE_STATUS)[keyof typeof IRPC_FILE_STATUS];

export type IRPCFileState = {
  error?: Error;
  status: IRPCFileStatus;
  downloaded: number;
};

export type IRPCFileMeta = {
  size: number;
  type: string;
  name?: string;
};

export type IRPCFilePipe = (chunk: Uint8Array) => void;
export type IRPCFileUnpipe = () => void;

export class IRPCFile<T extends IRPCFileMeta = IRPCFileMeta> {
  protected state = mutable<IRPCFileState>({
    status: IRPC_FILE_STATUS.PENDING,
    downloaded: 0,
  });

  public get status() {
    return this.state.status;
  }

  public set status(status: IRPCFileStatus) {
    this.state.status = status;
  }

  public get error() {
    return this.state.error;
  }

  public get downloaded() {
    return this.state.downloaded;
  }

  public get success() {
    return this.status === IRPC_FILE_STATUS.SUCCESS;
  }

  public get completed() {
    return ([IRPC_FILE_STATUS.SUCCESS, IRPC_FILE_STATUS.ERROR] as IRPCFileStatus[]).includes(this.status);
  }

  public data: Blob;

  constructor(
    public meta: T,
    data?: Blob
  ) {
    this.data = data ?? new Blob([], { type: meta.type });
    this.state.status = data ? IRPC_FILE_STATUS.SUCCESS : IRPC_FILE_STATUS.PENDING;
  }
}

export class IRPCBlob {
  protected state = mutable<IRPCFileState>({
    status: IRPC_FILE_STATUS.PENDING,
    downloaded: 0,
  });

  public data: Blob;

  private pipes = new Set<IRPCFilePipe>();
  private promise: Promise<Blob> | undefined;
  private controller?: AbortController;

  public get status() {
    return this.state.status;
  }

  public get error() {
    return this.state.error;
  }

  public get downloaded() {
    return this.state.downloaded;
  }

  public get success() {
    return this.status === IRPC_FILE_STATUS.SUCCESS;
  }

  public get completed() {
    return ([IRPC_FILE_STATUS.SUCCESS, IRPC_FILE_STATUS.ERROR] as IRPCFileStatus[]).includes(this.status);
  }

  constructor(
    public url: string,
    public meta?: { type?: string; size?: number; name?: string }
  ) {
    this.data = new Blob([], { type: meta?.type ?? '' });
    // A blob is a pointer its caller loads. Where it is made (a handler), awaiting it or returning it
    // from an async function must not load it, so it stays unawaitable until delivered (`deliverBlob`).
    Object.defineProperty(this, 'then', { value: undefined, configurable: true, writable: true });
  }

  public load(): Promise<Blob> {
    if (this.promise) return this.promise;

    this.controller = new AbortController();
    this.state.status = IRPC_FILE_STATUS.PENDING;
    this.promise = fetch(this.url, { signal: this.controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        if (response.body && this.meta?.size) {
          const reader = response.body.getReader();
          const chunks: BlobPart[] = [];
          let downloaded = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              downloaded += value.byteLength;
              this.state.downloaded = downloaded;
              this.pipes.forEach((fn) => {
                try {
                  fn(value);
                } catch (error) {
                  IRPC_STORE.error(error as Error, [{ url: this.url }]);
                }
              });
            }
          }

          this.data = new Blob(chunks, { type: this.meta?.type ?? '' });
        } else {
          this.data = await response.blob();
          this.state.downloaded = this.data.size;
        }

        this.state.status = IRPC_FILE_STATUS.SUCCESS;
        return this.data;
      })
      .catch((error) => {
        IRPC_STORE.error(error as Error, [{ url: this.url }]);
        this.state.error = error as Error;
        /* istanbul ignore next */
        this.state.status = this.controller?.signal?.aborted ? IRPC_STATUS.ABORTED : IRPC_FILE_STATUS.ERROR;
        throw error;
      });

    onCleanup(() => {
      /* istanbul ignore next */
      this.controller?.abort();
    });

    return this.promise;
  }

  public pipe(fn: IRPCFilePipe): IRPCFileUnpipe {
    this.pipes.add(fn);
    return () => this.pipes.delete(fn);
  }

  // biome-ignore lint/suspicious/noThenProperty: Expect thenable.
  public then<TResult1 = Blob, TResult2 = never>(
    onfulfilled?: ((value: Blob) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: AnyType) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.load().then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?: ((reason: AnyType) => TResult | PromiseLike<TResult>) | null
  ): Promise<Blob | TResult> {
    return this.load().catch(onrejected);
  }
}

/**
 * Hands a blob to its caller: from here on, awaiting it loads it. Transports deliver blobs as they
 * reach the caller, so only the caller ever loads one.
 *
 * @param blob - The blob reaching its caller.
 * @returns The same blob, now awaitable.
 */
export function deliverBlob(blob: IRPCBlob): IRPCBlob {
  delete (blob as { then?: unknown }).then;
  return blob;
}

export class IRPCFileStream<T extends IRPCFileMeta = IRPCFileMeta> extends IRPCFile<T> {
  private pipes = new Set<IRPCFilePipe>();
  private buffer: Uint8Array | undefined;

  constructor(meta: T) {
    super(meta);

    this.data = new Blob([], { type: meta.type });
    this.buffer = new Uint8Array(meta.size);
  }

  public write(chunk: Uint8Array) {
    if (this.completed) return null;

    try {
      const remaining = this.meta.size - this.state.downloaded;
      const chunkSize = Math.min(chunk.byteLength, remaining);
      const needSlice = chunkSize < chunk.byteLength;
      const nextChunk = needSlice ? chunk.slice(0, chunkSize) : chunk;
      const leftovers = needSlice ? chunk.slice(chunkSize) : null;

      this.buffer?.set(nextChunk, this.state.downloaded);
      this.state.downloaded += chunkSize;

      this.pipes.forEach((fn) => {
        try {
          fn(nextChunk);
        } catch (error) {
          IRPC_STORE.error(error as Error, [this.meta]);
        }
      });

      if (this.downloaded >= this.meta.size) {
        this.data = new Blob([this.buffer as BlobPart], { type: this.meta.type });
        this.buffer = undefined;
        this.state.status = IRPC_FILE_STATUS.SUCCESS;
      }

      return leftovers;
    } catch (error) {
      IRPC_STORE.error(error as Error, [this.meta]);
      this.state.error = error as Error;
      this.state.status = IRPC_FILE_STATUS.ERROR;
    }

    return null;
  }

  public pipe(fn: IRPCFilePipe): IRPCFileUnpipe {
    this.pipes.add(fn);

    /* istanbul ignore else */
    if (this.state.downloaded > 0) {
      try {
        fn(this.buffer?.subarray(0, this.state.downloaded) as Uint8Array);
      } catch (error) {
        IRPC_STORE.error(error as Error, [this.meta]);
      }
    }

    return () => this.pipes.delete(fn);
  }
}
