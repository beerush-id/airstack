import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IRPCCacher } from '../src/cache.js';

describe('IRPCCacher', () => {
  let cache: IRPCCacher;

  beforeEach(() => {
    cache = new IRPCCacher();
  });

  describe('Initialization', () => {
    it('should initialize with empty caches and queues', () => {
      expect(cache.size).toBe(0);
      expect([...cache.values()]).toEqual([]);
      expect([...cache.entries()]).toEqual([]);
    });
  });

  describe('set', () => {
    it('should set a new cache entry', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);

      expect(cache.size).toBe(1);
      expect(cache.has(key)).toBe(true);

      const entry = cache.get(key);
      expect(entry).toBeDefined();
      expect(entry!.key).toBe(key);
      expect(entry!.value).toBe(value);
      expect(entry!.expires).toBeGreaterThan(Date.now());
    });

    it('should throw error for invalid maxAge', () => {
      expect(() => cache.set('key', 'value', 0)).toThrow('Max age must be a positive number.');
      expect(() => cache.set('key', 'value', -1)).toThrow('Max age must be a positive number.');
    });

    it('should overwrite existing cache entry', () => {
      const key = 'test-key';
      const value1 = 'test-value-1';
      const value2 = 'test-value-2';
      const maxAge = 1000;

      cache.set(key, value1, maxAge);
      const entry1 = cache.get(key);
      expect(entry1!.value).toBe(value1);

      cache.set(key, value2, maxAge);
      const entry2 = cache.get(key);
      expect(entry2!.value).toBe(value2);
      expect(cache.size).toBe(1);
    });

    it('should clear previous timeout when overwriting entry', () => {
      const key = 'test-key';
      const value1 = 'test-value-1';
      const value2 = 'test-value-2';
      const maxAge = 1000;

      vi.spyOn(globalThis, 'clearTimeout');

      cache.set(key, value1, maxAge);
      cache.set(key, value2, maxAge);

      expect(clearTimeout).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      const entry = cache.get('non-existent');
      expect(entry).toBeUndefined();
    });

    it('should return entry for existing key', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);
      const entry = cache.get(key);

      expect(entry).toBeDefined();
      expect(entry!.key).toBe(key);
      expect(entry!.value).toBe(value);
    });

    it('should return undefined for expired entry and remove it from cache', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);

      // Simulate time passing beyond expiration
      const now = Date.now;
      Date.now = () => now() + maxAge + 1;

      const entry = cache.get(key);
      expect(entry).toBeUndefined();
      expect(cache.has(key)).toBe(false);
      expect(cache.size).toBe(0);

      Date.now = now;
    });

    it('should return entry for non-expired key', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);

      // Simulate time passing but not beyond expiration
      const now = Date.now;
      Date.now = () => now() + maxAge - 1;

      const entry = cache.get(key);
      expect(entry).toBeDefined();
      expect(entry!.value).toBe(value);

      Date.now = now;
    });
  });

  describe('has', () => {
    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return true for existing key', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);
      expect(cache.has(key)).toBe(true);
    });

    it('should return false for expired key and remove it from cache', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);

      // Simulate time passing beyond expiration
      const now = Date.now;
      Date.now = () => now() + maxAge + 1;

      expect(cache.get(key)).toBeUndefined();
      expect(cache.size).toBe(0);

      Date.now = now;
    });
  });

  describe('delete', () => {
    it('should remove entry from cache', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      cache.set(key, value, maxAge);
      expect(cache.has(key)).toBe(true);

      cache.delete(key);
      expect(cache.has(key)).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('should clear timeout when deleting entry', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 1000;

      vi.spyOn(globalThis, 'clearTimeout');

      cache.set(key, value, maxAge);
      cache.delete(key);

      expect(clearTimeout).toHaveBeenCalled();
    });

    it('should not throw error when deleting non-existent key', () => {
      expect(() => cache.delete('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries and timeouts', () => {
      const key1 = 'test-key-1';
      const key2 = 'test-key-2';
      const value1 = 'test-value-1';
      const value2 = 'test-value-2';
      const maxAge = 1000;

      cache.set(key1, value1, maxAge);
      cache.set(key2, value2, maxAge);

      expect(cache.size).toBe(2);

      vi.spyOn(globalThis, 'clearTimeout');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(clearTimeout).toHaveBeenCalledTimes(2);
    });

    it('should not throw error when clearing empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1', 1000);
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2', 1000);
      expect(cache.size).toBe(2);

      cache.delete('key1');
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('values', () => {
    it('should return iterator of cache values', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      const values = [...cache.values()];
      expect(values).toHaveLength(2);
      expect(values.map((v) => v.value)).toContain('value1');
      expect(values.map((v) => v.value)).toContain('value2');
    });
  });

  describe('entries', () => {
    it('should return iterator of cache entries', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      const entries = [...cache.entries()];
      expect(entries).toHaveLength(2);

      const keys = entries.map((e) => e[0]);
      const values = entries.map((e) => e[1]);

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(values.map((v) => v.value)).toContain('value1');
      expect(values.map((v) => v.value)).toContain('value2');
    });
  });

  describe('Automatic expiration', () => {
    it('should automatically remove expired entries', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 100;

      cache.set(key, value, maxAge);
      expect(cache.has(key)).toBe(true);

      vi.advanceTimersByTime(maxAge + 1);

      expect(cache.has(key)).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('should not remove non-expired entries', () => {
      const key = 'test-key';
      const value = 'test-value';
      const maxAge = 100;

      cache.set(key, value, maxAge);
      expect(cache.has(key)).toBe(true);

      vi.advanceTimersByTime(maxAge - 1);

      expect(cache.has(key)).toBe(true);
      expect(cache.size).toBe(1);
    });

    it('should keep an entry older than a timer can wait until its age runs out', () => {
      const day = 24 * 60 * 60 * 1000;

      cache.set('key', 'value', 365 * day);

      vi.advanceTimersByTime(30 * day);
      expect(cache.has('key')).toBe(true);

      vi.advanceTimersByTime(335 * day + 1);
      expect(cache.has('key')).toBe(false);
    });
  });
});
