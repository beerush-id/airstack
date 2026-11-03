import { type IRPCData, IRPCFile, type IRPCPackage } from '@irpclib/irpc';
import type { AudioOutput, ComposeOptions, SpeakOptions, TranscribeOptions, TranscriptOutput } from '../audio/index.js';
import { filterModels, MODEL_CATALOG } from '../catalog.js';
import type { ChatInput, ChatOptions, ChatOutput } from '../chat/index.js';
import type { ImageOptions, ImageOutput } from '../image/index.js';
import type { UploadItem, UpscaleInput, UpscaleOutput } from '../media/index.js';
import type {
  AskContext,
  AudioContext,
  ImageContext,
  TranscriptContext,
  UpscaleContext,
  VideoContext,
} from '../types/context.js';
import type { AIDriver } from '../types/driver.js';
import { AbortError, DriverError } from '../types/errors.js';
import type { LifecycleCtx, RollbackFn } from '../types/lifecycle.js';
import type { AIModel, ModelFilter } from '../types/models.js';
import type { OutputMeta, OutputStatus } from '../types/output.js';
import { mergeOptions } from '../utils/options.js';
import { runRollbacks } from '../utils/rollbacks.js';
import type { VideoOptions, VideoOutput } from '../video/index.js';

/** Executable driver capability names dispatched across the pipeline. */
type Capability = 'ask' | 'draw' | 'film' | 'upscale' | 'speak' | 'transcribe' | 'compose';

/** Structural shape every driver execution context provides to the pipeline. */
interface PipelineContext<O extends PipelineOutput> {
  state: { data: O };
  rollbacks: Set<RollbackFn>;
  signal?: AbortSignal;
}

/** Minimal lifecycle surface the pipeline mutates on the reactive state entity. */
interface PipelineOutput {
  status: OutputStatus;
  error?: IRPCData;
}

/**
 * Server execution adapter managing capability drivers and IRPC tool modules.
 * Coordinates the detached, unidirectional execution pipeline: context initialization
 * with 3-tier option merging, sequential driver stages mutating the reactive `state.data`
 * in real time, and LIFO rollback teardown upon driver error or client abort.
 */
export class AIAdapter {
  /** Registered provider and middleware drivers. */
  public readonly drivers: Set<AIDriver> = new Set();
  /** Registered IRPC tool packages. */
  public readonly tools: IRPCPackage[] = [];
  /** Instance-level defaults applied beneath call options (Tier 1 of the cascade). */
  public readonly defaults: Record<string, unknown>;

  constructor(defaults: Record<string, unknown> = {}) {
    this.defaults = defaults;
  }

  /** Registers a provider driver into the execution chain (duplicate registrations are ignored). */
  public use(driver: AIDriver): this {
    this.drivers.add(driver);
    return this;
  }

  /** Registers an IRPC tool package exposing callable procedures and schemas. */
  public useTool(module: IRPCPackage): this {
    this.tools.push(module);
    return this;
  }

  /**
   * Serves the fixed library catalog narrowed by the optional filter. The catalog is
   * driver-agnostic: drivers translate catalog ids to their vendor models at dispatch time.
   * @param filter Optional filter criteria matching type or search keywords.
   * @returns The filtered catalog entries in catalog order.
   */
  public async models(filter?: ModelFilter): Promise<AIModel[]> {
    return filterModels(MODEL_CATALOG, filter);
  }

