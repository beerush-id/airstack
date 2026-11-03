import { HTTPTransport } from '@irpclib/http';
import type { IRPCData, IRPCPackage, IRPCReader, RemoteState } from '@irpclib/irpc';
import { createPackage } from '@irpclib/irpc';
import type { AudioOutput, ComposeOptions, SpeakOptions, TranscribeOptions, TranscriptOutput } from './audio/index.js';
import type { ChatInput, ChatMessage, ChatOptions, ChatOutput, ObjectMessage } from './chat/index.js';
import type { ImageOptions, ImageOutput } from './image/index.js';
import type { UploadItem, UpscaleInput, UpscaleOutput } from './media/index.js';
import type { AIModel, ModelFilter } from './types/models.js';
import type { OutputMeta } from './types/output.js';
import type { VideoOptions, VideoOutput } from './video/index.js';

/**
 * Configuration options for creating an AI instance.
 */
export interface AIOptions {
  /** Package name identifying the AI contract on the wire. */
  name?: string;
  endpoint?: string;
}

/** Reserved call-level options bag for programmatic tool procedure invocations. */
export type AICallOptions = Record<string, unknown>;

/**
 * Declared wire procedure stubs bound to an AI instance (consumed by the backend worker).
 * @template T JSON-serializable default return payload shape for object turns.
 * @template M JSON-serializable custom metadata payload attached to message turns.
 */
export interface AIProcedures<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> {
  models: (filter?: ModelFilter) => IRPCReader<AIModel[]>;
  ask: (payload: { input: ChatInput<T, M>; options?: ChatOptions }) => IRPCReader<ChatOutput<T, M>>;
  draw: (payload: { options: ImageOptions }) => IRPCReader<ImageOutput<M>>;
  film: (payload: { options: VideoOptions }) => IRPCReader<VideoOutput<M>>;
  upscale: (payload: { input: UpscaleInput }) => IRPCReader<UpscaleOutput<M>>;
  upload: (payload: { items: UploadItem[] }) => Promise<string[]>;
  speak: (payload: { input: string | SpeakOptions; options?: SpeakOptions }) => IRPCReader<AudioOutput<M>>;
  transcribe: (payload: {
    input: string | TranscribeOptions;
    options?: TranscribeOptions;
  }) => IRPCReader<TranscriptOutput<M>>;
  compose: (payload: { input: string | ComposeOptions; options?: ComposeOptions }) => IRPCReader<AudioOutput<M>>;
}

/**
 * Client AI instance container exposing procedures, module, and transport across modalities.
 * @template T JSON-serializable default return payload shape for object turns.
 * @template M JSON-serializable custom metadata payload attached to message turns.
 */
export interface AIInstance<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> {
  /** Underlying IRPC module managing procedure declarations and schemas. */
  readonly module: IRPCPackage;
  /** Network transport used for remote function calls. */
  readonly transport: HTTPTransport;
  /** Declared wire procedure stubs bound to this instance (consumed by the backend worker). */
  readonly procedures: AIProcedures<T, M>;

  // Models Discovery
  /**
   * Lists the fixed library model catalog, narrowed by optional filters. The catalog is
   * driver-agnostic: registered drivers translate catalog ids to their vendor formats at
   * dispatch time and never surface their own catalogs.
   * @param filter Optional criteria matching type or search keywords.
   * @returns An IRPCReader streaming or resolving the normalized model descriptors.
   */
  readonly models: (filter?: ModelFilter) => IRPCReader<AIModel[]>;

  // Chat
  /** Asks a question using a single prompt string, a single message turn, or an array of conversation turns. */
  readonly ask: (
    input: string | ChatMessage<T, M> | ChatMessage<T, M>[],
    options?: ChatOptions
  ) => IRPCReader<ChatOutput<T, M>>;
  /** Programmatically invokes a registered IRPC tool procedure by name. */
  readonly call: <R extends IRPCData = IRPCData>(name: string, args?: unknown[]) => IRPCReader<ObjectMessage<R, M>>;

  // Image
  /** Draws an image output from prompt parameters. */
  readonly draw: (options: string | ImageOptions) => IRPCReader<ImageOutput<M>>;

  // Video
  /** Synthesizes a video output from prompt parameters. */
  readonly film: (options: string | VideoOptions) => IRPCReader<VideoOutput<M>>;

  // Media
  /** Upscales an image or video asset through provider enhancement models. */
  readonly upscale: (input: UpscaleInput) => IRPCReader<UpscaleOutput<M>>;
  /** Uploads binaries to the provider file service and returns their temporary hosted URLs. */
  readonly upload: (items: UploadItem[]) => IRPCReader<string[]>;

