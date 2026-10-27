import { withContext } from '@irpclib/irpc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatOutput } from '../src/chat/index.js';
import { createAI } from '../src/client.js';
import type { AIDriver } from '../src/types/driver.js';
import { createWorker } from '../src/worker.js';

/** Builds a chat driver echoing the caller input back as the assistant response. */
function echoDriver(): AIDriver {
  return {
    name: 'echo',
    ask: (ctx) => {
      const prompt = Array.isArray(ctx.input)
        ? ctx.input.map((turn) => (turn.type === 'text' ? turn.text : '[object]')).join(' | ')
        : typeof ctx.input === 'string'
          ? ctx.input
          : ctx.input.type === 'text'
            ? ctx.input.text
            : '[object]';
      ctx.state.data.text = `Echo: ${prompt}`;
    },
  };
}

describe('AI Kit Facades', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes end-to-end chat calls through the worker HTTP pipeline', async () => {
    const instance = createAI({ name: 'ai-kit-test' });
    const worker = createWorker(instance);
    worker.use(echoDriver());

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input instanceof Request ? input : String(input), init);
      return worker.fetch(request);
    });

    await withContext(async () => {
      const output = (await instance.ask('Hello AirLib')) as ChatOutput;
      expect(output.text).toBe('Echo: Hello AirLib');
      expect(output.status).toBe('success');
    });
  });

  it('streams driver mutations through the reactive state progressively before resolution', async () => {
    const instance = createAI({ name: 'ai-kit-test' });
    const worker = createWorker(instance);

    let releaseSecondToken: (() => void) | undefined;
    const secondToken = new Promise<void>((resolve) => {
      releaseSecondToken = resolve;
    });

    worker.use({
      name: 'progressive',
      ask: async (ctx) => {
        ctx.state.data.text = 'token1';
        await secondToken;
        ctx.state.data.text = 'token1 token2';
      },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input instanceof Request ? input : String(input), init);
      return worker.fetch(request);
    });

    await withContext(async () => {
      const reader = instance.ask('Hello AirLib');

      // The first mutation must reach the client reactively while the stream is still open.
      const deadline = Date.now() + 2000;
      while (reader.data?.text !== 'token1' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(reader.data?.text).toBe('token1');

      releaseSecondToken?.();
      const output = await reader;
      expect(output.text).toBe('token1 token2');
      expect(output.status).toBe('success');
    });
  });

  it('exposes the worker facade with fluent driver and tool registration', () => {
    const instance = createAI({ name: 'ai-kit-test' });
    const worker = createWorker(instance);

    expect(worker.use(echoDriver())).toBe(worker);
    expect(worker.adapter.drivers).toHaveLength(1);
    expect(worker.adapter.models).toBeTypeOf('function');
    expect(worker.fetch).toBeTypeOf('function');
  });
});
