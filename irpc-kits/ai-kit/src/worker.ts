import type { HTTPTransport } from '@irpclib/http';
import { HTTPRouter } from '@irpclib/http/router';
import {
  type AnyType,
  envCtx,
  getAbortSignal,
  type IRPCData,
  type IRPCPackage,
  stream,
  UnhandledCall,
} from '@irpclib/irpc';
import { AIAdapter } from './adapter/index.js';
import type { AudioOutput, ComposeOptions, SpeakOptions, TranscribeOptions, TranscriptOutput } from './audio/index.js';
import type { ChatInput, ChatOptions, ChatOutput } from './chat/index.js';
import type { AIInstance } from './client.js';
import type { ImageOptions, ImageOutput } from './image/index.js';
import type { UploadItem, UpscaleInput, UpscaleOutput } from './media/index.js';
import type { AIDriver } from './types/driver.js';
import type { LifecycleCtx } from './types/index.js';
import type { ModelFilter } from './types/models.js';
import type { VideoOptions, VideoOutput } from './video/index.js';

/**
 * Configuration options for creating an AI backend worker.
 */
export interface WorkerOptions {
  /** Instance-level defaults applied beneath call options across all dispatchers. */
  defaults?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Backend worker container exposing fetch handler, router, adapter, and fluent driver shortcuts.
 */
export interface AIWorker {
  /** Standard Fetch API handler compatible with Cloudflare Workers, Node, Bun, and Deno. */
  readonly fetch: (request: Request, ...args: unknown[]) => Promise<Response>;
  /** Underlying HTTP router resolving remote procedure execution. */
  readonly router: HTTPRouter;
  /** Underlying execution adapter coordinating provider drivers and tool packages. */
  readonly adapter: AIAdapter;
  /** Registers a provider driver into the execution chain (shortcut for adapter.use). */
  use(driver: AIDriver): this;
  /** Registers an IRPC tool package for model invocation (shortcut for adapter.useTool). */
  useTool(module: IRPCPackage): this;
}

/**
 * Factory creating an isolated backend AI worker bound to an AI client instance.
 * Registers streaming handlers for every declared procedure, coordinating execution
 * through the AIAdapter with client abort signals propagated from the request context.
 * @param instance The AI client instance whose contract and transport this worker fulfills.
 * @param options Optional worker and router configuration.
 * @returns A worker instance with fetch handler, router, adapter, and fluent shortcuts.
 */
export function createWorker(instance: AIInstance, options: WorkerOptions = {}): AIWorker {
  const router = new HTTPRouter(instance.transport as HTTPTransport);
  const adapter = new AIAdapter(options.defaults);

  /** Resolves the declared procedure stub bound on the instance. */
  const procedure = (name: keyof AIInstance['procedures']): unknown => instance.procedures[name];

  /** Wraps the streaming state, resolve, reject, and abort signal into the adapter lifecycle context. */
  const lifecycle = <T>(
    state: unknown,
    signal: AbortSignal | undefined,
    resolve: () => void,
    reject: (error: unknown) => void
  ): LifecycleCtx<T> => ({
    state: state as { data?: T },
    signal,
    resolve,
    reject,
  });

  const construct = (name: keyof AIInstance['procedures'], handler: unknown): void => {
    (instance.module as unknown as { construct: (procedure: unknown, handler: unknown) => void }).construct(
      procedure(name),
      handler
    );
  };

  construct('models', (filter?: ModelFilter) => adapter.models(filter));

  construct('ask', (payload: { input: ChatInput<IRPCData, IRPCData>; options?: ChatOptions }) =>
    stream<ChatOutput<IRPCData, IRPCData>>((state, resolve, reject) => {
      void adapter.ask(
        payload.input,
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('draw', (payload: { options: ImageOptions }) =>
    stream<ImageOutput>((state, resolve, reject) => {
      void adapter.draw(
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('film', (payload: { options: VideoOptions }) =>
    stream<VideoOutput>((state, resolve, reject) => {
      void adapter.film(
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('speak', (payload: { input: string | SpeakOptions; options?: SpeakOptions }) =>
    stream<AudioOutput>((state, resolve, reject) => {
      void adapter.speak(
        payload.input,
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('transcribe', (payload: { input: string | TranscribeOptions; options?: TranscribeOptions }) =>
    stream<TranscriptOutput>((state, resolve, reject) => {
      void adapter.transcribe(
        payload.input,
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('compose', (payload: { input: string | ComposeOptions; options?: ComposeOptions }) =>
    stream<AudioOutput>((state, resolve, reject) => {
      void adapter.compose(
        payload.input,
        payload.options,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('upscale', (payload: { input: UpscaleInput }) =>
    stream<UpscaleOutput>((state, resolve, reject) => {
      void adapter.upscale(
        payload.input,
        lifecycle(state, getAbortSignal(), resolve, reject as (error: unknown) => void)
      );
    })
  );

  construct('upload', (payload: { items: UploadItem[] }) => adapter.upload(payload.items));

  const worker: AIWorker = {
    async fetch(request: Request, env: AnyType) {
      const url = new URL(request.url);

      if (url.pathname !== instance.transport.endpoint) {
        return new UnhandledCall();
      }

      return router.resolve(request, [[envCtx.key, env]]);
    },
    router,
    adapter,
    use(driver) {
      adapter.use(driver);
      return worker;
    },
    useTool(toolModule) {
      adapter.useTool(toolModule);
      return worker;
    },
  };

  return worker;
}

// --- Backend-only barrel exports ---
export { AIAdapter } from './adapter/index.js';
export { filterModels, MODEL_CATALOG } from './catalog.js';
export * from './drivers/index.js';
export * from './types.js';
