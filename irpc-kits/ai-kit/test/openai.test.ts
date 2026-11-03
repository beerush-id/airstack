import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatOptions, ChatOutput } from '../src/chat/index.js';
import { BASETEN_API, BasetenDriver } from '../src/drivers/baseten/index.js';
import { MUSE_API, MUSE_IMAGE_MODEL, MuseDriver } from '../src/drivers/muse/index.js';
import { OpenAIDriver } from '../src/drivers/openai/index.js';
import type { ImageOptions, ImageOutput } from '../src/image/index.js';
import type { AskContext, ImageContext } from '../src/types/context.js';
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

  it('sends the reasoning effort as reasoning_effort', async () => {
    const vendor = mockVendor(sse([chunk({ content: 'ok' }, 'stop')]));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3', reasoningEffort: 'low' });

    await meta().ask(ctx);

    expect(vendor.bodies[0].reasoning_effort).toBe('low');
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

  it('raises an upstream error on a failed response, for chat', async () => {
    mockVendor(new Response('rate limited', { status: 429 }));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });

    await expect(meta().ask(ctx)).rejects.toBeInstanceOf(DriverError);
    await expect(meta().ask(askContext('Hi', { model: 'muse-spark-1.3' }))).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });
});

/** A Responses API stream: one `event:` and `data:` frame per event, as the Meta Model API sends it. */
const responsesStream = (events: Array<Record<string, unknown>>) =>
  new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

const messageAdded = (id: string, phase?: string) => ({
  type: 'response.output_item.added',
  item: { id, type: 'message', role: 'assistant', status: 'in_progress', content: [], ...(phase ? { phase } : {}) },
});
const textDelta = (itemId: string, delta: string) => ({ type: 'response.output_text.delta', item_id: itemId, delta });
const callDone = (callId: string, name: string, args: string) => ({
  type: 'response.output_item.done',
  item: { type: 'function_call', id: `fc_${callId}`, call_id: callId, name, arguments: args, status: 'completed' },
});
const summaryPart = (index: number) => ({ type: 'response.reasoning_summary_part.added', summary_index: index });
const summaryDelta = (delta: string) => ({ type: 'response.reasoning_summary_text.delta', delta });
const completed = { type: 'response.completed', response: { status: 'completed' } };

const responsesMeta = () =>
  new OpenAIDriver({
    name: 'meta',
    baseUrl: 'https://api.meta.test/v1',
    apiKey: 'key-1',
    models: ['muse-spark-1.3'],
    api: 'responses',
  });

