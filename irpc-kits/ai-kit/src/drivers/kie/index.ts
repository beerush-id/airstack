import { getEnv, type IRPCData } from '@irpclib/irpc';
import type { ComposeOptions, SpeakOptions, TranscribeOptions } from '../../audio/index.js';
import { type ChatMessage, chatTurns } from '../../chat/index.js';
import type { ImageOptions } from '../../image/index.js';
import type { UploadItem } from '../../media/index.js';
import type {
  AIEnv,
  AskContext,
  AudioContext,
  ImageContext,
  TranscriptContext,
  UpscaleContext,
  VideoContext,
} from '../../types/context.js';
import type { AIDriver } from '../../types/driver.js';
import { AbortError, DriverError } from '../../types/errors.js';
import type { OutputMeta } from '../../types/output.js';
import { createChunkWriter } from '../../utils/chunks.js';
import { readSSE } from '../../utils/sse.js';
import type { VideoOptions } from '../../video/index.js';
import { CHAT_ROUTES, chatFamily } from './chat.js';
import {
  DEFAULT_BASE_URL,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_TIMEOUT,
  DEFAULT_TRANSCRIBE_PROMPT,
  TRANSCRIBE_ENDPOINT,
  UPLOAD_BASE_URL,
  UPLOAD_PATH,
} from './constant.js';
import {
  KIE_TASK_MODELS,
  KIE_TRANSCRIBE_MODELS,
  type KIEModelCapability,
  type KIEModelTranslation,
  kieTaskInput,
} from './models.js';

/** Configuration options for the KIE reference driver. */
export interface KIEOptions {
  /** API key for authenticating with KIE endpoints. */
  apiKey: string;
  /** Base URL for KIE API calls (defaults to 'https://api.kie.ai'). */
  baseUrl?: string;
  /** Deployment-configured default catalog model per capability. The driver never guesses a model: a call that resolves no model from the payload or this config cannot be served. */
  defaultModels?: {
    chat?: string;
    image?: string;
    video?: string;
    speak?: string;
    transcribe?: string;
    compose?: string;
  };
  /** Interval in milliseconds for polling asynchronous generative tasks (default: 2000ms). */
  pollInterval?: number;
  /** Timeout in milliseconds before timing out an async job (default: 300000ms / 5 min). */
  timeout?: number;
  /** Explicitly disables this driver regardless of credential presence (defaults to enabled). */
  enabled?: boolean;
  [key: string]: unknown;
}

export interface KIEContext extends AIEnv {
  KIE_ENV: KIEOptions;
}

