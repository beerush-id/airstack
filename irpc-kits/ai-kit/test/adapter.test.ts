import type { IRPCPackage } from '@irpclib/irpc';
import { IRPCFile } from '@irpclib/irpc';
import { describe, expect, it, vi } from 'vitest';
import { AIAdapter } from '../src/adapter/index.js';
import { MODEL_CATALOG } from '../src/catalog.js';
import type { AudioOutput, ChatOutput, ImageOutput, TranscriptOutput, VideoOutput } from '../src/index.js';
import type { UpscaleOutput } from '../src/media/index.js';
import type {
  AskContext,
  AudioContext,
  ImageContext,
  TranscriptContext,
  UpscaleContext,
  VideoContext,
} from '../src/types/context.js';
import type { AIDriver } from '../src/types/driver.js';
import { AbortError, DriverError } from '../src/types/errors.js';
import type { LifecycleCtx } from '../src/types/index.js';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Creates an in-memory streaming lifecycle harness for adapter dispatches. */
function makeLifecycle<T>(signal?: AbortSignal) {
  const state: { data?: T } = {};
  const resolve = vi.fn();
  const reject = vi.fn();
  return {
    lifecycle: { state, signal, resolve, reject } as LifecycleCtx<T>,
    state,
    resolve,
    reject,
  };
}

