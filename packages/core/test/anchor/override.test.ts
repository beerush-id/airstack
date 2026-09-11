import { describe, expect, it } from 'vitest';
import { override } from '../../src/engine/proxy.js';

describe('Props & State Overriding (override)', () => {
  describe('Precedence & Resolution', () => {
    it('should resolve properties with later sources overriding earlier sources', () => {
      const defaults = { type: 'submit', variant: 'primary', disabled: false };
      const props = { type: 'button', disabled: true };

      const resolved = override(defaults, props);

      expect(resolved.type).toBe('button');
      expect(resolved.disabled).toBe(true);
      expect(resolved.variant).toBe('primary');
    });

    it('should keep shallow object references without recursive proxy wrapping', () => {
      const styleObj = { color: 'red', fontSize: 14 };
      const base = { style: styleObj };
      const custom = { style: styleObj };

      const resolved = override(base, custom);

      // Must preserve exact reference identity (shallow, not recursive)
      expect(resolved.style).toBe(styleObj);
    });

    it('should handle variadic sources with cascading priority', () => {
      const layer1 = { a: 1, b: 1, c: 1 };
      const layer2 = { b: 2, c: 2 };
      const layer3 = { c: 3 };

      const resolved = override(layer1, layer2, layer3);

      expect(resolved.a).toBe(1);
      expect(resolved.b).toBe(2);
      expect(resolved.c).toBe(3);
    });
  });

  describe('Key Presence & Explicit undefined', () => {
    it('should treat explicit undefined as an intentional value rather than absence', () => {
      const defaults = { placeholder: 'Search items...', count: 10 };
      const props = { placeholder: undefined };

      const resolved = override(defaults, props);

      expect(resolved.placeholder).toBeUndefined();
      expect('placeholder' in resolved).toBe(true);
      expect(resolved.count).toBe(10);
    });

    it('should report false for in operator when property does not exist on any source', () => {
      const base = { active: true };
      const resolved = override(base);

      expect('active' in resolved).toBe(true);
      expect('nonExistent' in resolved).toBe(false);
      expect((resolved as Record<string, unknown>).nonExistent).toBeUndefined();
    });
  });

  describe('Mutations & Ownership', () => {
    it('should target whichever source owns the key on write', () => {
      const base = { role: 'button', label: 'Click' };
      const overrides = { role: 'tab' };

      const resolved = override(base, overrides);

      // Writing to an overridden key updates the override source
      resolved.role = 'link';
      expect(overrides.role).toBe('link');
      expect(base.role).toBe('button');

      // Writing to a base-only key updates the base source
      resolved.label = 'Submit';
      expect(base.label).toBe('Submit');
      expect('label' in overrides).toBe(false);
    });

    it('should write newly added properties to the topmost source', () => {
      const base: Record<string, unknown> = { a: 1 };
      const patch: Record<string, unknown> = {};

      const resolved = override(base, patch);
      resolved.b = 2;

      expect(patch.b).toBe(2);
      expect('b' in base).toBe(false);
    });

    it('should delete property from whichever source currently defines it', () => {
      const base: Record<string, unknown> = { a: 1, b: 2 };
      const patch: Record<string, unknown> = { b: 20 };

      const resolved = override(base, patch);
      expect(resolved.b).toBe(20);

      // Deleting shadows unmasks underlying base value
      delete resolved.b;
      expect('b' in patch).toBe(false);
      expect(base.b).toBe(2);
      expect(resolved.b).toBe(2);

      // Deleting base-only property removes it from base
      delete resolved.a;
      expect('a' in base).toBe(false);
      expect(resolved.a).toBeUndefined();

      // Deleting non-existent property returns true
      const nonExistentDeleted = delete (resolved as Record<string, unknown>).nonExistent;
      expect(nonExistentDeleted).toBe(true);
    });
  });

  describe('Reactivity & Getters', () => {
    it('should defer getter access until property is read', () => {
      let readCount = 0;
      const base = {
        get count() {
          readCount++;
          return 42;
        },
      };

      const resolved = override(base, {});
      expect(readCount).toBe(0);

      expect(resolved.count).toBe(42);
      expect(readCount).toBe(1);
    });
  });

  describe('Introspection & Reflection', () => {
    it('should list composite keys including symbols via ownKeys', () => {
      const sym = Symbol('custom');
      const base = { a: 1, [sym]: 'symbol-value' };
      const patch = { b: 2 };

      const resolved = override(base, patch);
      const keys = Reflect.ownKeys(resolved);

      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain(sym);
    });

    it('should return correct property descriptors from owning source and prototype fallback', () => {
      const protoBase = Object.create({ protoKey: 'protoVal' });
      protoBase.title = 'Anchor';
      const resolved = override(protoBase) as Record<string, unknown>;

      const desc = Object.getOwnPropertyDescriptor(resolved, 'title');
      expect(desc).toBeDefined();
      expect(desc?.value).toBe('Anchor');
      expect(desc?.enumerable).toBe(true);

      const protoDesc = Object.getOwnPropertyDescriptor(resolved, 'protoKey');
      expect(protoDesc).toBeDefined();
      expect(protoDesc?.value).toBe('protoVal');
      expect(protoDesc?.enumerable).toBe(true);

      const missingDesc = Object.getOwnPropertyDescriptor(resolved, 'missing');
      expect(missingDesc).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or nullish sources gracefully', () => {
      const resolved = override(null, { a: 1 }, undefined, { b: 2 });

      expect(resolved.a).toBe(1);
      expect(resolved.b).toBe(2);

      const empty = override() as Record<string, unknown>;
      expect(empty.anything).toBeUndefined();

      empty.test = 10;
      expect(empty.test).toBeUndefined();

      const deleted = delete empty.test;
      expect(deleted).toBe(true);
    });
  });

  describe('Type Inferences', () => {
    it('should infer merged types where later sources override earlier properties', () => {
      const base = { type: 'submit' as 'submit' | 'button', count: 10, label: 'Send' };
      const patch = { type: 'button' as const, count: 20 };

      const resolved = override(base, patch);

      const typeCheck: 'button' = resolved.type;
      const countCheck: number = resolved.count;
      const labelCheck: string = resolved.label;

      expect(typeCheck).toBe('button');
      expect(countCheck).toBe(20);
      expect(labelCheck).toBe('Send');
    });

    it('should support explicit return type specification', () => {
      type CustomProps = { custom: boolean };
      const resolved = override<CustomProps>({ custom: true });

      const customCheck: boolean = resolved.custom;
      expect(customCheck).toBe(true);
    });
  });
});
