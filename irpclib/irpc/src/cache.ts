import type { IRPCReader } from './reader.js';
import type { IRPCData } from './types.js';

/** The longest delay a timer takes: 2^31 - 1 ms, about 24.8 days. */
const MAX_DELAY = 2 ** 31 - 1;

export type IRPCCacheEntry = {
  key: string;
  value: IRPCReader<IRPCData>;
  expires: number;
};

export class IRPCCacher {
  public caches = new Map<string, IRPCCacheEntry>();
  public queues = new Map<string, number | NodeJS.Timeout>();

  public get size() {
    return this.caches.size;
  }

  public has(key: string) {
    return this.caches.has(key);
  }

  public get(key: string): IRPCCacheEntry | undefined {
    const entry = this.caches.get(key);

    if (!entry) return undefined;

    if (entry.expires < Date.now()) {
      this.caches.delete(key);
      return undefined;
    }

    return entry;
  }

  public values() {
    return this.caches.values();
  }

  public entries() {
    return this.caches.entries();
  }

  public set(key: string, value: IRPCReader<IRPCData>, maxAge: number) {
    if (!maxAge || maxAge < 0) {
      throw new Error('Max age must be a positive number.');
    }

    const queue = this.queues.get(key);

    if (queue) {
      clearTimeout(queue);
    }

    const expires = Date.now() + maxAge;
    this.caches.set(key, { key, value, expires });
    this.evictAt(key, expires);
  }

  public delete(key: string) {
    clearTimeout(this.queues.get(key));

    this.caches.delete(key);
    this.queues.delete(key);
  }

  public clear() {
    for (const queue of this.queues.values()) {
      clearTimeout(queue);
    }

    this.caches.clear();
    this.queues.clear();
  }

  // A timer takes at most MAX_DELAY and fires at once beyond it, so a longer age waits in steps.
  private evictAt(key: string, expires: number) {
    const queue = setTimeout(
      () => {
        if (expires > Date.now()) return this.evictAt(key, expires);
        this.caches.delete(key);
        this.queues.delete(key);
      },
      Math.min(expires - Date.now(), MAX_DELAY)
    );

    this.queues.set(key, queue);
  }
}