describe('OpenAIDriver responses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts instructions, input items, flat tools and a reasoning summary request', async () => {
    const vendor = mockVendor(responsesStream([messageAdded('m1'), textDelta('m1', 'ok'), completed]));
    const ctx = askContext('Read it', {
      model: 'muse-spark-1.3',
      system: 'You are Lita.',
      tools: [{ name: 'sys.fs.read', description: 'Reads a file', parameters: { type: 'object' } }],
    });

    await responsesMeta().ask(ctx);

    expect(vendor.requests[0].url).toBe('https://api.meta.test/v1/responses');
    expect(vendor.bodies[0]).toEqual({
      model: 'muse-spark-1.3',
      stream: true,
      instructions: 'You are Lita.',
      input: [{ role: 'user', content: 'Read it' }],
      tools: [{ type: 'function', name: 'sys__fs__read', description: 'Reads a file', parameters: { type: 'object' } }],
      reasoning: { summary: 'auto' },
    });
  });

  it('sends the reasoning effort with the summary request', async () => {
    const vendor = mockVendor(responsesStream([messageAdded('m1'), textDelta('m1', 'ok'), completed]));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3', reasoningEffort: 'minimal' });

    await responsesMeta().ask(ctx);

    expect(vendor.bodies[0].reasoning).toEqual({ summary: 'auto', effort: 'minimal' });
  });

  it('streams the answer into chunks and sets the text once at the end', async () => {
    mockVendor(responsesStream([messageAdded('m1'), textDelta('m1', 'Good '), textDelta('m1', 'morning.'), completed]));
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });

    await responsesMeta().ask(ctx);

    expect(ctx.state.data.chunks?.join('')).toBe('Good morning.');
    expect(ctx.state.data.text).toBe('Good morning.');
  });

  it('keeps commentary written around tool calls apart from the answer', async () => {
    mockVendor(
      responsesStream([
        messageAdded('c1', 'commentary'),
        textDelta('c1', "I'll read your note now."),
        callDone('call_1', 'sys__fs__read', '{"path":"~/notes/today.md"}'),
        completed,
      ])
    );
    const ctx = askContext('Read it', { model: 'muse-spark-1.3', tools: [{ name: 'sys.fs.read' }] });

    await responsesMeta().ask(ctx);

    expect(ctx.state.data.commentary?.join('')).toBe("I'll read your note now.");
    expect(ctx.state.data.chunks ?? []).toEqual([]);
    expect(ctx.state.data.text).toBe('');
  });

  it('streams reasoning summaries, separating summary parts with a blank line', async () => {
    mockVendor(
      responsesStream([
        summaryPart(0),
        summaryDelta('Checking the queue.'),
        summaryPart(1),
        summaryDelta('Picking the top three.'),
        messageAdded('m1'),
        textDelta('m1', 'Morning.'),
        completed,
      ])
    );
    const ctx = askContext('Brief me', { model: 'muse-spark-1.3' });

    await responsesMeta().ask(ctx);

    expect(ctx.state.data.reasoning?.join('')).toBe('Checking the queue.\n\nPicking the top three.');
    expect(ctx.state.data.text).toBe('Morning.');
  });

  it('returns completed function calls with decoded names and parsed arguments', async () => {
    mockVendor(
      responsesStream([
        callDone('call_1', 'sys__fs__read', '{"path":"~/a.txt"}'),
        callDone('call_2', 'handoff', '{"agent":"photos"'),
        completed,
      ])
    );
    const ctx = askContext('x', { model: 'muse-spark-1.3', tools: [{ name: 'sys.fs.read' }, { name: 'handoff' }] });

    await responsesMeta().ask(ctx);

    expect(ctx.state.data.toolCalls).toEqual([
      { id: 'call_1', name: 'sys.fs.read', args: { path: '~/a.txt' } },
      { id: 'call_2', name: 'handoff', args: '{"agent":"photos"' },
    ]);
  });

  it('replays earlier calls, their results and images as input items', async () => {
    const vendor = mockVendor(responsesStream([messageAdded('m1'), textDelta('m1', 'Done.'), completed]));
    const history: ChatMessage[] = [
      { role: 'user', type: 'text', text: 'What is this?', attachments: ['https://x.test/cat.png'] },
      {
        role: 'assistant',
        type: 'text',
        text: 'Looking.',
        toolCalls: [{ id: 'call_1', name: 'sys.fs.read', args: { path: '~/a.txt' } }],
      },
      { role: 'tool', type: 'object', toolCallId: 'call_1', data: { content: 'hello' } },
    ];
    const ctx = askContext(history, { model: 'muse-spark-1.3', tools: [{ name: 'sys.fs.read' }] });

    await responsesMeta().ask(ctx);

    expect(vendor.bodies[0].input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'What is this?' },
          { type: 'input_image', image_url: 'https://x.test/cat.png' },
        ],
      },
      { role: 'assistant', content: 'Looking.' },
      { type: 'function_call', call_id: 'call_1', name: 'sys__fs__read', arguments: '{"path":"~/a.txt"}' },
      { type: 'function_call_output', call_id: 'call_1', output: '{"content":"hello"}' },
    ]);
  });

  it('raises an upstream error when the response fails mid-stream', async () => {
    mockVendor(
      responsesStream([
        messageAdded('m1'),
        { type: 'response.failed', response: { status: 'failed', error: { message: 'model overloaded' } } },
      ])
    );
    const ctx = askContext('Hi', { model: 'muse-spark-1.3' });

    await expect(responsesMeta().ask(ctx)).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'meta response failed: model overloaded',
    });
  });
});