/** KIE task detail envelope returned by getTaskDetail. */
interface KIETaskDetail {
  data?: {
    state?: string;
    errMsg?: string;
    resultJson?: string | Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Reference provider driver implementing the unified AIDriver contract for KIE.
 * Serves the fixed library catalog: a general KIE field dialect plus per-model
 * translations (see `./models.js`) map catalog ids onto vendor models and payloads.
 * Streams SSE chat tokens directly into the reactive output, and coordinates
 * asynchronous task polling with fixed intervals, timeout, and abort teardown.
 */
export class KIEDriver implements AIDriver {
  /** Canonical driver identifier. */
  readonly name = 'kie';
  protected readonly options: KIEOptions;

  public get resolvedOptions(): KIEOptions {
    return { ...this.options, ...getEnv<KIEContext>().KIE_ENV };
  }

  /**
   * Reports whether this driver may serve requests: credentials present, not disabled, allowed by
   * the environment, and the output not already carrying a result from an earlier driver.
   */
  private canHandle(served?: unknown): boolean {
    const options = this.resolvedOptions;
    if (options.enabled === false || !options.apiKey) return false;
    const allowed = getEnv<KIEContext>().allowedDrivers;
    if (allowed && !allowed.has(this.name)) return false;
    return !served;
  }

  constructor(options?: KIEOptions) {
    this.options = { ...options } as KIEOptions;
  }

  /**
   * Streams chat completions across Claude, GPT, Gemini, and DeepSeek models on KIE.
   * Streams SSE deltas into ctx.state.data.chunks and sets ctx.state.data.text once complete.
   */
  async ask<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(ctx: AskContext<T, M>): Promise<void> {
    if (!this.canHandle(ctx.state.data.text || ctx.state.data.data)) return;
    const model = ctx.payload.model ?? this.resolvedOptions.defaultModels?.chat;
    if (!model) return; // No model resolved from the call or the deployment config — cannot serve.
    const route = CHAT_ROUTES[chatFamily(model)];
    const turns: ChatMessage<T, M>[] = chatTurns(ctx.input);

    const response = await fetch(`${this.baseUrl}${route.endpoint(model)}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(route.body(model, turns, ctx.payload as Record<string, unknown>)),
    });
    if (!response.ok) {
      throw new DriverError(`KIE chat request failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
    }

    const writer = createChunkWriter(ctx.state.data);
    await readSSE(response, (event) => writer.write(route.delta(event)));
    writer.end();
  }

  /**
   * Synthesizes or edits visual assets via KIE task creation and polling.
   * Assigns ctx.state.data.url once the task completes.
   */
  async draw(ctx: ImageContext): Promise<void> {
    if (!this.canHandle(ctx.state.data.url)) return;
    const payload = ctx.payload as ImageOptions;
    const id = payload.model ?? this.resolvedOptions.defaultModels?.image;
    if (!id) return; // No model resolved from the call or the deployment config — cannot serve.
    const entry = this.task('draw', id);
    // The requested model serves the draw: edit models require references, text-to-image models cannot take them.
    if (!entry || Boolean(entry.edit) !== Boolean(payload.attachments?.length)) return;
    const result = await this.pollTask(
      await this.createTask(entry.vendor ?? id, kieTaskInput(entry, payload)),
      ctx.signal
    );
    ctx.state.data.url = result.resultUrls?.[0];
  }

  /**
   * Synthesizes or extends video assets via KIE task creation and polling.
   * Assigns ctx.state.data.url and duration once the task completes.
   */
  async film(ctx: VideoContext): Promise<void> {
    if (!this.canHandle(ctx.state.data.url)) return;
    const payload = ctx.payload as VideoOptions;
    const id = payload.model ?? this.resolvedOptions.defaultModels?.video;
    const entry = id ? this.task('film', id) : undefined;
    if (!id || !entry) return; // No resolvable model or an unimplemented model defers.
    const result = await this.pollTask(
      await this.createTask(entry.vendor ?? id, kieTaskInput(entry, payload)),
      ctx.signal
    );
    ctx.state.data.url = result.resultUrls?.[0];
    if (payload.duration !== undefined) ctx.state.data.duration = payload.duration;
  }

  /**
   * Upscales image or video assets via the Topaz task endpoints.
   * Assigns ctx.state.data.url once the task completes.
   */
  async upscale(ctx: UpscaleContext): Promise<void> {
    if (!this.canHandle(ctx.state.data.url)) return;
    // The upscale capability routes by media kind across the two catalog upscalers.
    const id = ctx.payload.type === 'image' ? 'topaz-image-upscale' : 'topaz-video-upscale';
    const entry = this.task('upscale', id);
    if (!entry) return;
    const result = await this.pollTask(
      await this.createTask(entry.vendor ?? id, kieTaskInput(entry, ctx.payload)),
      ctx.signal
    );
    ctx.state.data.url = result.resultUrls?.[0];
  }

  /**
   * Uploads binaries to the KIE file service and returns their temporary hosted URLs.
   * Files expire after 24 hours — use the URLs in generation inputs promptly.
   */
  async upload(items: UploadItem[]): Promise<string[]> {
    if (!this.canHandle()) return [];
    return Promise.all(
      items.map(async (item) => {
        const form = new FormData();
        form.set('file', item.file.data);
        form.set('uploadPath', item.path ?? UPLOAD_PATH);
        const response = await fetch(`${UPLOAD_BASE_URL}/api/file-stream-upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.resolvedOptions.apiKey}` },
          body: form,
        });
        if (!response.ok) {
          throw new DriverError(`KIE upload failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
        }
        const json = (await response.json()) as { code?: number; data?: { downloadUrl?: string } };
        if (json.code !== 200 || !json.data?.downloadUrl) {
          throw new DriverError(`KIE upload rejected: ${json.code ?? 'unknown'}`, this.name, 'UPSTREAM_ERROR');
        }
        return json.data.downloadUrl;
      })
    );
  }

  /**
   * Synthesizes spoken voice audio via KIE TTS endpoints.
   * Assigns ctx.state.data.url once the task completes.
   */
  async speak(ctx: AudioContext<SpeakOptions>): Promise<void> {
    if (!this.canHandle(ctx.state.data.url)) return;
    const payload = ctx.payload as SpeakOptions;
    const id = payload.model ?? this.resolvedOptions.defaultModels?.speak;
    const entry = id ? this.task('speak', id) : undefined;
    if (!id || !entry) return; // No resolvable model or an unimplemented model defers.
    const result = await this.pollTask(
      await this.createTask(entry.vendor ?? id, kieTaskInput(entry, payload)),
      ctx.signal
    );
    ctx.state.data.url = result.resultUrls?.[0];
  }

  /**
   * Transcribes speech audio from URL into text via KIE Gemini transcription endpoints.
   * Assigns ctx.state.data.text once the transcription completes.
   */
  async transcribe(ctx: TranscriptContext): Promise<void> {
    if (!this.canHandle(ctx.state.data.text)) return;
    const payload = ctx.payload as TranscribeOptions;
    const id = payload.model ?? this.resolvedOptions.defaultModels?.transcribe;
    const vendor = id ? KIE_TRANSCRIBE_MODELS[id] : undefined;
    if (!vendor) return; // No resolvable model or an unimplemented model defers.
    const response = await fetch(`${this.baseUrl}${TRANSCRIBE_ENDPOINT}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: vendor,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: payload.prompt ?? DEFAULT_TRANSCRIBE_PROMPT },
              { type: 'image_url', image_url: { url: payload.audio } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new DriverError(`KIE transcription failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    ctx.state.data.text = json.choices?.[0]?.message?.content ?? '';
  }

  /**
   * Composes music tracks via KIE Suno endpoints.
   * Assigns ctx.state.data.url, title, and duration once the task completes.
   */
  async compose(ctx: AudioContext<ComposeOptions>): Promise<void> {
    if (!this.canHandle(ctx.state.data.url)) return;
    const payload = ctx.payload as ComposeOptions;
    const id = payload.model ?? this.resolvedOptions.defaultModels?.compose;
    const entry = id ? this.task('compose', id) : undefined;
    if (!id || !entry) return; // No resolvable model or an unimplemented model defers.
    const result = await this.pollTask(
      await this.createTask(entry.vendor ?? id, kieTaskInput(entry, payload)),
      ctx.signal
    );
    const track = (Array.isArray(result) ? result[0] : result) as
      | { audio_url?: string; title?: string; duration?: number }
      | undefined;
    ctx.state.data.url = track?.audio_url ?? result.resultUrls?.[0];
    if (track?.title) ctx.state.data.title = track.title;
    if (track?.duration !== undefined) ctx.state.data.duration = track.duration;
  }

  /**
   * Polling helper for KIE async tasks (createTask / getTaskDetail) with fixed-interval
   * checks, timeout enforcement, and abort signal listener cleanup.
   * @param taskId The upstream task identifier returned by createTask.
   * @param signal Optional client abort signal cancelling the poll loop.
   * @returns The parsed result payload containing resultUrls when successful.
   */
  protected async pollTask(
    taskId: string,
    signal?: AbortSignal
  ): Promise<{ resultUrls?: string[]; [key: string]: unknown }> {
    const interval = this.resolvedOptions.pollInterval ?? DEFAULT_POLL_INTERVAL;
    const deadline = Date.now() + (this.resolvedOptions.timeout ?? DEFAULT_TIMEOUT);

    while (true) {
      await this.delay(interval, signal);
      if (signal?.aborted) throw new AbortError();

      const response = await fetch(`${this.baseUrl}/api/v1/jobs/getTaskDetail?taskId=${encodeURIComponent(taskId)}`, {
        headers: this.headers(),
      });
      if (!response.ok) {
        throw new DriverError(
          `KIE task polling failed: ${response.status}`,
          this.name,
          response.status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR'
        );
      }
      const json = (await response.json()) as KIETaskDetail;
      const data = json.data ?? {};
      if (data.state === 'success') {
        return typeof data.resultJson === 'string'
          ? (JSON.parse(data.resultJson) as { resultUrls?: string[] })
          : ((data.resultJson as { resultUrls?: string[] }) ?? {});
      }
      if (data.state === 'fail') {
        throw new DriverError(data.errMsg ?? 'KIE task failed', this.name, 'UPSTREAM_ERROR');
      }
      if (Date.now() >= deadline) {
        throw new DriverError('KIE task polling timed out', this.name, 'TIMEOUT');
      }
    }
  }

  /** Base URL for KIE API calls. */
  private get baseUrl(): string {
    return (this.resolvedOptions.baseUrl as string | undefined) ?? DEFAULT_BASE_URL;
  }

  /** Authorization and content headers for KIE requests. */
  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.resolvedOptions.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Resolves the task translation serving a capability; unknown ids and cross-capability ids defer. */
  private task(capability: KIEModelCapability, id: string): KIEModelTranslation | undefined {
    const entry = KIE_TASK_MODELS[id];
    return entry?.capability === capability ? entry : undefined;
  }

  /** Creates a KIE async task and resolves its upstream task identifier. */
  private async createTask(model: string, input: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, input }),
    });
    if (!response.ok) {
      throw new DriverError(`KIE task creation failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
    }
    const json = (await response.json()) as { data?: { taskId?: string }; taskId?: string };
    const taskId = json.data?.taskId ?? json.taskId;
    if (!taskId) {
      throw new DriverError('KIE task creation returned no taskId', this.name, 'UPSTREAM_ERROR');
    }
    return taskId;
  }

  /** Resolves after the delay, rejecting immediately when the abort signal fires. */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new AbortError());
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new AbortError());
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
