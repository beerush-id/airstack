import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RollbackFn } from '../../src/types/index.js';
import { runRollbacks } from '../../src/utils/index.js';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('runRollbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes registered rollback handlers in strict LIFO order', async () => {
    const order: string[] = [];
    const rollbacks = new Set([() => order.push('first'), () => order.push('second'), () => order.push('third')]);

    await runRollbacks(rollbacks as unknown as Set<RollbackFn>);

    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('passes the triggering error to every rollback handler', async () => {
    const received: Array<Error | undefined> = [];
    const error = new Error('upstream failed');
    const rollbacks = new Set([(cause?: Error) => received.push(cause), (cause?: Error) => received.push(cause)]);

    await runRollbacks(rollbacks as unknown as Set<RollbackFn>, error);

    expect(received).toEqual([error, error]);
  });

  it('invokes rollbacks without an error argument when none is supplied', async () => {
    const received: Array<Error | undefined> = [];
    const rollbacks = new Set([(cause?: Error) => received.push(cause)]);

    await runRollbacks(rollbacks as unknown as Set<RollbackFn>);

    expect(received).toEqual([undefined]);
  });

  it('executes every handler even when individual rollbacks throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const order: string[] = [];
    const rollbacks = new Set([
      () => order.push('first'),
      () => {
        throw new Error('rollback failed');
      },
      async () => {
        await delay(1);
        order.push('third');
      },
    ]);

    await runRollbacks(rollbacks as unknown as Set<RollbackFn>);

    expect(order).toEqual(['third', 'first']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('aggregates rollback failures as warnings without masking or rejecting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failureA = new Error('A failed');
    const failureB = new Error('B failed');
    const rollbacks = new Set([
      () => {
        throw failureA;
      },
      () => {
        throw failureB;
      },
    ]);

    await expect(runRollbacks(rollbacks)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[AIAdapter] Rollback execution warnings:', [failureB, failureA]);
  });

  it('awaits asynchronous rollback handlers sequentially in LIFO order', async () => {
    const order: string[] = [];
    const rollbacks = new Set([
      async () => {
        await delay(5);
        order.push('first');
      },
      async () => {
        await delay(1);
        order.push('second');
      },
    ]);

    await runRollbacks(rollbacks);

    expect(order).toEqual(['second', 'first']);
  });

  it('resolves without warnings for an empty rollback registry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runRollbacks(new Set())).resolves.toBeUndefined();

    expect(warn).not.toHaveBeenCalled();
  });
});
