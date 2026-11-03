import type { IRPCPackage } from '@irpclib/irpc';
import { IRPCFile, withContext } from '@irpclib/irpc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIAdapter } from '../src/adapter/index.js';
import type { AIInstance } from '../src/client.js';
import { createAI } from '../src/client.js';
import { KIEDriver } from '../src/drivers/kie/index.js';
import { createWorker } from '../src/worker.js';
import { createHarness } from './harness.js';

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });

const sse = (frames: string[]) =>
  new Response(frames.map((frame) => `data: ${frame}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

describe('AIWorker (real driver pipeline)', () => {
  let envInstance: AIInstance | undefined;

  afterEach(() => {
    envInstance?.module.configure({ bypassLocal: false });
    envInstance = undefined;
    vi.restoreAllMocks();
  });

  it('resolves KIE options from the worker env over constructor options', async () => {
    // The driver is constructed with a placeholder key; the real credentials arrive
    // through the worker env binding and must win over the constructor options.
    const instance = createAI({ name: 'ai-kit-env-test' });
    envInstance = instance;
    const worker = createWorker(instance).use(
      new KIEDriver({ apiKey: 'constructor-key', defaultModels: { chat: 'claude-sonnet-5' } })
    );

    const vendorQueue: Response[] = [];
    vendorQueue.push(sse(['{"type":"content_block_delta","delta":{"text":"env answer"}}', '[DONE]']));
    const vendorRequests: Request[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      // The default client transport fetches a relative endpoint; resolve it against a
      // test origin so worker.fetch's pathname check receives an absolute URL.
      const request = new Request(input instanceof Request ? input : new URL(String(input), 'http://ai.test'), init);
      if (request.url.includes('/irpc-ai-kit')) {
        // The env binding a Cloudflare Workers runtime would pass as the second argument.
        return worker.fetch(request, { KIE_ENV: { apiKey: 'env-key', baseUrl: 'https://env.kie.ai' } });
      }
      vendorRequests.push(request);
      return vendorQueue.shift() ?? new Response('{}', { status: 200 });
    });

    await withContext(async () => {
      // Wire-path isolation: bypass the locally registered handlers so the call traverses
      // worker.fetch and the env binding is seeded through router.resolve.
      instance.module.configure({ bypassLocal: true });

      const output = await instance.ask('Hello env');
      expect(output.text).toBe('env answer');

      // The vendor call must carry the env-resolved credentials, not the constructor's.
      expect(vendorRequests).toHaveLength(1);
      expect(vendorRequests[0].url).toBe('https://env.kie.ai/claude/v1/messages');
      expect(vendorRequests[0].headers.get('authorization')).toBe('Bearer env-key');
    });
  });

  it('routes chat.ask through the adapter to the KIE driver and streams the response', async () => {
    const vendorQueue: Response[] = [];
    vendorQueue.push(sse(['{"type":"content_block_delta","delta":{"text":"worker answer"}}', '[DONE]']));
    const { instance, run } = createHarness({
      driver: new KIEDriver({ apiKey: 'k', defaultModels: { chat: 'claude-sonnet-5' } }),
      vendorQueue,
    });

    await run(async () => {
      const output = await instance.ask('Hello worker');
      expect(output.text).toBe('worker answer');
      expect(output.status).toBe('success');
    });
  });

  it('routes every media procedure through the adapter to the KIE task pipeline', async () => {
    const vendorQueue: Response[] = [];
    vendorQueue.push(
      json({ data: { taskId: 'img-1' } }),
      json({ data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://img/1.png'] }) } })
    );
    vendorQueue.push(
      json({ data: { taskId: 'vid-1' } }),
      json({ data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://cdn/clip.mp4'] }) } })
    );
    vendorQueue.push(
      json({ data: { taskId: 'spk-1' } }),
      json({ data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://cdn/voice.mp3'] }) } })
    );
    vendorQueue.push(json({ choices: [{ message: { content: 'transcribed words' } }] }));
    vendorQueue.push(
      json({ data: { taskId: 'cmp-1' } }),
      json({
        data: {
          state: 'success',
          resultJson: JSON.stringify([{ audio_url: 'https://cdn/track.mp3', title: 'Track', duration: 90 }]),
        },
      })
    );
    const { instance, run } = createHarness({
      driver: new KIEDriver({
        apiKey: 'k',
        pollInterval: 1,
        defaultModels: {
          image: 'flux-2-pro',
          video: 'kling-3-omni',
          speak: 'elevenlabs-tts',
          transcribe: 'gemini-3-pro',
          compose: 'suno',
        },
      }),
      vendorQueue,
    });

    await run(async () => {
      const image = await instance.draw('A lake');
      expect(image.url).toBe('https://img/1.png');

      const video = await instance.film('Waves');
      expect(video.url).toBe('https://cdn/clip.mp4');

      const voice = await instance.speak('Welcome');
      expect(voice.url).toBe('https://cdn/voice.mp3');

      const memo = await instance.transcribe('https://example.com/memo.mp3');
      expect(memo.text).toBe('transcribed words');

      const song = await instance.compose('Synthwave');
      expect(song.url).toBe('https://cdn/track.mp3');
      expect(song.title).toBe('Track');
    });
  });

  it('routes media.upscale through the adapter to the Topaz task pipeline', async () => {
    const vendorQueue: Response[] = [];
    vendorQueue.push(
      json({ data: { taskId: 'up-1' } }),
      json({ data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://cdn/big.png'] }) } })
    );
    vendorQueue.push(
      json({ data: { taskId: 'up-2' } }),
      json({ data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://cdn/big.mp4'] }) } })
    );
    const { instance, run } = createHarness({ driver: new KIEDriver({ apiKey: 'k', pollInterval: 1 }), vendorQueue });

    await run(async () => {
      const image = await instance.upscale({ type: 'image', url: 'https://cdn/in.png' });
      expect(image.url).toBe('https://cdn/big.png');

      const video = await instance.upscale({ type: 'video', url: 'https://cdn/in.mp4' });
      expect(video.url).toBe('https://cdn/big.mp4');
    });
  });

  it('routes media.upload through the adapter to the KIE file service', async () => {
    const vendorQueue: Response[] = [
      json({ code: 200, data: { downloadUrl: 'https://tempfile.redpandaai.co/in.png' } }),
    ];
    const { instance, run } = createHarness({ driver: new KIEDriver({ apiKey: 'k' }), vendorQueue });
    const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));

    await run(async () => {
      const urls = await instance.upload([{ file, path: 'inputs' }]);
      expect(urls).toEqual(['https://tempfile.redpandaai.co/in.png']);
    });
  });

  it('resolves the fixed model catalog through the worker with filters applied', async () => {
    const { instance, run } = createHarness({ driver: new KIEDriver({ apiKey: 'k' }), vendorQueue: [] });

    await run(async () => {
      const images = await instance.models({ type: 'image' });
      expect(images).toHaveLength(11);
      expect(images.map((model) => model.id)).toContain('flux-2-pro');
      expect(images.map((model) => model.id)).toContain('topaz-image-upscale');
    });
  });

  it('registers drivers and tool packages fluently onto the underlying adapter', () => {
    const { worker } = createHarness({ driver: new KIEDriver({ apiKey: 'k' }), vendorQueue: [] });
    const middleware = { name: 'middleware' };
    const toolModule = {} as IRPCPackage;

    expect(worker.use(middleware)).toBe(worker);
    expect(worker.useTool(toolModule)).toBe(worker);
    expect(worker.adapter.drivers).toContain(middleware);
    expect(worker.adapter.tools).toContain(toolModule);
  });

  it('serves with an adapter the server already runs, so its drivers are set up once', () => {
    const shared = new AIAdapter();
    const worker = createWorker(createAI({ name: 'ai-kit-shared-test' }), { adapter: shared });

    expect(worker.adapter).toBe(shared);
  });
});