  /**
   * Dispatches streaming chat completion across the registered driver pipeline.
   * Accepts a raw prompt string, a single message turn, or conversation turns array.
   * @param input Raw prompt string, single message turn, or conversation turns array.
   * @param options Optional execution and sampling parameters.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async ask<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(
    input: ChatInput<T, M>,
    options: ChatOptions | undefined,
    lifecycle: LifecycleCtx<ChatOutput<T, M>>
  ): Promise<void> {
    const hydrated = await this.hydrateFiles(input, lifecycle);
    if (hydrated === undefined) return;
    const payload = mergeOptions<ChatOptions>(this.defaults as Partial<ChatOptions>, options);
    lifecycle.state.data = {
      id: crypto.randomUUID(),
      status: 'pending',
      input: hydrated,
      role: 'assistant',
      type: 'text',
      chunks: [],
      text: '',
    };
    const ctx: AskContext<T, M> = {
      state: lifecycle.state as { data: ChatOutput<T, M> },
      input: hydrated,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('ask', lifecycle, ctx);
  }

  /**
   * Dispatches image generation across the registered driver pipeline with real-time streaming updates.
   * Normalizes raw prompt string into ImageOptions.
   * @param options Input prompt string or structured generation options.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async draw(options: string | ImageOptions, lifecycle: LifecycleCtx<ImageOutput>): Promise<void> {
    const raw: ImageOptions = typeof options === 'string' ? { prompt: options } : options;
    const hydrated = await this.hydrateFiles(raw, lifecycle);
    if (hydrated === undefined) return;
    const input: ImageOptions = hydrated;
    const payload = mergeOptions<ImageOptions>(this.defaults as Partial<ImageOptions>, input);
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input };
    const ctx: ImageContext = {
      state: lifecycle.state as { data: ImageOutput },
      input,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('draw', lifecycle, ctx);
  }

  /**
   * Dispatches video synthesis across the registered driver pipeline with real-time streaming updates.
   * Normalizes raw prompt string into VideoOptions.
   * @param options Input prompt string or structured generation options.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async film(options: string | VideoOptions, lifecycle: LifecycleCtx<VideoOutput>): Promise<void> {
    const raw: VideoOptions = typeof options === 'string' ? { prompt: options } : options;
    const hydrated = await this.hydrateFiles(raw, lifecycle);
    if (hydrated === undefined) return;
    const input: VideoOptions = hydrated;
    const payload = mergeOptions<VideoOptions>(this.defaults as Partial<VideoOptions>, input);
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input };
    const ctx: VideoContext = {
      state: lifecycle.state as { data: VideoOutput },
      input,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('film', lifecycle, ctx);
  }

  /**
   * Dispatches media upscaling across the registered driver pipeline with real-time streaming updates.
   * @param input The media kind and source URL to upscale.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async upscale(input: UpscaleInput, lifecycle: LifecycleCtx<UpscaleOutput>): Promise<void> {
    const hydrated = await this.hydrateFiles(input, lifecycle);
    if (hydrated === undefined) return;
    const payload = mergeOptions<UpscaleInput>(this.defaults as Partial<UpscaleInput>, hydrated);
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input: hydrated };
    const ctx: UpscaleContext = {
      state: lifecycle.state as { data: UpscaleOutput },
      input: hydrated,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('upscale', lifecycle, ctx);
  }

  /**
   * Uploads binaries through the first registered driver exposing the upload capability.
   * @param items Upload items carrying the binary and optional target path.
   * @returns Provider-hosted temporary URLs aligned with the input order.
   */
  public async upload(items: UploadItem[]): Promise<string[]> {
    for (const driver of this.drivers) {
      if (!driver.upload) continue;
      const urls = await driver.upload(items);
      if (urls.length > 0) return urls;
    }
    return [];
  }

