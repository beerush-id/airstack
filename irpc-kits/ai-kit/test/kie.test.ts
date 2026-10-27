import { envCtx, IRPCFile, withContext } from '@irpclib/irpc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AudioOutput,
  ComposeOptions,
  SpeakOptions,
  TranscribeOptions,
  TranscriptOutput,
} from '../src/audio/index.js';
import type { ChatMessage, ChatOptions, ChatOutput } from '../src/chat/index.js';
import { KIEDriver } from '../src/drivers/kie/index.js';
import type { ImageOptions, ImageOutput } from '../src/image/index.js';
import type { UpscaleInput, UpscaleOutput } from '../src/media/index.js';
import type {
  AskContext,
  AudioContext,
  ImageContext,
  TranscriptContext,
  UpscaleContext,
  VideoContext,
} from '../src/types/context.js';
import { AbortError } from '../src/types/errors.js';
import type { VideoOptions, VideoOutput } from '../src/video/index.js';

/** Builds a JSON API response. */
const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });

/** Builds an SSE response body from raw data frames. */
const sse = (frames: string[]) =>
  new Response(frames.map((frame) => `data: ${frame}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

function askContext(input: string | ChatMessage[], payload: Record<string, unknown>): AskContext {
  return {
    state: { data: { id: 'out-1', status: 'pending', input, role: 'assistant', type: 'text', text: '' } as ChatOutput },
    input,
    payload: payload as ChatOptions,
    rollbacks: new Set(),
  };
}

function imageContext(payload: Record<string, unknown>, signal?: AbortSignal): ImageContext {
  const input = payload as ImageOptions;
  return {
    state: { data: { id: 'img-1', status: 'pending', input } as ImageOutput },
    input,
    payload: input,
    rollbacks: new Set(),
    signal,
  };
}

function videoContext(payload: Record<string, unknown>): VideoContext {
  const input = payload as VideoOptions;
  return {
    state: { data: { id: 'vid-1', status: 'pending', input } as VideoOutput },
    input,
    payload: input,
    rollbacks: new Set(),
  };
}

function speakContext(payload: Record<string, unknown>): AudioContext<SpeakOptions> {
  const input = payload as SpeakOptions;
  return {
    state: { data: { id: 'aud-1', status: 'pending', input } as AudioOutput },
    input,
    payload: input,
    rollbacks: new Set(),
  };
}

function composeContext(payload: Record<string, unknown>): AudioContext<ComposeOptions> {
  const input = payload as ComposeOptions;
  return {
    state: { data: { id: 'aud-2', status: 'pending', input } as AudioOutput },
    input,
    payload: input,
    rollbacks: new Set(),
  };
}

function transcribeContext(payload: Record<string, unknown>): TranscriptContext {
  const input = payload as TranscribeOptions;
  return {
    state: { data: { id: 'tr-1', status: 'pending', input, text: '' } as TranscriptOutput },
    input,
    payload: input,
    rollbacks: new Set(),
  };
}

function upscaleContext(input: UpscaleInput, signal?: AbortSignal): UpscaleContext {
  return {
    state: { data: { id: 'up-1', status: 'pending', input } as UpscaleOutput },
    input,
    payload: input,
    rollbacks: new Set(),
    signal,
  };
}

describe('KIEDriver', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('ask', () => {
    it('streams Gemini native chunk deltas into the output text with the endpoint payload schema', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          sse([
            '{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
            '{"candidates":[{"content":{"parts":[{"text":" world"}]}}]}',
            '[DONE]',
          ])
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', defaultModels: { chat: 'gemini-3.8-flash' } });
      const ctx = askContext('Hi there', {});

      await driver.ask(ctx);

      expect(ctx.state.data.text).toBe('Hello world');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.kie.ai/gemini/v1/models/gemini-3-8-flash:streamGenerateContent');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        contents: [{ role: 'user', parts: [{ text: 'Hi there' }] }],
      });
    });

    it('routes Claude models to the Messages endpoint with system hoisting and required fields', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          sse(['{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}', '[DONE]'])
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', defaultModels: { chat: 'claude-sonnet-5' } });
      const ctx = askContext([{ role: 'user', type: 'text', text: 'Hello' }], {
        maxTokens: 256,
        temperature: 0.5,
        system: 'Be terse',
      });

      await driver.ask(ctx);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.kie.ai/claude/v1/messages');
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'claude-sonnet-5',
        max_tokens: 256,
        stream: true,
        system: 'Be terse',
        temperature: 0.5,
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(ctx.state.data.text).toBe('Hi');
    });
  });

  describe('draw', () => {
    it('routes draws with attachments to the image-edit model and maps references to image_urls', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ code: 200, data: { taskId: 'task-1' } }))
        .mockResolvedValueOnce(json({ data: { state: 'generating' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://img/x.png"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = imageContext({
        prompt: 'A serene lake',
        aspectRatio: '16:9',
        attachments: ['https://ref/img.jpg'],
        model: 'nano-banana-edit',
      });

      await driver.draw(ctx);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'google/nano-banana-edit',
        input: { prompt: 'A serene lake', image_urls: ['https://ref/img.jpg'], aspect_ratio: '16:9' },
      });
      expect(fetchMock.mock.calls[1][0]).toBe('https://api.kie.ai/api/v1/jobs/getTaskDetail?taskId=task-1');
      expect(ctx.state.data.url).toBe('https://img/x.png');
    });

    it('routes draws without attachments to the text-to-image model with the required resolution', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-14' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://img/t2i.png"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = imageContext({ prompt: 'A serene lake', quality: '2k', model: 'flux-2-pro' });

      await driver.draw(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'flux-2/pro-text-to-image',
        input: { prompt: 'A serene lake', aspect_ratio: '1:1', resolution: '2K' },
      });
      expect(ctx.state.data.url).toBe('https://img/t2i.png');
    });

    it('defers when the explicit call model is not translated by the driver', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = imageContext({ prompt: 'A serene lake', model: 'wavespeed-turbo' });

      await driver.draw(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBeUndefined();
    });

    it('defers when a text-to-image model receives attachments instead of swapping models', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = imageContext({
        prompt: 'A serene lake',
        model: 'flux-2-pro',
        attachments: ['https://ref/img.jpg'],
      });

      await driver.draw(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBeUndefined();
    });

    it('enforces the timeout window across fixed-interval polling', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-1' } }))
        .mockImplementation(() => Promise.resolve(json({ data: { state: 'generating' } })));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1, timeout: 20 });
      const ctx = imageContext({ prompt: 'A serene lake', model: 'flux-2-pro' });

      await expect(driver.draw(ctx)).rejects.toMatchObject({ name: 'DriverError', code: 'TIMEOUT' });
      expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    });

    it('stops polling and rejects with an AbortError when the client aborts', async () => {
      const controller = new AbortController();
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: { taskId: 'task-1' } }));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 50 });
      const ctx = imageContext({ prompt: 'A serene lake', model: 'flux-2-pro' }, controller.signal);

      const pending = driver.draw(ctx);
      controller.abort();

      await expect(pending).rejects.toBeInstanceOf(AbortError);
      expect(fetchMock.mock.calls).toHaveLength(1);
    });
  });

  describe('film', () => {
    it('maps duration and aspect ratio to the Kling task schema and assigns url and duration', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-9' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://vid/x.mp4"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = videoContext({ prompt: 'Waves', duration: 5, aspectRatio: '16:9', model: 'kling-3-omni' });

      await driver.film(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'kling-3.0-omni/text-to-video',
        input: { prompt: 'Waves', duration: 5, aspect_ratio: '16:9' },
      });
      expect(ctx.state.data.url).toBe('https://vid/x.mp4');
      expect(ctx.state.data.duration).toBe(5);
    });
  });

  describe('upscale', () => {
    it('routes image upscaling to the Topaz image task with the required factor', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-11' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://img/big.png"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = upscaleContext({ type: 'image', url: 'https://cdn/in.png' });

      await driver.upscale(ctx);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'topaz/image-upscale',
        input: { image_url: 'https://cdn/in.png', upscale_factor: '2' },
      });
      expect(ctx.state.data.url).toBe('https://img/big.png');
    });

    it('routes video upscaling to the Topaz video task with the source url only', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-12' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://vid/big.mp4"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = upscaleContext({ type: 'video', url: 'https://cdn/in.mp4' });

      await driver.upscale(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'topaz/video-upscale',
        input: { video_url: 'https://cdn/in.mp4' },
      });
      expect(ctx.state.data.url).toBe('https://vid/big.mp4');
    });
  });

  describe('driver gating', () => {
    it('returns without effect when no api key is resolved', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: '' });
      const ctx = upscaleContext({ type: 'image', url: 'https://cdn/in.png' });

      await driver.upscale(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBeUndefined();
    });

    it('returns without effect when explicitly disabled even with credentials', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', enabled: false });
      const ctx = imageContext({ prompt: 'A serene lake' });

      await driver.draw(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBeUndefined();
    });

    it('returns without effect when the env allowance excludes this driver', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = imageContext({ prompt: 'A serene lake' });

      await withContext([[envCtx.key, { allowedDrivers: new Set(['wavespeed']) }]], async () => {
        await driver.draw(ctx);
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBeUndefined();
    });

    it('serves when the env allowance includes this driver', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-13' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://img/x.png"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = imageContext({ prompt: 'A serene lake', model: 'flux-2-pro' });

      await withContext([[envCtx.key, { allowedDrivers: new Set(['kie']) }]], async () => {
        await driver.draw(ctx);
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(ctx.state.data.url).toBe('https://img/x.png');
    });

    it('returns without effect when the output already carries a result url', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = imageContext({ prompt: 'A serene lake' });
      ctx.state.data.url = 'https://img/already.png';

      await driver.draw(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.url).toBe('https://img/already.png');
    });

    it('returns without effect when the chat output was already answered', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = askContext('Hello', {});
      ctx.state.data.text = 'already answered';

      await driver.ask(ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(ctx.state.data.text).toBe('already answered');
    });
  });

  describe('upload', () => {
    it('posts binaries as multipart to the file service and returns the hosted urls', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ code: 200, data: { downloadUrl: 'https://tempfile.redpandaai.co/x.png' } }));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));

      const urls = await driver.upload([{ file, path: 'custom/path' }]);

      expect(urls).toEqual(['https://tempfile.redpandaai.co/x.png']);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://kieai.redpandaai.co/api/file-stream-upload');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get('uploadPath')).toBe('custom/path');
    });

    it('falls back to the default upload path when the item omits one', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ code: 200, data: { downloadUrl: 'https://tempfile.redpandaai.co/y.png' } }));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const file = new IRPCFile({ name: 'in.mp4', size: 4, type: 'video/mp4' }, new Blob(['data']));

      const urls = await driver.upload([{ file }]);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.body as FormData).get('uploadPath')).toBe('ai-kit/uploads');
      expect(urls).toEqual(['https://tempfile.redpandaai.co/y.png']);
    });

    it('rejects with a DriverError when the file service rejects the upload in-band', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ code: 402, msg: 'Insufficient Quota' }));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const file = new IRPCFile({ name: 'in.png', size: 4, type: 'image/png' }, new Blob(['data']));

      await expect(driver.upload([{ file }])).rejects.toMatchObject({
        name: 'DriverError',
        code: 'UPSTREAM_ERROR',
      });
    });
  });

  describe('speak', () => {
    it('maps the speech options to the ElevenLabs task schema and assigns the url', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-2' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://aud/x.mp3"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = speakContext({
        prompt: 'Hello there',
        voice: 'Rachel',
        stability: 0.5,
        similarityBoost: 0.8,
        speed: 1.1,
        model: 'elevenlabs-tts',
      });

      await driver.speak(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'elevenlabs/text-to-speech-multilingual-v2',
        input: { text: 'Hello there', voice: 'Rachel', stability: 0.5, similarity_boost: 0.8, speed: 1.1 },
      });
      expect(ctx.state.data.url).toBe('https://aud/x.mp3');
    });

    it('defaults the schema-required voice when none is provided', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-15' } }))
        .mockResolvedValueOnce(
          json({ data: { state: 'success', resultJson: '{"resultUrls":["https://aud/def.mp3"]}' } })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = speakContext({ prompt: 'Hello there', model: 'elevenlabs-tts' });

      await driver.speak(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'elevenlabs/text-to-speech-multilingual-v2',
        input: { text: 'Hello there', voice: 'Rachel' },
      });
      expect(ctx.state.data.url).toBe('https://aud/def.mp3');
    });
  });

  describe('transcribe', () => {
    it('maps the audio url to a Gemini media block and extracts the transcription text', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ choices: [{ message: { content: 'transcribed words' } }] }));
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k' });
      const ctx = transcribeContext({ audio: 'https://example.com/memo.mp3', model: 'gemini-3-pro' });

      await driver.transcribe(ctx);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.kie.ai/gemini-3-pro/v1/chat/completions');
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(false);
      expect(body.messages[0].content).toEqual([
        { type: 'text', text: 'Transcribe the audio verbatim.' },
        { type: 'image_url', image_url: { url: 'https://example.com/memo.mp3' } },
      ]);
      expect(ctx.state.data.text).toBe('transcribed words');
    });
  });

  describe('compose', () => {
    it('maps composition options to the Suno payload and assigns track attributes', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ data: { taskId: 'task-3' } }))
        .mockResolvedValueOnce(
          json({
            data: {
              state: 'success',
              resultJson: JSON.stringify([
                { audio_url: 'https://aud/track.mp3', title: 'Midnight Deploy', duration: 120 },
              ]),
            },
          })
        );
      vi.stubGlobal('fetch', fetchMock);
      const driver = new KIEDriver({ apiKey: 'k', pollInterval: 1 });
      const ctx = composeContext({
        prompt: 'An upbeat synthwave anthem',
        lyrics: '[Verse 1] Terminal glowing bright',
        style: 'Synthwave',
        title: 'Midnight Deploy',
        vocalGender: 'f',
        model: 'suno',
      });

      await driver.compose(ctx);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'ai-music-api/generate',
        input: {
          model: 'V6',
          custom_mode: true,
          instrumental: false,
          prompt: 'An upbeat synthwave anthem',
          lyrics: '[Verse 1] Terminal glowing bright',
          style: 'Synthwave',
          title: 'Midnight Deploy',
          vocal_gender: 'f',
        },
      });
      expect(ctx.state.data.url).toBe('https://aud/track.mp3');
      expect(ctx.state.data.title).toBe('Midnight Deploy');
      expect(ctx.state.data.duration).toBe(120);
    });
  });
});
