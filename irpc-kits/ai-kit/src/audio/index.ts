import type { IRPCData, IRPCFile } from '@irpclib/irpc';
import type { Output, OutputMeta } from '../types/output.js';

/** Supported output audio encoding formats. */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'mid' | string;

/**
 * Speaker-to-voice configuration mapping an abstract speaker label to a concrete voice persona.
 */
export type AudioSpeakerVoice = {
  /** Speaker identifier (e.g. "Speaker 1", "Host", "Guest"). */
  speaker: string;
  /** Provider voice persona name or identifier (e.g. "Rachel", "Zephyr", "EkK5I93UQWFDigLMpZcX"). */
  voice: string;
};

/** A single conversational turn within a multi-speaker audio script. */
export type AudioDialogueTurn = {
  /** Identifier of the speaker authoring this turn. */
  speaker?: string;
  /** Optional turn-specific voice override. */
  voice?: string;
  /** Text content spoken by the speaker for this turn. */
  text: string;
};

/** Word-level timestamp data aligned to synthesized or transcribed speech. */
export type AudioTimestamp = {
  /** The spoken or transcribed word. */
  word: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
};

/** Base options shared across generative audio operations. */
export type BaseAudioOptions = {
  /** Target provider model identifier. */
  model?: string;
  /** Output audio container and encoding format. */
  format?: AudioFormat;
  /** Deterministic randomization seed. */
  seed?: number;
};

/** Configuration options for speech synthesis and dialogue. */
export interface SpeakOptions extends BaseAudioOptions {
  /** Text to synthesize into speech. */
  prompt: string;
  /** Target voice persona or voice identifier for single-speaker TTS. */
  voice?: string;
  /** Speaker-to-voice assignment list for multi-speaker synthesis. */
  voices?: AudioSpeakerVoice[];
  /** Structured dialogue turns for scripted conversations. */
  dialogue?: AudioDialogueTurn[];
  /** Speech playback speed multiplier (0.5 to 2.0). */
  speed?: number;
  /** Voice stability tolerance (0.0 to 1.0). */
  stability?: number;
  /** Voice similarity boost factor (0.0 to 1.0). */
  similarityBoost?: number;
  /** Requests word-level timestamps in the output if supported by the provider. */
  timestamps?: boolean;
  /** Preceding text context to ensure natural prosodic continuity across continuous turns. */
  previousText?: string;
  [key: string]: IRPCData;
}

/** Configuration options for audio transcription (STT). */
export interface TranscribeOptions {
  /** Publicly accessible URL of the audio file to transcribe, or an IRPCFile uploaded automatically. */
  audio: string | IRPCFile;
  /** Target provider model identifier. */
  model?: string;
  /** Expected language ISO code (e.g. 'en', 'es', 'ja') or auto-detect. */
  language?: string;
  /** Requests word-level timestamps in the transcription. */
  timestamps?: boolean;
  /** Optional prompt or vocabulary context guiding transcription accuracy. */
  prompt?: string;
  [key: string]: IRPCData;
}

/** Configuration options for music and soundtrack composition. */
export interface ComposeOptions extends BaseAudioOptions {
  /** Musical description, theme, or core idea. */
  prompt: string;
  /** Title for the generated music track. */
  title?: string;
  /** Musical genre or style descriptors (e.g. 'classical, ambient piano'). */
  style?: string;
  /** Lyrics text for vocal tracks. */
  lyrics?: string;
  /** Toggles instrumental-only mode (excluding vocals). */
  instrumental?: boolean;
  /** Preferred vocal gender for sung lyrics ('m' | 'f'). */
  vocalGender?: 'm' | 'f';
  /** Target audio duration in seconds. */
  duration?: number;
  /** Reference audio file URLs for covers, extensions, or stem separation, or IRPCFiles uploaded automatically. */
  attachments?: (string | IRPCFile)[];
  [key: string]: IRPCData;
}

/** Union of audio generation options accepted by audio operations. */
export type AudioOptions = SpeakOptions | ComposeOptions;

/**
 * Normalized generative audio output returned by speech and composition operations.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface AudioOutput<M extends IRPCData = OutputMeta> extends Output<AudioOptions, M> {
  /** Track or audio title if generated. */
  title?: string;
  /** Audio length in seconds if known. */
  duration?: number;
  /** Sampling rate in Hz (e.g. 44100, 48000). */
  sampleRate?: number;
  /** Channel count (1 for mono, 2 for stereo). */
  channels?: number;
  /** Voice persona or identifier used for speech synthesis. */
  voice?: string;
  /** Word-level timestamps if requested and supported. */
  timestamps?: AudioTimestamp[];
  /** Secondary media URL (e.g. instrumental stem when separating vocals, or cover artwork for music). */
  secondaryUrl?: string;
}

/**
 * Normalized transcription output returned by speech-to-text operations.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface TranscriptOutput<M extends IRPCData = OutputMeta> extends Output<TranscribeOptions, M> {
  /** Full transcribed speech text. */
  text: string;
  /** Detected or confirmed language code. */
  language?: string;
  /** Audio length in seconds if known. */
  duration?: number;
  /** Word-level timestamp alignments. */
  timestamps?: AudioTimestamp[];
}
