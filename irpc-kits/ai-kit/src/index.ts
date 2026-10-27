// --- Client AI Factory & Instance Types ---

export type {
  AudioDialogueTurn,
  AudioFormat,
  AudioOptions,
  AudioOutput,
  AudioSpeakerVoice,
  AudioTimestamp,
  BaseAudioOptions,
  ComposeOptions,
  SpeakOptions,
  TranscribeOptions,
  TranscriptOutput,
} from './audio/index.js';
export type {
  BaseChatMessage,
  ChatInput,
  ChatMessage,
  ChatOptions,
  ChatOutput,
  ChatRole,
  ChatTool,
  ObjectMessage,
  TextMessage,
  ToolCall,
} from './chat/index.js';
export { chatTurns } from './chat/index.js';
export type { AICallOptions, AIInstance, AIOptions } from './client.js';
export { createAI } from './client.js';
export type {
  ImageAspectRatio,
  ImageFormat,
  ImageOptions,
  ImageOutput,
  ImageQuality,
} from './image/index.js';
export type { UploadItem, UpscaleInput, UpscaleOutput, UpscaleType } from './media/index.js';
// --- Core Primitives & Status ---
export { AbortError } from './types/errors.js';
// --- Model Discovery ---
export type {
  AIModel,
  AudioModelParameters,
  ChatModelParameters,
  ImageModelParameters,
  ModelFilter,
  ModelParameters,
  ModelType,
  VideoModelParameters,
} from './types/models.js';
export type { IRPCStatus, Output, OutputStatus } from './types/output.js';
export type {
  VideoAspectRatio,
  VideoFormat,
  VideoOptions,
  VideoOutput,
  VideoResolution,
} from './video/index.js';
