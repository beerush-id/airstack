import type { IRPCData } from '@irpclib/irpc';

/** Supported generation types across the model catalog. */
export type ModelType = 'chat' | 'image' | 'video' | 'audio';

/** Normalized parameter constraints and capabilities for chat/reasoning models. */
export type ChatModelParameters = {
  /** Maximum context window size in tokens. */
  contextWindow?: number;
  /** Maximum allowed completion generation tokens. */
  maxTokens?: number;
  /** Supported temperature range [min, max]. */
  temperature?: [number, number];
  /** Supported reasoning effort values (e.g. 'low' | 'medium' | 'high'). */
  reasoningEffort?: string[];
  /** Feature capabilities supported by the chat model. */
  features?: {
    /** Supports token-by-token streaming. */
    streaming?: boolean;
    /** Supports structured tool/function procedure calling. */
    tools?: boolean;
    /** Supports internal reasoning / chain-of-thought tokens. */
    reasoning?: boolean;
    /** Supports multimodal visual or media inputs. */
    multimodal?: boolean;
  };
};

/** Normalized parameter constraints and capabilities for image generation models. */
export type ImageModelParameters = {
  /** Supported aspect ratio presets (e.g. ['1:1', '16:9', '9:16', '4:3', '3:4']). */
  aspectRatios?: string[];
  /** Supported resolution presets or dimensions (e.g. ['1024x1024', '1536x1024']). */
  resolutions?: string[];
  /** Supported output image formats (e.g. ['png', 'jpeg', 'webp']). */
  formats?: string[];
  /** Supported quality tiers (e.g. ['standard', 'hd', 'ultra']). */
  qualityTiers?: string[];
  /** Maximum number of parallel images generated per request. */
  maxOutputs?: number;
  /** Feature capabilities supported by the image model. */
  features?: {
    /** Supports image-to-image variations or prompt reference. */
    imageToImage?: boolean;
    /** Supports inpainting / mask editing. */
    inpainting?: boolean;
    /** Supports negative prompts. */
    negativePrompt?: boolean;
    /** Built-in safety or NSFW filter toggle. */
    safetyChecker?: boolean;
  };
};

/** Normalized parameter constraints and capabilities for video synthesis models. */
export type VideoModelParameters = {
  /** Supported clip durations in seconds (e.g. [5, 10]). */
  durations?: number[];
  /** Supported aspect ratio presets (e.g. ['16:9', '9:16', '1:1']). */
  aspectRatios?: string[];
  /** Supported video resolutions (e.g. ['720p', '1080p', '4k']). */
  resolutions?: string[];
  /** Supported frame rates (e.g. [24, 30, 60]). */
  fps?: number[];
  /** Supported output container formats (e.g. ['mp4', 'webm']). */
  formats?: string[];
  /** Feature capabilities supported by the video model. */
  features?: {
    /** Generates synchronized audio alongside video. */
    audio?: boolean;
    /** Supports multi-shot cinematic sequencing or camera movement controls. */
    multiShot?: boolean;
    /** Supports image-to-video animation from starting frame. */
    imageToVideo?: boolean;
    /** Supports end-frame interpolation. */
    endFrame?: boolean;
  };
};

/** Normalized parameter constraints and capabilities for audio models. */
export type AudioModelParameters = {
  /** Pre-configured or supported speaker voice identifiers. */
  voices?: string[];
  /** Supported audio output formats (e.g. ['mp3', 'wav', 'opus', 'flac']). */
  formats?: string[];
  /** Supported playback speed multiplier range [min, max]. */
  speedRange?: [number, number];
  /** Supported sample rates in Hz (e.g. [24000, 44100, 48000]). */
  sampleRates?: number[];
  /** Feature capabilities supported by the audio model. */
  features?: {
    /** Supports word-level or segment timestamp alignment. */
    timestamps?: boolean;
    /** Supports multi-speaker dialogue script parsing. */
    dialogue?: boolean;
    /** Supports stems separation (e.g. vocals, instruments). */
    stems?: boolean;
    /** Supports lyric generation and style composition. */
    lyrics?: boolean;
  };
};

/** Discriminated union of normalized model parameters across modalities. */
export type ModelParameters =
  | ChatModelParameters
  | ImageModelParameters
  | VideoModelParameters
  | AudioModelParameters
  | Record<string, IRPCData>;

/**
 * Normalized model descriptor served from the fixed library catalog. Drivers translate
 * catalog ids to their vendor models and never surface their own catalogs.
 * @template P JSON-serializable parameter constraints shape for the model's generation type.
 */
export type AIModel<P = ModelParameters> = {
  /** Unique catalog model identifier (e.g. 'claude-sonnet-5', 'flux-2-pro'). */
  id: string;
  /** Human-readable display name of the model. */
  name: string;
  /** Primary generation type served by this model. */
  type: ModelType;
  /** Optional description or summary of model specialization. */
  description?: string;
  /** Normalized supported parameters and capabilities. */
  parameters: P;
  /** Optional metadata or pricing tier info. */
  meta?: Record<string, IRPCData>;
};

/** Query filter for narrowing the fixed model catalog. */
export type ModelFilter = {
  /** Filter models by one or more target types. */
  type?: ModelType | ModelType[];
  /** Keyword search matching model id, name, or description. */
  search?: string;
  [key: string]: unknown;
};
