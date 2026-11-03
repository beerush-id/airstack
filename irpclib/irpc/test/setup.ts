import { anchor } from '@airlib/core';
import { afterEach, beforeEach, vi } from 'vitest';

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

// Reset mocks before each test
beforeEach(() => {
  anchor.configure({ globalScopeWarning: false });
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  // Set up fake timers for all tests
  vi.useFakeTimers();
});

// Clean up after each test
afterEach(() => {
  errorSpy.mockRestore();
  logSpy.mockRestore();

  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
