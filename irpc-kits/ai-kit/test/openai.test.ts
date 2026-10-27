import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatOptions, ChatOutput } from '../src/chat/index.js';
import { OpenAIDriver } from '../src/drivers/openai/index.js';
import type { AskContext } from '../src/types/context.js';
import { DriverError } from '../src/types/errors.js';

/** Builds an SSE response body from JSON events, ending with the `[DONE]` frame. */
const sse = (events: unknown[]) =>
  new Response(`${[...events.map((event) => JSON.stringify(event)), '[DONE]'].map((d) => `data: ${d}\n\n`).join('')}`, {
    headers: { 'Content-Type': 'text/event-stream' },
  });

/** One Chat Completions stream chunk carrying the given delta. */
const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({
  choices: [{ index: 0, delta, finish_reason: finish }],
});

function askContext(input: string | ChatMessage[], payload: Record<string, unknown>, signal?: AbortSignal): AskContext {
  return {
    state: { data: { id: 'out-1', status: 'pending', input, role: 'assistant', type: 'text', text: '' } as ChatOutput },
    input,
    payload: payload as ChatOptions,
    rollbacks: new Set(),
    signal,
  };
}

/** Answers every vendor request with the queued responses, recording requests and parsed bodies. */
function mockVendor(...responses: Response[]) {
  const requests: Request[] = [];
  const bodies: Record<string, unknown>[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input instanceof Request ? input : String(input), init);
    requests.push(request);
    bodies.push(await request.clone().json());
    return responses.shift() ?? new Response('{}', { status: 500 });
  });
  return { requests, bodies, spy };
}

const meta = () =>
  new OpenAIDriver({
    name: 'meta',
    baseUrl: 'https://api.meta.test/v1',
    apiKey: 'key-1',
    models: ['muse-spark-1.3'],
  });

