import type { IRPCData } from '@irpclib/irpc';
import type {
  AudioOptions,
  AudioOutput,
  BaseAudioOptions,
  TranscribeOptions,
  TranscriptOutput,
} from '../audio/index.js';
import type { ChatInput, ChatOptions, ChatOutput } from '../chat/index.js';
import type { ImageOptions, ImageOutput } from '../image/index.js';
import type { UpscaleInput, UpscaleOutput } from '../media/index.js';
import type { VideoOptions, VideoOutput } from '../video/index.js';
import type { RollbackFn } from './lifecycle.js';
import type { OutputMeta } from './output.js';

export interface AIEnv {
  allowedDrivers?: Set<string>;
}

/**
 * Execution context provided to chat drivers containing the reactive stream state to mutate,
 * immutable caller input, mutable pipeline payload, rollback registry, and client abort signal.
 * Drivers write response updates through `ctx.state.data` in real time.
 * @template T Return payload shape if returning an object turn.
 * @template M Custom metadata payload attached to message turns.
 */
export interface AskContext<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: ChatOutput<T, M> };
  /** The immutable original caller input. */
  readonly input: ChatInput<T, M>;
  /** Mutable options refined across pipeline drivers for the provider. */
  payload: ChatOptions;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}

/**
 * Incoming call parameters mutable by middleware and pipeline drivers.
 * @template T Return payload shape if returning an object turn.
 * @template M Custom metadata payload attached to message turns.
 */
export interface AskPayload<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> {
  input: ChatInput<T, M>;
  options?: ChatOptions;
}

/**
 * Execution context provided to image drivers containing the reactive stream state to mutate,
 * immutable caller input, mutable pipeline payload, rollback registry, and client abort signal.
 * @template M Custom metadata payload attached to the output.
 */
export interface ImageContext<M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: ImageOutput<M> };
  /** The immutable original caller options. */
  readonly input: ImageOptions;
  /** Mutable options refined across pipeline drivers for the provider. */
  payload: ImageOptions;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}

/**
 * Execution context provided to video drivers containing the reactive stream state to mutate,
 * immutable caller input, mutable pipeline payload, rollback registry, and client abort signal.
 * @template M Custom metadata payload attached to the output.
 */
export interface VideoContext<M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: VideoOutput<M> };
  /** The immutable original caller options. */
  readonly input: VideoOptions;
  /** Mutable options refined across pipeline drivers for the provider. */
  payload: VideoOptions;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}

/**
 * Execution context provided to speech and music drivers.
 * @template O Shape of the audio options accepted by this capability.
 * @template M Custom metadata payload attached to the output.
 */
export interface AudioContext<O extends BaseAudioOptions = AudioOptions, M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: AudioOutput<M> };
  /** The immutable original caller options. */
  readonly input: O;
  /** Mutable options refined across pipeline drivers for the provider. */
  payload: O;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}

/**
 * Execution context provided to speech-to-text transcription drivers.
 * @template M Custom metadata payload attached to the output.
 */
export interface TranscriptContext<M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: TranscriptOutput<M> };
  /** The immutable original caller options. */
  readonly input: TranscribeOptions;
  /** Mutable options refined across pipeline drivers for the provider. */
  payload: TranscribeOptions;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}

/**
 * Execution context provided to media enhancement drivers.
 * @template M Custom metadata payload attached to the output.
 */
export interface UpscaleContext<M extends IRPCData = OutputMeta> {
  /** Reactive streaming state; drivers mutate `state.data` to stream updates to the client. */
  state: { data: UpscaleOutput<M> };
  /** The immutable original caller input. */
  readonly input: UpscaleInput;
  /** Mutable input refined across pipeline drivers for the provider. */
  payload: UpscaleInput;
  /** LIFO teardown handlers upon error or abort. */
  rollbacks: Set<RollbackFn>;
  /** Client abort signal. */
  signal?: AbortSignal;
}
