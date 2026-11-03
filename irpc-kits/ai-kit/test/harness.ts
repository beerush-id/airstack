import { withContext } from '@irpclib/irpc';
import { vi } from 'vitest';
import type { AIInstance } from '../src/client.js';
import { createAI } from '../src/client.js';
import type { AIDriver } from '../src/types/driver.js';
import type { AIWorker } from '../src/worker.js';
import { createWorker } from '../src/worker.js';

export interface TestHarness {
  instance: AIInstance;
  worker: AIWorker;
  /** Outbound vendor requests captured from the driver, in wire order. */
  vendorRequests: Request[];
  /** Parsed JSON bodies of the driver's outbound vendor POSTs, in wire order (null for GETs). */
  vendorBodies: unknown[];
  /** Runs the callback inside an isolated request context. */
  run: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface HarnessOptions {
  driver: AIDriver;
  defaults?: Record<string, unknown>;
  /** Canned outbound vendor responses, consumed in wire order. */
  vendorQueue: Response[];
}

/**
 * Creates a real client/worker pair over an in-process HTTP pipeline with the given pipeline
 * driver registered. Every library layer is live (declare, construct, stream, router,
 * transport, adapter, driver); only the socket is intercepted: client-to-worker calls are
 * routed through worker.fetch, and the driver's outbound vendor calls are answered from the
 * canned vendor queue.
 */
export function createHarness(options: HarnessOptions) {
  const instance = createAI({
    name: 'ai-kit-session-test',
  });
  const worker = createWorker(instance, { defaults: options.defaults });
  worker.use(options.driver);

  const vendorRequests: Request[] = [];
  const vendorBodies: unknown[] = [];
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input instanceof Request ? input : String(input), init);
    if (request.url.startsWith('http://ai.test/irpc')) {
      return worker.fetch(request);
    }
    vendorRequests.push(request);
    vendorBodies.push(
      request.method === 'POST'
        ? await request
            .clone()
            .json()
            .catch(() => null)
        : null
    );
    return options.vendorQueue.shift() ?? new Response('{}', { status: 200 });
  });

  return { instance, worker, fetchMock, vendorRequests, vendorBodies, run: withContext };
}
