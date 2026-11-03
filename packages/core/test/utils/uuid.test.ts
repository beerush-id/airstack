import { describe, expect, it, vi } from 'vitest';
import { createLifecycle, setUUIDProvider, uIndex, uuid } from '../../src/index.js';

describe('UUID', () => {
  describe('UUID Generation', () => {
    it('should generate a UUID', () => {
      const id = uuid();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate using simple UUID generator fallback', () => {
      vi.stubGlobal('crypto', {
        randomUUID: undefined,
      });

      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      vi.restoreAllMocks();
    });

    it('should fall back when the runtime refuses the crypto API', () => {
      vi.stubGlobal('crypto', {
        randomUUID: () => {
          throw new Error('Disallowed operation called within global scope');
        },
      });

      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      vi.unstubAllGlobals();
    });

    it('should generate unique UUIDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(uuid());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('UUID Provider', () => {
    it('should allow setting custom UUID provider', () => {
      const customProvider = vi.fn().mockReturnValue('custom-uuid');
      setUUIDProvider(customProvider);

      const id = uuid();

      expect(customProvider).toHaveBeenCalled();
      expect(id).toBe('custom-uuid');
    });

    it('should reset to default provider when set to null', () => {
      // Set custom provider
      const customProvider = vi.fn().mockReturnValue('custom-uuid');
      setUUIDProvider(customProvider);

      // Reset to default
      // @ts-expect-error - Testing null provider
      setUUIDProvider(null);

      const id = uuid();

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id).not.toBe('custom-uuid');
    });
  });
});

describe('uid', () => {
  describe('uIndex', () => {
    it('should initialize and increment index sequence for symbol keys within a lifecycle context', () => {
      const scope = createLifecycle();
      scope.run(() => {
        const keyA = Symbol('uid-a');
        const keyB = Symbol('uid-b');

        expect(uIndex(keyA)).toBe(1);
        expect(uIndex(keyA)).toBe(2);
        expect(uIndex(keyB)).toBe(1);
        expect(uIndex(keyA)).toBe(3);
      });
      scope.destroy();
    });

    it('should initialize and increment index sequence for symbol keys within a scope context', () => {
      const scope = createLifecycle();
      scope.run(() => {
        const keyA = Symbol('uid-a');
        const keyB = Symbol('uid-b');

        expect(uIndex(keyA, true)).toBe(1);
        expect(uIndex(keyA, true)).toBe(2);
        expect(uIndex(keyB, true)).toBe(1);
        expect(uIndex(keyA, true)).toBe(3);
      });
      scope.destroy();
    });
  });
});
