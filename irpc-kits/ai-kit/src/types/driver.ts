import type { IRPCData } from '@irpclib/irpc';
import type { ComposeOptions, SpeakOptions } from '../audio/index.js';
import type { UploadItem } from '../media/index.js';
import type {
  AskContext,
  AudioContext,
  ImageContext,
  TranscriptContext,
  UpscaleContext,
  VideoContext,
} from './context.js';
import type { OutputMeta } from './output.js';

/**
 * Capability-based driver contract for generative AI providers.
 * Drivers implement only the methods for capabilities they support.
 */
export interface AIDriver {
  /** Unique name of the provider driver. */
  readonly name: string;
  /** Chat execution capability. Takes a single unified execution context. */
  ask?<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(ctx: AskContext<T, M>): Promise<void> | void;
  /** Image generation capability. */
  draw?(ctx: ImageContext): Promise<void> | void;
  /** Video synthesis capability. */
  film?(ctx: VideoContext): Promise<void> | void;
  /** Media upscaling capability. */
  upscale?(ctx: UpscaleContext): Promise<void> | void;
  /** Upload capability. Transfers binaries to the provider file service and returns hosted URLs. */
  upload?(items: UploadItem[]): Promise<string[]>;
  /** Speech synthesis capability. */
  speak?(ctx: AudioContext<SpeakOptions>): Promise<void> | void;
  /** Speech-to-text transcription capability. */
  transcribe?(ctx: TranscriptContext): Promise<void> | void;
  /** Music composition capability. */
  compose?(ctx: AudioContext<ComposeOptions>): Promise<void> | void;
}

/**
 * Provider driver contract for executing or refining chat requests.
 * Partially implements AIDriver for the conversational chat capability.
 */
export interface ChatDriver extends AIDriver {
  /**
   * Executes or refines a chat turn by directly consuming ctx.payload and mutating ctx.output.
   * @template T JSON-serializable return payload shape if returning an object turn.
   * @template M JSON-serializable custom metadata payload attached to message turns.
   * @param ctx Execution context with output, input, payload, rollbacks, and abort signal.
   */
  ask<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(ctx: AskContext<T, M>): Promise<void> | void;
}

/**
 * Provider driver contract for synthesizing or editing images.
 * Partially implements AIDriver for the image generation capability.
 */
export interface ImageDriver extends AIDriver {
  /**
   * Synthesizes or edits an image by consuming ctx.payload and mutating ctx.output.
   * @param ctx Execution context with output, input, payload, rollbacks, and abort signal.
   */
  draw(ctx: ImageContext): Promise<void> | void;
}

/**
 * Provider driver contract for synthesizing or extending videos.
 * Partially implements AIDriver for the video synthesis capability.
 */
export interface VideoDriver extends AIDriver {
  /**
   * Synthesizes or extends a video by consuming ctx.payload and mutating ctx.output.
   * @param ctx Execution context with output, input, payload, rollbacks, and abort signal.
   */
  film(ctx: VideoContext): Promise<void> | void;
}

/**
 * Provider driver contract for upscaling image or video assets.
 * Partially implements AIDriver for the media enhancement capability.
 */
export interface UpscaleDriver extends AIDriver {
  /**
   * Upscales the source asset by consuming ctx.payload and mutating ctx.state.data.
   * @param ctx Execution context with state, input, payload, rollbacks, and abort signal.
   */
  upscale(ctx: UpscaleContext): Promise<void> | void;
}

/**
 * Provider driver contract for speech synthesis, transcription, and music composition.
 * Partially implements AIDriver for audio capabilities.
 */
export interface AudioDriver extends AIDriver {
  /** Speech synthesis capability (Text -> Audio). */
  speak?(ctx: AudioContext<SpeakOptions>): Promise<void> | void;
  /** Speech-to-text transcription capability (Audio -> Text). */
  transcribe?(ctx: TranscriptContext): Promise<void> | void;
  /** Music composition capability (Prompt -> Music). */
  compose?(ctx: AudioContext<ComposeOptions>): Promise<void> | void;
}
