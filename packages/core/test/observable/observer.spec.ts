import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  $do,
  anchor,
  createObserver,
  derived,
  effect,
  getObserver,
  getStaticTracker,
  getTracker,
  mutable,
  setStaticTracker,
  setTracker,
} from '../../src/index.js';

describe('Anchor Core - Observable Observer Management', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('Observer Management', () => {
    it('should properly set global tracker', () => {
      const tracker = vi.fn();
      const state = anchor({ count: 1 });
      expect(getTracker()).toBeUndefined();

      const untrack = setTracker(tracker);

      expect(getTracker()).toBe(tracker);
      expect(tracker).not.toHaveBeenCalled();

      const count = state.count;
      expect(count).toBe(1);
      expect(tracker).toHaveBeenCalledTimes(1);

      untrack?.(); // Unset the tracker. Any state read after this point will not be tracked.

      expect(getTracker()).toBeUndefined();
      expect(tracker).toHaveBeenCalledTimes(1);

      expect(state.count).toBe(1);
      expect(tracker).toHaveBeenCalledTimes(1);
      expect(getObserver()).toBeUndefined();

      setTracker(tracker);

      const array = anchor<number[]>([]);
      const map = anchor(new Map());

      array.push(1);
      map.set('key', 1);

      expect(tracker).toHaveBeenCalledTimes(3);
    });

    it('should properly set and get static tracker', () => {
      const tracker = vi.fn();
      expect(getStaticTracker()).toBeUndefined();

      const restore = setStaticTracker(tracker);
      expect(getStaticTracker()).toBe(tracker);

      restore();
      expect(getStaticTracker()).toBeUndefined();
    });

    it('should handle outside of observer function', () => {
      const handler = vi.fn().mockImplementation(() => 'Success');
      const result = $do<string>(handler);

      expect(result).toBe('Success');
    });

    it('should handle tracking on a destroyed observer', async () => {
      const state = mutable(1);
      const observer = createObserver(() => {});

      observer.destroy();

      expect(observer.active).toBe(false);
      expect(() => (observer as any).track(state, 'value')).not.toThrow();
      expect(() => observer.destroy()).not.toThrow();
    });
  });

  describe('Unsafe Observation Detection', () => {
    it('should detect and warn about unsafe observation when threshold is exceeded', async () => {
      vi.useFakeTimers();

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const observer = createObserver(() => {});
      const originalConfig = anchor.configs();

      anchor.configure({ safeObservationThreshold: 5 });

      const states = Array.from({ length: 6 }, (_, i) => anchor({ value: i }, { observable: true }));

      observer.run(() => {
        expect(observer.active).toBe(true);
        states.forEach((state, i) => {
          const value = state.value;
          expect(value).toBe(i);
        });
      });

      vi.runAllTimers();

      // Check that error was called with the expected unsafe observation warning
      expect(errorSpy).toHaveBeenCalled();

      const errorMessage = errorSpy.mock.calls[0][0];

      expect(errorMessage).toContain('Attempted to observe too many (6) states');

      // Restore original configuration
      anchor.configure(originalConfig);
      states.forEach((state) => anchor.destroy(state));

      await Promise.resolve();

      errorSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should not count what a derived value read in runs before', () => {
      const originalConfig = anchor.configs();
      anchor.configure({ safeObservationThreshold: 5 });

      const state = mutable({ list: [0] });
      const size = derived(() => state.list.length);

      for (let i = 1; i <= 20; i++) {
        state.list = Array.from({ length: i }, (_, at) => at);
      }

      expect(size.value).toBe(20);
      expect(errorSpy).not.toHaveBeenCalled();

      anchor.configure(originalConfig);
    });
  });

  describe('Releasing What Is No Longer Read', () => {
    it('should stop hearing a replaced object', () => {
      const handler = vi.fn();
      const state = mutable({ list: [1] });
      const replaced = state.list;

      effect(() => {
        handler(state.list.length);
      });

      state.list = [1, 2];
      expect(handler).toHaveBeenCalledTimes(2);

      replaced.push(3);
      expect(handler).toHaveBeenCalledTimes(2);

      state.list.push(3);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should keep what a later run reads again', () => {
      const handler = vi.fn();
      const state = mutable({ show: true, count: 0 });

      effect(() => {
        handler(state.show ? state.count : -1);
      });

      state.show = false;
      state.count = 1;
      expect(handler).toHaveBeenCalledTimes(2);

      state.show = true;
      expect(handler).toHaveBeenLastCalledWith(1);

      state.count = 2;
      expect(handler).toHaveBeenLastCalledWith(2);
    });

    it('should hold what is observed until the run after a change', () => {
      const onChange = vi.fn();
      const observer = createObserver(onChange);
      const state = mutable({ count: 0 });
      const read = () => state.count;

      observer.run(read);
      state.count = 1;
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(observer.states.has(anchor.get(state))).toBe(true);

      // Rendering runs after the change has been heard, and reads it again.
      observer.run(read);
      state.count = 2;
      expect(onChange).toHaveBeenCalledTimes(2);

      observer.destroy();
    });

    it('should let go of a state the next run leaves unread', () => {
      const observer = createObserver(() => {});
      const first = mutable({ count: 0 });
      const second = mutable({ count: 0 });

      observer.run(() => first.count);
      first.count = 1;
      observer.run(() => second.count);

      expect(observer.states.has(anchor.get(first))).toBe(false);
      expect(observer.states.has(anchor.get(second))).toBe(true);

      observer.destroy();
    });
  });

  describe('Effect', () => {
    it('should handle change in effect', async () => {
      const state = mutable(0);
      const clear = vi.fn();
      const react = vi.fn().mockImplementation(() => {
        expect(state.value).toBeGreaterThan(-1);

        // Make sure both cases are handled.
        return state.value === 2 ? undefined : clear;
      });

      const cleanup = effect(react);
      await Promise.resolve();

      expect(react).toHaveBeenCalledTimes(1);
      expect(clear).not.toHaveBeenCalled();

      state.value = 1;
      await Promise.resolve();

      expect(react).toHaveBeenCalledTimes(2);
      expect(clear).toHaveBeenCalledTimes(1);

      state.value = 2;
      await Promise.resolve();

      expect(react).toHaveBeenCalledTimes(3); // This call should return undefined.
      expect(clear).toHaveBeenCalledTimes(2);

      state.value = 3;
      await Promise.resolve();

      expect(react).toHaveBeenCalledTimes(4);
      expect(clear).toHaveBeenCalledTimes(2); // Should not be called again because the cleanup no longer defined.

      cleanup();
      state.value = 4;
      await Promise.resolve();

      expect(react).toHaveBeenCalledTimes(4);
      expect(clear).toHaveBeenCalledTimes(3); // Should be called again because last react return function again.
    });

    it('should run effect on browser only', () => {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('document', undefined);

      const handler = vi.fn();
      const cleanup1 = effect.client(handler);

      expect(typeof cleanup1).toBe('function');
      expect(handler).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
      const cleanup2 = effect.client(handler);

      expect(typeof cleanup2).toBe('function');
      expect(handler).toHaveBeenCalled();
    });
  });
});
