import type { ComposeOptions, SpeakOptions } from '../../audio/index.js';
import type { ImageOptions } from '../../image/index.js';
import type { UpscaleInput } from '../../media/index.js';
import { DEFAULT_SUNO_MODEL, DEFAULT_VOICE } from './constant.js';

/** Driver task capability served by a catalog model translation. */
export type KIEModelCapability = 'draw' | 'film' | 'speak' | 'compose' | 'upscale';

/**
 * Per-model KIE translation for a fixed catalog model: the vendor task identifier, the
 * capability it serves, and the vendor input dialect built over the general KIE mapping.
 * All fields are verified against the model's live schema (api.kie.ai).
 */
export interface KIEModelTranslation {
  /** Vendor model identifier on the KIE task API; defaults to the catalog id (table key). */
  readonly vendor?: string;
  /** Driver capability this catalog model serves; requests for other capabilities defer. */
  readonly capability: KIEModelCapability;
  /** Marks edit-dialect image models that accept reference attachments. */
  readonly edit?: boolean;
  /** Vendor input field receiving the reference URL array (array-typed schema field). */
  readonly attachments?: string;
  /** Vendor input field receiving the first reference URL (single-value schema field). */
  readonly attachment?: string;
  /** Vendor fields always sent (schema-required defaults); payload-derived fields override them. */
  readonly defaults?: Record<string, unknown>;
  /** Sends the payload duration as a string (schemas declaring string-typed durations). */
  readonly stringDuration?: boolean;
  /** Custom builder when the dialect deviates from the general mapping; composed like the general dialect. */
  readonly input?: (payload: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * General field translation shared across KIE task models: normalized kit option
 * fields map onto KIE's snake_case input schema (verified across model schemas).
 */
function kieInput(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(payload.prompt !== undefined ? { prompt: payload.prompt } : {}),
    ...(payload.aspectRatio !== undefined ? { aspect_ratio: payload.aspectRatio } : {}),
    ...(payload.negativePrompt !== undefined ? { negative_prompt: payload.negativePrompt } : {}),
    ...(payload.nsfwCheck !== undefined ? { nsfw_checker: payload.nsfwCheck } : {}),
    ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
    ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
    ...(payload.resolution !== undefined ? { resolution: payload.resolution } : {}),
  };
}

/**
 * Builds the vendor task input for a translation: schema-required defaults beneath the
 * per-model builder (or the general dialect), then the model's attachment field, then
 * the duration typing quirk.
 */
export function kieTaskInput(entry: KIEModelTranslation, payload: Record<string, unknown>): Record<string, unknown> {
  const base = { ...entry.defaults, ...(entry.input ? entry.input(payload) : kieInput(payload)) };
  const refs = (payload as { attachments?: unknown[] }).attachments;
  if (entry.attachments && refs?.length) base[entry.attachments] = refs;
  if (entry.attachment && refs?.length) base[entry.attachment] = refs[0];
  if (entry.stringDuration && base.duration !== undefined) base.duration = String(base.duration);
  return base;
}

/** Maps the kit quality tier onto 1K/2K/4K resolution enums. */
function qualityResolution(payload: Record<string, unknown>): string {
  const quality = (payload as ImageOptions).quality;
  if (quality === '4k') return '4K';
  return quality === '2k' ? '2K' : '1K';
}

/** Named size presets shared by models declaring `image_size` instead of `aspect_ratio`. */
const IMAGE_SIZES: Record<string, string> = {
  '1:1': 'square',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '3:2': 'landscape_3_2',
  '2:3': 'portrait_3_2',
  '21:9': 'landscape_21_9',
};

/** Named size preset for the payload aspect ratio, when the model's enum accepts it. */
function imageSize(payload: Record<string, unknown>): Record<string, unknown> {
  const aspectRatio = (payload as ImageOptions).aspectRatio;
  const size = aspectRatio ? IMAGE_SIZES[aspectRatio] : undefined;
  return size ? { image_size: size } : {};
}

/** Builds the FLUX-2 family input; the schema requires the resolution field (default 1K). */
function fluxInput(payload: Record<string, unknown>): Record<string, unknown> {
  return { ...kieInput(payload), resolution: qualityResolution(payload) };
}

/** Builds the Suno field set shared across the Suno task family. */
function sunoFields(payload: Record<string, unknown>): Record<string, unknown> {
  const options = payload as ComposeOptions;
  return {
    prompt: options.prompt,
    ...(options.lyrics ? { lyrics: options.lyrics } : {}),
    ...(options.style ? { style: options.style } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.vocalGender ? { vocal_gender: options.vocalGender } : {}),
    ...(options.duration !== undefined ? { duration: options.duration } : {}),
  };
}

/** Builds the ElevenLabs TTS input; the schema requires the voice persona. */
function speakInput(payload: Record<string, unknown>): Record<string, unknown> {
  const options = payload as SpeakOptions;
  return {
    text: options.prompt,
    voice: options.voice ?? DEFAULT_VOICE,
    ...(options.stability !== undefined ? { stability: options.stability } : {}),
    ...(options.similarityBoost !== undefined ? { similarity_boost: options.similarityBoost } : {}),
    ...(options.speed !== undefined ? { speed: options.speed } : {}),
    ...(options.previousText ? { previous_text: options.previousText } : {}),
    ...(options.timestamps !== undefined ? { timestamps: options.timestamps } : {}),
  };
}

/** Builds the Gemini Pro TTS input; the schema requires speaker labels and dialogue turns. */
function geminiDialogueInput(payload: Record<string, unknown>): Record<string, unknown> {
  const options = payload as SpeakOptions;
  const turns = (options.dialogue ?? [{ speaker: 'Speaker 1', text: options.prompt }]).map((turn) => ({
    speaker_id: turn.speaker ?? 'Speaker 1',
    text: turn.text,
  }));
  return {
    speakers: [...new Set(turns.map((turn) => turn.speaker_id))].map((speaker_id) => ({ speaker_id })),
    dialogue_turns: turns,
  };
}

/** Builds the Suno composition input; custom mode engages when any structured field is present. */
function composeInput(payload: Record<string, unknown>): Record<string, unknown> {
  const options = payload as ComposeOptions;
  return {
    model: DEFAULT_SUNO_MODEL,
    custom_mode: Boolean(options.lyrics ?? options.title ?? options.style),
    instrumental: Boolean(options.instrumental),
    ...sunoFields(payload),
  };
}

/** Builds the Suno continuation input; the source track id arrives as the first attachment. */
function sunoExtendInput(payload: Record<string, unknown>): Record<string, unknown> {
  const refs = (payload as { attachments?: string[] }).attachments;
  return {
    model: DEFAULT_SUNO_MODEL,
    ...(refs?.length ? { audio_id: refs[0] } : {}),
    ...sunoFields(payload),
  };
}

/** Builds the Suno cover input; the source audio URL arrives as the first attachment. */
function sunoCoverInput(payload: Record<string, unknown>): Record<string, unknown> {
  const options = payload as ComposeOptions;
  const refs = (payload as { attachments?: string[] }).attachments;
  return {
    model: DEFAULT_SUNO_MODEL,
    instrumental: Boolean(options.instrumental),
    ...(refs?.length ? { upload_url: refs[0] } : {}),
    ...sunoFields(payload),
  };
}

/**
 * Per-model translations from the fixed catalog ids to the KIE vendor task models.
 * Each entry layers its model-specific fields over the general `kieInput` dialect.
 */
export const KIE_TASK_MODELS: Record<string, KIEModelTranslation> = {
  // --- Image ---
  'flux-2-pro': {
    vendor: 'flux-2/pro-text-to-image',
    capability: 'draw',
    defaults: { aspect_ratio: '1:1' },
    input: fluxInput,
  },
  'flux-2-flex': {
    vendor: 'flux-2/flex-text-to-image',
    capability: 'draw',
    defaults: { aspect_ratio: '1:1' },
    input: fluxInput,
  },
  'flux-2-pro-edit': {
    vendor: 'flux-2/pro-image-to-image',
    capability: 'draw',
    edit: true,
    attachments: 'input_urls',
    defaults: { aspect_ratio: '1:1' },
    input: fluxInput,
  },
  'nano-banana-edit': { vendor: 'google/nano-banana-edit', capability: 'draw', edit: true, attachments: 'image_urls' },
  'nano-banana-pro': {
    capability: 'draw',
    edit: true,
    attachments: 'image_input',
    input: (payload) => ({ ...kieInput(payload), resolution: qualityResolution(payload) }),
  },
  imagen4: { vendor: 'google/imagen4', capability: 'draw' },
  'imagen4-ultra': { vendor: 'google/imagen4-ultra', capability: 'draw' },
  'seedream-v4': {
    vendor: 'bytedance/seedream-v4-text-to-image',
    capability: 'draw',
    input: (payload) => ({ ...kieInput(payload), ...imageSize(payload), image_resolution: qualityResolution(payload) }),
  },
  'seedream-4-5-edit': {
    vendor: 'seedream/4.5-edit',
    capability: 'draw',
    edit: true,
    attachments: 'image_urls',
    defaults: { aspect_ratio: '1:1' },
    input: (payload) => ({
      ...kieInput(payload),
      quality:
        (payload as ImageOptions).quality === undefined || (payload as ImageOptions).quality === 'standard'
          ? 'basic'
          : 'high',
    }),
  },
  'qwen-text-to-image': {
    vendor: 'qwen/text-to-image',
    capability: 'draw',
    input: (payload) => ({ ...kieInput(payload), ...imageSize(payload) }),
  },
  'topaz-image-upscale': {
    vendor: 'topaz/image-upscale',
    capability: 'upscale',
    input: (payload) => ({ image_url: (payload as UpscaleInput).url, upscale_factor: '2' }),
  },
  // --- Video ---
  'kling-3-omni': { vendor: 'kling-3.0-omni/text-to-video', capability: 'film', input: kieInput },
  'kling-v2-5-turbo-text-to-video-pro': {
    vendor: 'kling/v2-5-turbo-text-to-video-pro',
    capability: 'film',
    stringDuration: true,
    defaults: { duration: '5' },
  },
  'kling-v2-5-turbo-image-to-video-pro': {
    vendor: 'kling/v2-5-turbo-image-to-video-pro',
    capability: 'film',
    attachment: 'image_url',
    stringDuration: true,
    defaults: { duration: '5' },
  },
  'veo-3-1': {
    capability: 'film',
    attachments: 'image_urls',
    defaults: { aspect_ratio: '16:9', resolution: '720p', duration: 8 },
  },
  'wan-2-5-text-to-video': {
    vendor: 'wan/2-5-text-to-video',
    capability: 'film',
    stringDuration: true,
    defaults: { duration: '5' },
  },
  'wan-2-5-image-to-video': {
    vendor: 'wan/2-5-image-to-video',
    capability: 'film',
    attachment: 'image_url',
    stringDuration: true,
    defaults: { duration: '5' },
  },
  'hailuo-02-text-to-video-pro': { vendor: 'hailuo/02-text-to-video-pro', capability: 'film' },
  'hailuo-02-image-to-video-pro': {
    vendor: 'hailuo/02-image-to-video-pro',
    capability: 'film',
    attachment: 'image_url',
  },
  'seedance-1-5-pro': {
    vendor: 'bytedance/seedance-1.5-pro',
    capability: 'film',
    attachments: 'input_urls',
    defaults: { aspect_ratio: '1:1', resolution: '720p', duration: 5 },
  },
  'wan-2-6-video-to-video': {
    vendor: 'wan/2-6-video-to-video',
    capability: 'film',
    attachments: 'video_urls',
    stringDuration: true,
    defaults: { duration: '5', resolution: '1080p' },
  },
  'topaz-video-upscale': {
    vendor: 'topaz/video-upscale',
    capability: 'upscale',
    input: (payload) => ({ video_url: (payload as UpscaleInput).url }),
  },
  // --- Audio ---
  'elevenlabs-tts': { vendor: 'elevenlabs/text-to-speech-multilingual-v2', capability: 'speak', input: speakInput },
  'elevenlabs-turbo-tts': { vendor: 'elevenlabs/text-to-speech-turbo-2-5', capability: 'speak', input: speakInput },
  'gemini-2-5-pro-tts': { vendor: 'google/gemini-2-5-pro-tts', capability: 'speak', input: geminiDialogueInput },
  suno: { vendor: 'ai-music-api/generate', capability: 'compose', attachments: 'audio_urls', input: composeInput },
  'suno-extend': { vendor: 'ai-music-api/extend', capability: 'compose', input: sunoExtendInput },
  'suno-cover': { vendor: 'ai-music-api/upload-and-cover-audio', capability: 'compose', input: sunoCoverInput },
};

/**
 * KIE translation for catalog transcription models: catalog id to vendor chat model.
 * Kept separate from the task table because the endpoint is synchronous rather than task-based.
 */
export const KIE_TRANSCRIBE_MODELS: Record<string, string> = {
  'gemini-3-pro': 'google/gemini-3-pro',
};