  /**
   * Replaces every IRPCFile in the value tree with a provider-hosted URL, uploading the
   * binaries through the first registered driver exposing the upload capability. When no
   * driver uploads, rejects the lifecycle and returns undefined.
   * @param value The input value tree to normalize (arrays, plain objects, primitives).
   * @param lifecycle The streaming lifecycle to reject when hydration fails.
   * @returns The hydrated value, or undefined when the lifecycle was rejected.
   */
  private async hydrateFiles<T>(value: T, lifecycle: LifecycleCtx<unknown>): Promise<T | undefined> {
    const files: IRPCFile[] = [];
    const collect = (node: unknown): void => {
      if (node instanceof IRPCFile) files.push(node);
      else if (Array.isArray(node)) node.forEach(collect);
      else if (node !== null && typeof node === 'object') Object.values(node).forEach(collect);
    };
    collect(value);
    if (files.length === 0) return value;
    const urls = await this.upload(files.map((file) => ({ file })));
    if (urls.length !== files.length) {
      lifecycle.reject(new DriverError('No registered driver uploaded the attachment files', 'adapter'));
      return undefined;
    }
    let cursor = 0;
    const build = (node: unknown): unknown => {
      if (node instanceof IRPCFile) return urls[cursor++];
      if (Array.isArray(node)) return node.map(build);
      if (node !== null && typeof node === 'object') {
        return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, build(child)]));
      }
      return node;
    };
    return build(value) as T;
  }

  /**
   * Dispatches speech synthesis across the registered driver pipeline with real-time streaming updates.
   * Normalizes raw prompt string into SpeakOptions and merges optional overrides.
   * @param input Speech text string or structured SpeakOptions.
   * @param options Optional parameter overrides.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async speak(
    input: string | SpeakOptions,
    options: SpeakOptions | undefined,
    lifecycle: LifecycleCtx<AudioOutput>
  ): Promise<void> {
    const normalized: SpeakOptions = typeof input === 'string' ? { prompt: input } : input;
    const payload = mergeOptions<SpeakOptions>(this.defaults as Partial<SpeakOptions>, {
      ...normalized,
      ...options,
    });
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input: normalized };
    const ctx: AudioContext<SpeakOptions> = {
      state: lifecycle.state as { data: AudioOutput },
      input: normalized,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('speak', lifecycle, ctx);
  }

  /**
   * Dispatches speech-to-text transcription across the registered driver pipeline with real-time streaming updates.
   * Normalizes audio URL string into TranscribeOptions and merges optional overrides.
   * @param input Audio URL string or structured TranscribeOptions.
   * @param options Optional parameter overrides.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async transcribe(
    input: string | TranscribeOptions,
    options: TranscribeOptions | undefined,
    lifecycle: LifecycleCtx<TranscriptOutput>
  ): Promise<void> {
    const raw: TranscribeOptions = typeof input === 'string' ? { audio: input } : input;
    const normalized = await this.hydrateFiles(raw, lifecycle);
    if (normalized === undefined) return;
    const payload = mergeOptions<TranscribeOptions>(this.defaults as Partial<TranscribeOptions>, {
      ...normalized,
      ...options,
    });
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input: normalized, text: '' };
    const ctx: TranscriptContext = {
      state: lifecycle.state as { data: TranscriptOutput },
      input: normalized,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('transcribe', lifecycle, ctx);
  }

  /**
   * Dispatches music composition across the registered driver pipeline with real-time streaming updates.
   * Normalizes music style prompt string into ComposeOptions and merges optional overrides.
   * @param input Music prompt string or structured ComposeOptions.
   * @param options Optional parameter overrides.
   * @param lifecycle Streaming lifecycle context holding the reactive state, resolve, reject, and signal.
   */
  public async compose(
    input: string | ComposeOptions,
    options: ComposeOptions | undefined,
    lifecycle: LifecycleCtx<AudioOutput>
  ): Promise<void> {
    const raw: ComposeOptions = typeof input === 'string' ? { prompt: input } : input;
    const normalized = await this.hydrateFiles(raw, lifecycle);
    if (normalized === undefined) return;
    const payload = mergeOptions<ComposeOptions>(this.defaults as Partial<ComposeOptions>, {
      ...normalized,
      ...options,
    });
    lifecycle.state.data = { id: crypto.randomUUID(), status: 'pending', input: normalized };
    const ctx: AudioContext<ComposeOptions> = {
      state: lifecycle.state as { data: AudioOutput },
      input: normalized,
      payload,
      rollbacks: new Set(),
      signal: lifecycle.signal,
    };
    await this.runPipeline('compose', lifecycle, ctx);
  }

  /**
   * Runs the detached pipeline for a capability: sequential driver stages mutating the
   * reactive `ctx.state.data`, finalizing success, or tearing down via LIFO rollbacks with
   * terminal status assignment and rejection upon driver error or client abort.
   */
  private async runPipeline<O extends PipelineOutput, C extends PipelineContext<O>>(
    capability: Capability,
    lifecycle: LifecycleCtx<O>,
    ctx: C
  ): Promise<void> {
    let settled = false;

    const fail = async (error: Error, status: OutputStatus): Promise<void> => {
      if (settled) return;
      settled = true;
      await runRollbacks(ctx.rollbacks, error);
      ctx.state.data.status = status;
      if (status === 'error') ctx.state.data.error = { name: error.name, message: error.message };
      lifecycle.reject(error);
    };

    const onAbort = (): void => {
      void fail(new AbortError(), 'aborted');
    };

    if (lifecycle.signal) {
      if (lifecycle.signal.aborted) {
        await fail(new AbortError(), 'aborted');
        return;
      }
      lifecycle.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      for (const driver of this.drivers) {
        if (settled) break;
        const handler = driver[capability] as ((stage: C) => Promise<void> | void) | undefined;
        if (handler) await handler.call(driver, ctx);
      }
      if (settled) return;
      ctx.state.data.status = 'success';
      settled = true;
      lifecycle.resolve();
    } catch (error) {
      if (!settled) await fail(error instanceof Error ? error : new Error(String(error)), 'error');
    } finally {
      lifecycle.signal?.removeEventListener('abort', onAbort);
    }
  }
}