  // Audio
  /** Synthesizes spoken voice audio or dialogue from text. */
  readonly speak: (input: string | SpeakOptions, options?: SpeakOptions) => IRPCReader<AudioOutput<M>>;
  /** Transcribes speech audio from an accessible URL or media reference into text. */
  readonly transcribe: (
    input: string | TranscribeOptions,
    options?: TranscribeOptions
  ) => IRPCReader<TranscriptOutput<M>>;
  /** Composes original music tracks from style prompts and optional lyrics. */
  readonly compose: (input: string | ComposeOptions, options?: ComposeOptions) => IRPCReader<AudioOutput<M>>;
}

/**
 * Factory creating an isolated client AI instance with bound IRPC module and stubs.
 * Declares the canonical wire contracts (models, chat.ask, image.draw, video.film,
 * media.upscale, audio.speak, audio.transcribe, audio.compose).
 * @template T JSON-serializable default return payload shape for object turns.
 * @template M JSON-serializable custom metadata payload attached to message turns.
 * @param options Optional configuration parameters for the AI instance.
 * @returns An AI instance exposing execution procedures and transport handles.
 */
export function createAI<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(
  options: AIOptions = {}
): AIInstance<T, M> {
  const module = createPackage({ name: options.name ?? 'ai', version: '1.0.0' });
  const transport = new HTTPTransport({ endpoint: options.endpoint ?? '/irpc-ai-kit' });
  module.use(transport);

  const modelsProcedure = module.declare<(filter?: ModelFilter) => Promise<AIModel[]>>('models', {
    seed: () => [],
  });
  const askProcedure = module.declare<
    (payload: { input: ChatInput<T, M>; options?: ChatOptions }) => RemoteState<ChatOutput<T, M>>
  >('chat.ask', {
    stream: true,
    seed: () => ({ id: '', status: 'idle', input: '', role: 'assistant', type: 'text', chunks: [], text: '' }),
  });
  const imageProcedure = module.declare<(payload: { options: ImageOptions }) => RemoteState<ImageOutput<M>>>(
    'image.draw',
    {
      stream: true,
      seed: () => ({ id: '', status: 'idle', input: { prompt: '' } }),
    }
  );
  const videoProcedure = module.declare<(payload: { options: VideoOptions }) => RemoteState<VideoOutput<M>>>(
    'video.film',
    {
      stream: true,
      seed: () => ({ id: '', status: 'idle', input: { prompt: '' } }),
    }
  );
  const upscaleProcedure = module.declare<(payload: { input: UpscaleInput }) => RemoteState<UpscaleOutput<M>>>(
    'media.upscale',
    {
      stream: true,
      seed: () => ({ id: '', status: 'idle', input: { type: 'image', url: '' } }),
    }
  );
  const uploadProcedure = module.declare<(payload: { items: UploadItem[] }) => Promise<string[]>>('media.upload', {
    seed: () => [],
  });
  const speakProcedure = module.declare<
    (payload: { input: string | SpeakOptions; options?: SpeakOptions }) => RemoteState<AudioOutput<M>>
  >('audio.speak', {
    stream: true,
    seed: () => ({ id: '', status: 'idle', input: { prompt: '' } }),
  });
  const transcribeProcedure = module.declare<
    (payload: { input: string | TranscribeOptions; options?: TranscribeOptions }) => RemoteState<TranscriptOutput<M>>
  >('audio.transcribe', {
    stream: true,
    seed: () => ({ id: '', status: 'idle', input: { audio: '' }, text: '' }),
  });
  const composeProcedure = module.declare<
    (payload: { input: string | ComposeOptions; options?: ComposeOptions }) => RemoteState<AudioOutput<M>>
  >('audio.compose', {
    stream: true,
    seed: () => ({ id: '', status: 'idle', input: { prompt: '' } }),
  });

  const procedures: AIProcedures<T, M> = {
    models: modelsProcedure,
    ask: askProcedure,
    draw: imageProcedure,
    film: videoProcedure,
    upscale: upscaleProcedure,
    upload: uploadProcedure,
    speak: speakProcedure,
    transcribe: transcribeProcedure,
    compose: composeProcedure,
  };

  return {
    module,
    transport,
    procedures,

    models: (filter) => modelsProcedure(filter),

    ask: (input, callOptions) => askProcedure({ input, options: callOptions }),
    call: <R extends IRPCData>(name: string, args?: unknown[]) => {
      const procedure = module.get(name) as unknown as (...args: unknown[]) => IRPCReader<R>;
      return procedure(...(args ?? [])) as unknown as IRPCReader<ObjectMessage<R, M>>;
    },

    draw: (opts) => imageProcedure({ options: typeof opts === 'string' ? { prompt: opts } : opts }),

    upscale: (input) => upscaleProcedure({ input }),

    upload: (items) => uploadProcedure({ items }),

    film: (opts) => videoProcedure({ options: typeof opts === 'string' ? { prompt: opts } : opts }),

    speak: (input, callOptions) => speakProcedure({ input, options: callOptions }),
    transcribe: (input, callOptions) => transcribeProcedure({ input, options: callOptions }),
    compose: (input, callOptions) => composeProcedure({ input, options: callOptions }),
  };
}