describe('OpenAIDriver chat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams text deltas into the output', async () => {
    const vendor = mockVendor(
      sse([chunk({ role: 'assistant', content: 'Good ' }), chunk({ content: 'morning.' }, 'stop')])
    );
    const ctx = askContext('Hi', { model: 'muse-spark-1.3', system: 'You are Lita.' });

    await meta().ask(ctx);

    expect(ctx.state.data.text).toBe('Good morning.');
    expect(vendor.requests[0].url).toBe('https://api.meta.test/v1/chat/completions');
    expect(vendor.requests[0].headers.get('Authorization')).toBe('Bearer key-1');
    expect(vendor.bodies[0]).toMatchObject({
      model: 'muse-spark-1.3',
      stream: true,
      messages: [
        { role: 'system', content: 'You are Lita.' },
        { role: 'user', content: 'Hi' },
      ],
    });
  });

  it('pushes the deltas of each time window as one chunk, and sets the text once at the end', async () => {
    const encoder = new TextEncoder();
    const frame = (delta: Record<string, unknown>) => encoder.encode(`data: ${JSON.stringify(chunk(delta))}\n\n`);
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(frame({ content: 'Good ' }));
        controller.enqueue(frame({ content: 'mor' }));
        await new Promise((resolve) => setTimeout(resolve, 60));
        controller.enqueue(frame({ content: 'ning.' }));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    mockVendor(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });
    const texts: Array<string | undefined> = [];
    const output = ctx.state.data;
    const chunks: string[] = [];
    Object.defineProperty(output, 'chunks', {
      get: () => chunks,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(output, 'text', {
      get: () => texts.at(-1),
      set: (value: string) => texts.push(value),
      configurable: true,
    });

    await meta().ask(ctx);

    expect(chunks).toEqual(['Good mor', 'ning.']);
    expect(texts).toEqual(['Good morning.']);
  });

  it('keeps reasoning out of the text', async () => {
    mockVendor(sse([chunk({ reasoning_content: 'The user greets.' }), chunk({ content: 'Hello.' }, 'stop')]));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });

    await meta().ask(ctx);

    expect(ctx.state.data.text).toBe('Hello.');
  });

  it('sends tools with names the provider accepts', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'ok' }, 'stop')]));
    const ctx = askContext('Read it', {
      model: 'muse-spark-1.3',
      tools: [
        {
          name: 'sys.fs.read',
          description: 'Reads a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
      ],
    });

    await meta().ask(ctx);

    expect(vendor.bodies[0].tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'sys__fs__read',
          description: 'Reads a file',
          parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
      },
    ]);
  });

  it('assembles streamed tool calls and decodes their names', async () => {
    mockVendor(
      sse([
        chunk({
          role: 'assistant',
          tool_calls: [
            { index: 0, id: 'call_1', type: 'function', function: { name: 'sys__fs__read', arguments: '' } },
          ],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '{"pa' } }] }),
        chunk({
          tool_calls: [
            { index: 0, function: { arguments: 'th":"~/a.txt"}' } },
            {
              index: 1,
              id: 'call_2',
              type: 'function',
              function: { name: 'handoff', arguments: '{"agent":"photos"}' },
            },
          ],
        }),
        chunk({}, 'tool_calls'),
      ])
    );
    const ctx = askContext('Read it', {
      model: 'muse-spark-1.3',
      tools: [{ name: 'sys.fs.read' }, { name: 'handoff' }],
    });

    await meta().ask(ctx);

    expect(ctx.state.data.toolCalls).toEqual([
      { id: 'call_1', name: 'sys.fs.read', args: { path: '~/a.txt' } },
      { id: 'call_2', name: 'handoff', args: { agent: 'photos' } },
    ]);
  });

  it('keeps invalid tool arguments as the raw string', async () => {
    mockVendor(
      sse([
        chunk({
          tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'handoff', arguments: '{"a' } }],
        }),
        chunk({}, 'tool_calls'),
      ])
    );
    const ctx = askContext('x', { model: 'muse-spark-1.3', tools: [{ name: 'handoff' }] });

    await meta().ask(ctx);

    expect(ctx.state.data.toolCalls).toEqual([{ id: 'c1', name: 'handoff', args: '{"a' }]);
  });

  it('replays earlier tool calls and their results in the history', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'Done.' }, 'stop')]));
    const history: ChatMessage[] = [
      { role: 'user', type: 'text', text: 'Read it' },
      {
        role: 'assistant',
        type: 'text',
        text: '',
        toolCalls: [{ id: 'call_1', name: 'sys.fs.read', args: { path: '~/a.txt' } }],
      },
      { role: 'tool', type: 'object', toolCallId: 'call_1', data: { content: 'hello' } },
    ];
    const ctx = askContext(history, { model: 'muse-spark-1.3', tools: [{ name: 'sys.fs.read' }] });

    await meta().ask(ctx);

    expect(vendor.bodies[0].messages).toEqual([
      { role: 'user', content: 'Read it' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'sys__fs__read', arguments: '{"path":"~/a.txt"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"content":"hello"}' },
    ]);
  });

  it('sends user attachments as image parts', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'A cat.' }, 'stop')]));
    const ctx = askContext(
      [{ role: 'user', type: 'text', text: 'What is this?', attachments: ['https://x.test/cat.png'] }],
      {
        model: 'muse-spark-1.3',
      }
    );

    await meta().ask(ctx);

    expect(vendor.bodies[0].messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'https://x.test/cat.png' } },
        ],
      },
    ]);
  });

  it('uses its default model when the call names none', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'ok' }, 'stop')]));
    const driver = new OpenAIDriver({
      name: 'baseten',
      baseUrl: 'https://inference.baseten.test/v1',
      apiKey: 'key-2',
      models: ['meta-models/muse-spark-open'],
      defaultModel: 'meta-models/muse-spark-open',
    });

    await driver.ask(askContext('Hi', {}));

    expect(vendor.bodies[0].model).toBe('meta-models/muse-spark-open');
  });

  it('leaves models it does not serve to other drivers', async () => {
    const vendor = mockVendor();
    const ctx = askContext('Hi', { model: 'claude-sonnet-5' });

    await meta().ask(ctx);

    expect(vendor.spy).not.toHaveBeenCalled();
    expect(ctx.state.data.text).toBe('');
  });

  it('skips an output an earlier driver already served', async () => {
    const vendor = mockVendor();
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });
    ctx.state.data.text = 'served';

    await meta().ask(ctx);

    expect(vendor.spy).not.toHaveBeenCalled();
  });

  it('passes the abort signal to the provider request', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'ok' }, 'stop')]));
    const controller = new AbortController();
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' }, controller.signal);

    await meta().ask(ctx);

    expect(vendor.spy.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('raises an upstream error on a failed response', async () => {
    mockVendor(new Response('rate limited', { status: 429 }));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });

    await expect(meta().ask(ctx)).rejects.toBeInstanceOf(DriverError);
    await expect(meta().ask(askContext('Hi', { model: 'muse-spark-1.3' }))).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });
});