describe('OpenAIDriver draw', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const images = () =>
    new OpenAIDriver({
      name: 'meta',
      baseUrl: 'https://api.meta.test/v1',
      apiKey: 'key-1',
      models: ['muse-spark-1.3', 'muse-image-1.0'],
      defaultImageModel: 'muse-image-1.0',
    });

  function imageContext(payload: Record<string, unknown>): ImageContext {
    const input = payload as ImageOptions;
    return {
      state: { data: { id: 'img-1', status: 'pending', input } as ImageOutput },
      input,
      payload: input,
      rollbacks: new Set(),
    };
  }

  const imagesResponse = (data: Array<Record<string, string>>, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ created: 1, data, ...extra }), { headers: { 'Content-Type': 'application/json' } });

  it('generates from the prompt with the default image model, sending the ratio as a size', async () => {
    const vendor = mockVendor(imagesResponse([{ url: 'https://cdn.meta.test/1.webp' }]));
    const ctx = imageContext({ prompt: 'A grey sofa with an orange cat', aspectRatio: '4:3', format: 'jpeg' });

    await images().draw(ctx);

    expect(vendor.requests[0].url).toBe('https://api.meta.test/v1/images/generations');
    expect(vendor.bodies[0]).toEqual({
      model: 'muse-image-1.0',
      prompt: 'A grey sofa with an orange cat',
      size: '256x192',
      output_format: 'jpeg',
      response_format: 'url',
    });
    expect(ctx.state.data.url).toBe('https://cdn.meta.test/1.webp');
  });

  it('leaves edits to a driver that shapes them, since each provider does its own way', async () => {
    const vendor = mockVendor();
    const ctx = imageContext({ prompt: 'Remove the cat', attachments: ['https://cdn.test/sofa.jpg'] });

    await images().draw(ctx);

    expect(vendor.requests).toHaveLength(0);
    expect(ctx.state.data.url).toBeUndefined();
  });

  it('gives an image returned inline as a data URL', async () => {
    mockVendor(imagesResponse([{ b64_json: 'AAAA' }], { output_format: 'png' }));
    const ctx = imageContext({ prompt: 'A lantern' });

    await images().draw(ctx);

    expect(ctx.state.data.url).toBe('data:image/png;base64,AAAA');
  });

  it('leaves draws it can’t serve to other drivers: another model, or no image model', async () => {
    const vendor = mockVendor();
    const other = imageContext({ prompt: 'A lantern', model: 'flux-2' });
    await images().draw(other);
    await meta().draw(imageContext({ prompt: 'A lantern' }));

    expect(vendor.requests).toHaveLength(0);
    expect(other.state.data.url).toBeUndefined();
  });

  it('fails when the endpoint returns no image', async () => {
    mockVendor(imagesResponse([]));

    await expect(images().draw(imageContext({ prompt: 'A lantern' }))).rejects.toThrow('returned no image');
  });

  describe('BasetenDriver', () => {
    it('serves the models named by their Baseten slugs on Baseten, over Responses', async () => {
      const vendor = mockVendor(
        sse([
          { type: 'response.output_item.added', item: { id: 'm1', type: 'message' } },
          { type: 'response.output_text.delta', item_id: 'm1', delta: 'Hi.' },
          { type: 'response.completed' },
        ])
      );
      const baseten = new BasetenDriver({ apiKey: 'key-2', models: ['meta-models/muse-spark-open-1026'] });

      await baseten.ask(askContext('Hi', { model: 'meta-models/muse-spark-open-1026' }));

      expect(baseten.name).toBe('baseten');
      expect(vendor.requests[0].url).toBe(`${BASETEN_API}/responses`);
      expect(vendor.bodies[0]).toMatchObject({ model: 'meta-models/muse-spark-open-1026', stream: true });
    });
  });

  describe('MuseDriver', () => {
    it('serves Muse on the Meta Model API by default: its chat models over Responses, and Muse Image', async () => {
      const vendor = mockVendor(imagesResponse([{ url: 'https://cdn.meta.test/1.webp' }]));
      const muse = new MuseDriver({ apiKey: 'key-1' });
      const ctx = imageContext({ prompt: 'A lantern' });

      await muse.draw(ctx);

      expect(muse.name).toBe('meta');
      expect(vendor.requests[0].url).toBe(`${MUSE_API}/images/generations`);
      expect(vendor.bodies[0]).toMatchObject({ model: MUSE_IMAGE_MODEL, prompt: 'A lantern' });
      expect(ctx.state.data.url).toBe('https://cdn.meta.test/1.webp');
    });

    it('edits the attached images by the prompt, sent as URLs in JSON', async () => {
      const vendor = mockVendor(imagesResponse([{ url: 'https://cdn.meta.test/2.webp' }]));
      const ctx = imageContext({
        prompt: 'Remove the cat',
        attachments: ['https://cdn.test/sofa.jpg'],
        aspectRatio: 'auto',
      });

      await new MuseDriver({ apiKey: 'key-1', baseUrl: 'https://api.meta.test/v1' }).draw(ctx);

      expect(vendor.requests[0].url).toBe('https://api.meta.test/v1/images/edits');
      expect(vendor.bodies[0]).toEqual({
        model: MUSE_IMAGE_MODEL,
        prompt: 'Remove the cat',
        images: [{ image_url: 'https://cdn.test/sofa.jpg' }],
        response_format: 'url',
      });
      expect(ctx.state.data.url).toBe('https://cdn.meta.test/2.webp');
    });

    it('leaves an edit whose attachment is a file still to upload', async () => {
      const vendor = mockVendor();
      const ctx = imageContext({ prompt: 'Remove the cat', attachments: [new File(['x'], 'a.png')] });

      await new MuseDriver({ apiKey: 'key-1' }).draw(ctx);

      expect(vendor.requests).toHaveLength(0);
      expect(ctx.state.data.url).toBeUndefined();
    });
  });
});