describe('AIAdapter', () => {
  describe('registration', () => {
    it('registers drivers and tool packages fluently', () => {
      const adapter = new AIAdapter();
      const driver: AIDriver = { name: 'stub' };
      const module = {} as IRPCPackage;

      expect(adapter.use(driver)).toBe(adapter);
      expect(adapter.useTool(module)).toBe(adapter);
      expect(adapter.drivers).toBeInstanceOf(Set);
      expect([...adapter.drivers]).toEqual([driver]);
      expect(adapter.tools).toEqual([module]);
      expect(adapter.use(driver).drivers.size).toBe(1);
    });
  });

  describe('models', () => {
    it('serves the fixed library catalog regardless of registered drivers', async () => {
      const adapter = new AIAdapter().use({ name: 'kie' });

      const models = await adapter.models();

      expect(models).toEqual(MODEL_CATALOG);
    });

    it('narrows the catalog by type and case-insensitive search', async () => {
      const adapter = new AIAdapter();

      const images = await adapter.models({ type: 'image' });
      const audio = await adapter.models({ type: ['chat', 'audio'] });
      const flux = await adapter.models({ search: 'FLUX' });

      expect(images.every((model) => model.type === 'image')).toBe(true);
      expect(audio.every((model) => model.type === 'chat' || model.type === 'audio')).toBe(true);
      expect(flux.map((model) => model.id)).toEqual(['flux-2-pro', 'flux-2-flex', 'flux-2-pro-edit']);
    });
  });

  describe('ask', () => {
    it('seeds a pending assistant output, runs drivers sequentially, and finalizes success', async () => {
      const observed: string[] = [];
      const entryStatuses: string[] = [];
      const captured: AskContext[] = [];
      const middleware: AIDriver = {
        name: 'middleware',
        ask: (ctx) => {
          observed.push('middleware');
          entryStatuses.push(ctx.state.data.status);
          captured.push(ctx as never);
          ctx.payload.system = 'refined';
        },
      };
      const provider: AIDriver = {
        name: 'provider',
        ask: (ctx) => {
          observed.push('provider');
          captured.push(ctx as never);
          ctx.state.data.text = 'answer';
        },
      };
      const adapter = new AIAdapter().use(middleware).use(provider);
      const { lifecycle, state, resolve, reject } = makeLifecycle<ChatOutput>();

      await adapter.ask('What is AirLib?', { temperature: 0.2 }, lifecycle);

      expect(observed).toEqual(['middleware', 'provider']);
      expect(entryStatuses).toEqual(['pending']);
      const output = state.data!;
      expect(output.id).toEqual(expect.any(String));
      expect(output.status).toBe('success');
      expect(output.role).toBe('assistant');
      expect(output.type).toBe('text');
      expect(output.text).toBe('answer');
      expect(output.input).toBe('What is AirLib?');
      expect(captured[0].state.data).toBe(output);
      expect(captured[0].payload).toBe(captured[1].payload);
      expect(captured[1].payload.system).toBe('refined');
      expect(captured[1].payload.temperature).toBe(0.2);
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(reject).not.toHaveBeenCalled();
    });

    it('merges instance defaults beneath call options', async () => {
      let payload: Record<string, unknown> | undefined;
      const provider: AIDriver = {
        name: 'provider',
        ask: (ctx) => {
          payload = ctx.payload;
        },
      };
      const adapter = new AIAdapter({ model: 'gpt-x' }).use(provider);

      await adapter.ask('Hello', { temperature: 0.2 }, makeLifecycle<ChatOutput>().lifecycle);

      expect(payload).toEqual({ model: 'gpt-x', temperature: 0.2 });
    });

    it('skips drivers without the chat capability', async () => {
      let asked = false;
      const passive: AIDriver = { name: 'passive' };
      const provider: AIDriver = {
        name: 'provider',
        ask: (ctx) => {
          asked = true;
          ctx.state.data.text = 'answer';
        },
      };
      const adapter = new AIAdapter().use(passive).use(provider);

      await adapter.ask('Hello', undefined, makeLifecycle<ChatOutput>().lifecycle);

      expect(asked).toBe(true);
    });

    it('executes rollbacks in LIFO order, marks the output as errored, and propagates the error', async () => {
      const rolledBack: string[] = [];
      let downstreamRan = false;
      const error = new DriverError('upstream down', 'failing', 'UPSTREAM_ERROR');
      const failing: AIDriver = {
        name: 'failing',
        ask: (ctx) => {
          ctx.rollbacks.add(() => rolledBack.push('first') as never);
          ctx.rollbacks.add(async () => {
            rolledBack.push('second');
          });
          throw error;
        },
      };
      const downstream: AIDriver = {
        name: 'downstream',
        ask: () => {
          downstreamRan = true;
        },
      };
      const adapter = new AIAdapter().use(failing).use(downstream);
      const { lifecycle, state, resolve, reject } = makeLifecycle<ChatOutput>();

      await adapter.ask('Hello', undefined, lifecycle);

      expect(downstreamRan).toBe(false);
      expect(rolledBack).toEqual(['second', 'first']);
      expect(state.data!.status).toBe('error');
      expect(state.data!.error).toEqual({ name: 'DriverError', message: 'upstream down' });
      expect(reject).toHaveBeenCalledTimes(1);
      expect(reject.mock.calls[0][0]).toBe(error);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('tears down immediately on client abort with LIFO rollbacks and an AbortError rejection', async () => {
      const rolledBack: string[] = [];
      const controller = new AbortController();
      const slow: AIDriver = {
        name: 'slow',
        ask: async (ctx) => {
          ctx.rollbacks.add(() => rolledBack.push('cleanup') as never);
          await delay(50);
          ctx.state.data.text = 'never';
        },
      };
      const adapter = new AIAdapter().use(slow);
      const { lifecycle, state, resolve, reject } = makeLifecycle<ChatOutput>(controller.signal);

      const pending = adapter.ask('Hello', undefined, lifecycle);
      // The abort listener registers one microtask after the call; a real abort always arrives after.
      await Promise.resolve();
      controller.abort();
      await pending;

      expect(rolledBack).toEqual(['cleanup']);
      expect(state.data!.status).toBe('aborted');
      expect(reject).toHaveBeenCalledTimes(1);
      expect(reject.mock.calls[0][0]).toBeInstanceOf(AbortError);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('aborts immediately without dispatching drivers when the signal is already aborted', async () => {
      let asked = false;
      const provider: AIDriver = {
        name: 'provider',
        ask: () => {
          asked = true;
        },
      };
      const adapter = new AIAdapter().use(provider);
      const controller = new AbortController();
      controller.abort();
      const { lifecycle, state, resolve, reject } = makeLifecycle<ChatOutput>(controller.signal);

      await adapter.ask('Hello', undefined, lifecycle);

      expect(asked).toBe(false);
      expect(state.data!.status).toBe('aborted');
      expect(reject.mock.calls[0][0]).toBeInstanceOf(AbortError);
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('draw', () => {
    it('normalizes raw prompt strings and merges instance defaults into the payload', async () => {
      let captured: ImageContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        draw: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.example.com/lake.webp';
        },
      };
      const adapter = new AIAdapter({ aspectRatio: '16:9' }).use(provider);
      const { lifecycle, state, resolve } = makeLifecycle<ImageOutput>();

      await adapter.draw('A serene mountain lake at dawn', lifecycle);

      expect(captured!.input).toEqual({ prompt: 'A serene mountain lake at dawn' });
      expect(captured!.payload).toEqual({ prompt: 'A serene mountain lake at dawn', aspectRatio: '16:9' });
      expect(captured!.rollbacks).toBeInstanceOf(Set);
      expect(state.data!.input).toEqual({ prompt: 'A serene mountain lake at dawn' });
      expect(state.data!.url).toBe('https://cdn.example.com/lake.webp');
      expect(state.data!.status).toBe('success');
      expect(resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe('film', () => {
    it('normalizes raw prompt strings into video options and streams the output', async () => {
      let captured: VideoContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        film: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.example.com/waves.mp4';
        },
      };
      const adapter = new AIAdapter().use(provider);
      const { lifecycle, state } = makeLifecycle<VideoOutput>();

      await adapter.film('Waves gently lapping against the shore', lifecycle);

      expect(captured!.input).toEqual({ prompt: 'Waves gently lapping against the shore' });
      expect(captured!.payload).toEqual({ prompt: 'Waves gently lapping against the shore' });
      expect(state.data!.url).toBe('https://cdn.example.com/waves.mp4');
      expect(state.data!.status).toBe('success');
    });
  });

  describe('upscale', () => {
    it('seeds the upscale output and dispatches the media input to the driver capability', async () => {
      let captured: UpscaleContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        upscale: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.example.com/in-big.png';
        },
      };
      const adapter = new AIAdapter().use(provider);
      const { lifecycle, state } = makeLifecycle<UpscaleOutput>();

      await adapter.upscale({ type: 'image', url: 'https://cdn.example.com/in.png' }, lifecycle);

      expect(captured!.input).toEqual({ type: 'image', url: 'https://cdn.example.com/in.png' });
      expect(captured!.payload).toEqual({ type: 'image', url: 'https://cdn.example.com/in.png' });
      expect(state.data!.input).toEqual({ type: 'image', url: 'https://cdn.example.com/in.png' });
      expect(state.data!.url).toBe('https://cdn.example.com/in-big.png');
      expect(state.data!.status).toBe('success');
    });
  });

  describe('upload', () => {
    it('returns the hosted urls from the first driver exposing the upload capability', async () => {
      const calls: string[] = [];
      const unconfigured: AIDriver = {
        name: 'unconfigured',
        upload: async () => {
          calls.push('unconfigured');
          return [];
        },
      };
      const provider: AIDriver = {
        name: 'provider',
        upload: async () => {
          calls.push('provider');
          return ['https://cdn.host/hosted.png'];
        },
      };
      const adapter = new AIAdapter().use(unconfigured).use(provider);
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));

      const urls = await adapter.upload([{ file }]);

      expect(calls).toEqual(['unconfigured', 'provider']);
      expect(urls).toEqual(['https://cdn.host/hosted.png']);
    });
  });

  describe('attachment hydration', () => {
    it('uploads IRPCFile attachments and hands the driver URL-only inputs', async () => {
      const uploaded: number[] = [];
      const uploader: AIDriver = {
        name: 'uploader',
        upload: async (items) => {
          uploaded.push(items.length);
          return items.map((item, index) => `https://cdn.host/${item.path ?? 'default'}-${index}`);
        },
      };
      let captured: ImageContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        draw: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.host/out.png';
        },
      };
      const adapter = new AIAdapter().use(uploader).use(provider);
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));
      const { lifecycle, state } = makeLifecycle<ImageOutput>();

      await adapter.draw({ prompt: 'Remaster', attachments: [file, 'https://ref/img.jpg'] }, lifecycle);

      expect(uploaded).toEqual([1]);
      expect(captured!.payload.attachments).toEqual(['https://cdn.host/default-0', 'https://ref/img.jpg']);
      expect(state.data!.input.attachments).toEqual(['https://cdn.host/default-0', 'https://ref/img.jpg']);
      expect(state.data!.status).toBe('success');
    });

    it('serves an attachments array containing only IRPCFiles', async () => {
      const uploader: AIDriver = {
        name: 'uploader',
        upload: async (items) => items.map(() => 'https://cdn.host/hosted'),
      };
      let captured: ImageContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        draw: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.host/out.png';
        },
      };
      const adapter = new AIAdapter().use(uploader).use(provider);
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));
      const { lifecycle } = makeLifecycle<ImageOutput>();

      await adapter.draw({ prompt: 'Remaster', attachments: [file, file] }, lifecycle);

      expect(captured!.payload.attachments).toEqual(['https://cdn.host/hosted', 'https://cdn.host/hosted']);
      expect(captured!.payload.attachments![0]).not.toBe(file);
    });

    it('hydrates upscale sources and chat turn attachments before dispatch', async () => {
      const uploader: AIDriver = {
        name: 'uploader',
        upload: async () => ['https://cdn.host/hosted'],
      };
      let upscaleUrl: unknown;
      let chatAttachment: unknown;
      const provider: AIDriver = {
        name: 'provider',
        upscale: (ctx) => {
          upscaleUrl = ctx.payload.url;
        },
        ask: (ctx) => {
          const turn = (Array.isArray(ctx.input) ? ctx.input[0] : ctx.input) as { attachments?: unknown[] };
          chatAttachment = turn.attachments?.[0];
        },
      };
      const adapter = new AIAdapter().use(uploader).use(provider);
      const file = new IRPCFile({ name: 'clip.mp4', size: 4, type: 'video/mp4' }, new Blob(['data']));

      await adapter.upscale({ type: 'video', url: file }, makeLifecycle<UpscaleOutput>().lifecycle);
      await adapter.ask(
        [{ role: 'user', type: 'text', text: 'describe', attachments: [file] }],
        undefined,
        makeLifecycle<ChatOutput>().lifecycle
      );

      expect(upscaleUrl).toBe('https://cdn.host/hosted');
      expect(chatAttachment).toBe('https://cdn.host/hosted');
    });

    it('fails the dispatch when no driver can upload the attachment files', async () => {
      const provider: AIDriver = {
        name: 'provider',
        draw: (ctx) => {
          ctx.state.data.url = 'https://cdn.host/out.png';
        },
      };
      const adapter = new AIAdapter().use(provider);
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));
      const { lifecycle, resolve, reject } = makeLifecycle<ImageOutput>();

      await adapter.draw({ prompt: 'Remaster', attachments: [file] }, lifecycle);

      expect(reject).toHaveBeenCalledTimes(1);
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('speak', () => {
    it('normalizes raw text, merges override options over the normalized input, and applies instance defaults', async () => {
      let captured: AudioContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        speak: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.example.com/voice.mp3';
        },
      };
      const adapter = new AIAdapter({ format: 'mp3' }).use(provider);
      const { lifecycle, state } = makeLifecycle<AudioOutput>();

      await adapter.speak(
        'Welcome to AirLib AI Kit.',
        { prompt: 'Welcome to AirLib AI Kit.', voice: 'Rachel' },
        lifecycle
      );

      expect(captured!.input).toEqual({ prompt: 'Welcome to AirLib AI Kit.' });
      expect(captured!.payload).toEqual({
        prompt: 'Welcome to AirLib AI Kit.',
        voice: 'Rachel',
        format: 'mp3',
      });
      expect(state.data!.url).toBe('https://cdn.example.com/voice.mp3');
    });

    it('lets override options win over properties carried by the normalized input', async () => {
      let captured: AudioContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        speak: (ctx) => {
          captured = ctx;
        },
      };
      const adapter = new AIAdapter().use(provider);

      await adapter.speak(
        { prompt: 'Hello', voice: 'Adam' },
        { prompt: 'Hello', voice: 'Rachel' },
        makeLifecycle<AudioOutput>().lifecycle
      );

      expect(captured!.payload).toEqual({ prompt: 'Hello', voice: 'Rachel' });
    });
  });

  describe('transcribe', () => {
    it('normalizes raw audio URLs into transcription options', async () => {
      let captured: TranscriptContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        transcribe: (ctx) => {
          captured = ctx;
          ctx.state.data.text = 'transcribed words';
        },
      };
      const adapter = new AIAdapter().use(provider);
      const { lifecycle, state } = makeLifecycle<TranscriptOutput>();

      await adapter.transcribe('https://example.com/recording.mp3', undefined, lifecycle);

      expect(captured!.input).toEqual({ audio: 'https://example.com/recording.mp3' });
      expect(captured!.payload).toEqual({ audio: 'https://example.com/recording.mp3' });
      expect(state.data!.text).toBe('transcribed words');
      expect(state.data!.status).toBe('success');
    });
  });

  describe('compose', () => {
    it('normalizes raw music prompts into composition options', async () => {
      let captured: AudioContext | undefined;
      const provider: AIDriver = {
        name: 'provider',
        compose: (ctx) => {
          captured = ctx;
          ctx.state.data.url = 'https://cdn.example.com/track.mp3';
        },
      };
      const adapter = new AIAdapter().use(provider);
      const { lifecycle, state } = makeLifecycle<AudioOutput>();

      await adapter.compose('Synthwave coding beat', undefined, lifecycle);

      expect(captured!.input).toEqual({ prompt: 'Synthwave coding beat' });
      expect(captured!.payload).toEqual({ prompt: 'Synthwave coding beat' });
      expect(state.data!.url).toBe('https://cdn.example.com/track.mp3');
      expect(state.data!.status).toBe('success');
    });
  });
});
