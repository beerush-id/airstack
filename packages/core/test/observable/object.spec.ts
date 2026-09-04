import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anchor, createObserver } from '../../src/index.js';

describe('Anchor Core - Observable Object', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('Object Observation', () => {
    it('should track property access when observable is enabled', () => {
      const state = anchor({ a: 1, b: 2 }, { observable: true });

      const onTack = vi.fn();
      const observer = createObserver(() => {}, onTack);
      observer.run(() => {
        // Access properties to track them
        const valueA = state.a;
        const valueB = state.b;

        // Confirm accessed values
        expect(valueA).toBe(1);
        expect(valueB).toBe(2);
      });

      const trackedProps = observer.states.get(anchor.get(state));

      expect(trackedProps).toBeDefined();
      expect(trackedProps?.has('a')).toBe(true);
      expect(trackedProps?.has('b')).toBe(true);
      expect(onTack).toHaveBeenCalledTimes(2);
    });

    it('should not track property access when observable is disabled', () => {
      const state = anchor({ a: 1, b: 2 }, { observable: false });

      const observer = createObserver(() => {});
      observer.run(() => {
        // Access properties
        const valueA = state.a;
        const valueB = state.b;

        // Confirm accessed values
        expect(valueA).toBe(1);
        expect(valueB).toBe(2);
      });

      const trackedProps = observer.states.get(anchor.get(state));

      expect(trackedProps).toBeUndefined();
    });

    it('should trigger observer onChange when tracked properties change', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const state = anchor({ a: 1, b: 2 }, { observable: true });
      const onChange = vi.fn().mockImplementation(() => {
        // Trigger deprecation warning to .reset() method.
        observer.reset();
        recordChanges();
      });

      const observer = createObserver(onChange);
      const recordChanges = () => {
        observer.run(() => {
          void state.a;
          void state.b;
        });
      };
      recordChanges();
      expect(warnSpy).not.toHaveBeenCalled();

      state.a = 3;

      expect(state.a).toBe(3);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        type: 'set',
        keys: ['a'],
        prev: 1,
        value: 3,
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      delete (state as { b?: number }).b;

      expect(state.b).toBeUndefined();
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledWith({
        type: 'delete',
        keys: ['b'],
        prev: 2,
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);

      anchor.assign(state, { a: 1, b: 2 });

      expect(state.a).toBe(1);
      expect(state.b).toBe(2);
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(3);

      anchor.remove(state, 'b');

      expect(state.b).toBeUndefined();
      expect(onChange).toHaveBeenCalledTimes(4);
      expect(warnSpy).toHaveBeenCalledTimes(4);

      anchor.clear(state);
      expect(state).toEqual({});
      expect(onChange).toHaveBeenCalledTimes(5);
      expect(warnSpy).toHaveBeenCalledTimes(5);
    });

    it('should not trigger observer onChange when batch assigning untracked properties', () => {
      const state = anchor({ a: 1, b: 2, c: 3 }, { observable: true });
      const onChange = vi.fn();
      const observer = createObserver(onChange);

      observer.run(() => {
        void state.a;
      });

      anchor.assign(state, { b: 20, c: 30 });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should track nested object properties', () => {
      const state = anchor({ nested: { a: 1, b: 2 } }, { observable: true });

      const observer = createObserver(() => {});
      observer.run(() => {
        // Access nested properties to track them
        const valueA = state.nested.a;
        const valueB = state.nested.b;

        // Confirm accessed values
        expect(valueA).toBe(1);
        expect(valueB).toBe(2);
      });

      const trackedProps = observer.states.get(anchor.get(state.nested));

      expect(trackedProps).toBeDefined();
      expect(trackedProps?.has('a')).toBe(true);
      expect(trackedProps?.has('b')).toBe(true);
    });

    it('should track property access with circular references', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = { a: 1 };
      obj.self = obj;
      const state = anchor(obj, { observable: true });

      const observer = createObserver(() => {});
      observer.run(() => {
        // Access properties to track them
        const valueA = state.a;
        const circularRef = state.self;

        // Confirm accessed values
        expect(valueA).toBe(1);
        expect(circularRef).toBe(state);
      });

      const trackedProps = observer.states.get(anchor.get(state));

      expect(trackedProps).toBeDefined();
      expect(trackedProps?.has('a')).toBe(true);
      expect(trackedProps?.has('self')).toBe(true);
    });

    it('should detect circular mutation in observation', () => {
      vi.useFakeTimers();

      const state = anchor({ a: 1 }, { observable: true });
      const observer = createObserver(() => cycle());
      const cycleTrack = vi.fn();

      // Access properties to track them
      const cycle = () => {
        observer.run(() => {
          cycleTrack();

          if (state.a === 1) {
            state.a = 2;
          } else if (state.a === 2) {
            state.a = 1;
          }

          return state.a;
        });
      };
      cycle();

      vi.runAllTimers();

      expect(cycleTrack).toHaveBeenCalledTimes(10);
      expect(errorSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not treat correction as circular mutation in observation', () => {
      vi.useFakeTimers();

      const state = anchor({ a: 1 }, { observable: true });
      const observer = createObserver(() => cycle());
      const cycleTrack = vi.fn();

      // Access properties to track them
      const cycle = () => {
        observer.run(() => {
          cycleTrack();

          if (state.a === 1) {
            state.a = 2;
          }

          return state.a;
        });
      };
      cycle();

      vi.runAllTimers();

      expect(cycleTrack).toHaveBeenCalledTimes(2);
      expect(errorSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should detect circular mutation across objects in observation', () => {
      vi.useFakeTimers();

      const left = anchor({ a: 1 }, { observable: true });
      const right = anchor({ b: 1 }, { observable: true });
      const observer = createObserver(() => cycle());
      const cycleTrack = vi.fn();

      // Each run shifts the mismatch to the other object, so neither ever settles.
      const cycle = () => {
        observer.run(() => {
          cycleTrack();

          if (left.a === right.b) {
            left.a += 1;
          } else {
            right.b = left.a;
          }

          return left.a + right.b;
        });
      };
      cycle();

      vi.runAllTimers();

      expect(cycleTrack).toHaveBeenCalledTimes(10);
      expect(errorSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle multiple observers on the same property', () => {
      const state = anchor({ a: 1 }, { observable: true });
      const onChange1 = vi.fn();
      const onChange2 = vi.fn();

      const observer1 = createObserver(onChange1);
      const observer2 = createObserver(onChange2);

      observer1.run(() => {
        const valueA1 = state.a;
        expect(valueA1).toBe(1);
      });

      observer2.run(() => {
        const valueA2 = state.a;
        expect(valueA2).toBe(1);
      });

      // Change the tracked property
      state.a = 2;

      expect(onChange1).toHaveBeenCalledWith({
        type: 'set',
        keys: ['a'],
        prev: 1,
        value: 2,
      });

      expect(onChange2).toHaveBeenCalledWith({
        type: 'set',
        keys: ['a'],
        prev: 1,
        value: 2,
      });
    });
  });
});
