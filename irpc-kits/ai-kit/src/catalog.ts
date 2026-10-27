import type { AIModel, ModelFilter } from './types/models.js';

/**
 * The fixed model catalog exposed to end users. Driver-agnostic by design: drivers
 * translate these catalog ids to their vendor models (general field translation plus
 * per-model payloads) and defer when they do not implement a catalog model. Every
 * media entry below has been verified against its vendor schema; the catalog never
 * lists unverified entries.
 */
export const MODEL_CATALOG: AIModel[] = [
  // --- Chat (served through the endpoint-family translation) ---
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    type: 'chat',
    description: 'Streaming chat and reasoning with tool calls.',
    parameters: { features: { streaming: true, tools: true, reasoning: true, multimodal: true } },
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    type: 'chat',
    description: 'Frontier chat and reasoning with tool calls.',
    parameters: { features: { streaming: true, tools: true, reasoning: true, multimodal: true } },
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    type: 'chat',
    description: 'Fast streaming chat with tool calls.',
    parameters: { features: { streaming: true, tools: true } },
  },
  {
    id: 'gpt-5-2',
    name: 'GPT-5.2',
    type: 'chat',
    description: 'Streaming chat and reasoning with tool calls.',
    parameters: { features: { streaming: true, tools: true, reasoning: true } },
  },
  {
    id: 'gpt-5-5',
    name: 'GPT-5.5',
    type: 'chat',
    description: 'Streaming chat and reasoning with tool calls.',
    parameters: { features: { streaming: true, tools: true, reasoning: true } },
  },
  {
    id: 'gemini-3-8-flash',
    name: 'Gemini 3.8 Flash',
    type: 'chat',
    description: 'Fast multimodal streaming chat.',
    parameters: { features: { streaming: true, tools: true, multimodal: true } },
  },
  {
    id: 'gemini-3-5-flash',
    name: 'Gemini 3.5 Flash',
    type: 'chat',
    description: 'Fast multimodal streaming chat.',
    parameters: { features: { streaming: true, tools: true, multimodal: true } },
  },
  {
    id: 'grok-4-5',
    name: 'Grok 4.5',
    type: 'chat',
    description: 'Streaming chat with tool calls.',
    parameters: { features: { streaming: true, tools: true } },
  },
  {
    id: 'kimi-k3',
    name: 'Kimi K3',
    type: 'chat',
    description: 'Streaming chat with tool calls.',
    parameters: { features: { streaming: true, tools: true } },
  },
  {
    id: 'deepseek-v4-1-flash',
    name: 'DeepSeek V4.1 Flash',
    type: 'chat',
    description: 'Fast streaming chat with tool calls.',
    parameters: { features: { streaming: true, tools: true } },
  },
  // --- Image ---
  {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro',
    type: 'image',
    description: 'Text-to-image synthesis.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
      qualityTiers: ['1K', '2K'],
      features: { safetyChecker: true },
    },
  },
  {
    id: 'flux-2-flex',
    name: 'FLUX.2 Flex',
    type: 'image',
    description: 'Text-to-image synthesis with flexible guidance.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'],
      qualityTiers: ['1K', '2K'],
      features: { safetyChecker: true },
    },
  },
  {
    id: 'flux-2-pro-edit',
    name: 'FLUX.2 Pro Edit',
    type: 'image',
    description: 'Reference-conditioned image-to-image editing.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', 'auto'],
      qualityTiers: ['1K', '2K'],
      features: { imageToImage: true, safetyChecker: true },
    },
  },
  {
    id: 'nano-banana-edit',
    name: 'Nano Banana Edit',
    type: 'image',
    description: 'Instruction-based image editing with reference images.',
    parameters: {
      aspectRatios: ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9', 'auto'],
      formats: ['png', 'jpeg'],
      features: { imageToImage: true, inpainting: true },
    },
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    type: 'image',
    description: 'Image synthesis and reference-guided editing up to 4K.',
    parameters: {
      aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', 'auto'],
      qualityTiers: ['1K', '2K', '4K'],
      formats: ['png', 'jpg'],
      features: { imageToImage: true },
    },
  },
  {
    id: 'imagen4',
    name: 'Imagen 4',
    type: 'image',
    description: 'Photorealistic text-to-image synthesis.',
    parameters: {
      aspectRatios: ['1:1', '16:9', '9:16', '3:4', '4:3', 'auto'],
      features: { negativePrompt: true },
    },
  },
  {
    id: 'imagen4-ultra',
    name: 'Imagen 4 Ultra',
    type: 'image',
    description: 'Highest-fidelity text-to-image synthesis.',
    parameters: {
      aspectRatios: ['1:1', '16:9', '9:16', '3:4', '4:3', 'auto'],
      features: { negativePrompt: true },
    },
  },
  {
    id: 'seedream-v4',
    name: 'Seedream v4',
    type: 'image',
    description: 'Text-to-image synthesis with named size presets and seeds.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
      qualityTiers: ['1K', '2K', '4K'],
      features: { safetyChecker: true },
    },
  },
  {
    id: 'seedream-4-5-edit',
    name: 'Seedream 4.5 Edit',
    type: 'image',
    description: 'Reference-conditioned image editing with quality tiers.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'],
      qualityTiers: ['basic', 'high'],
      features: { imageToImage: true, safetyChecker: true },
    },
  },
  {
    id: 'qwen-text-to-image',
    name: 'Qwen Text-to-Image',
    type: 'image',
    description: 'Text-to-image synthesis with guidance and acceleration controls.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      formats: ['png', 'jpeg'],
      features: { negativePrompt: true, safetyChecker: true },
    },
  },
  {
    id: 'topaz-image-upscale',
    name: 'Topaz Image Upscaler',
    type: 'image',
    description: 'Upscales images by 1x, 2x, or 4x.',
    parameters: {},
  },
  // --- Video ---
  {
    id: 'kling-3-omni',
    name: 'Kling 3.0 Omni',
    type: 'video',
    description: 'Text-to-video synthesis with controllable duration and aspect ratio.',
    parameters: {
      durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      aspectRatios: ['16:9', '9:16', '1:1'],
      resolutions: ['720p', '1080p'],
    },
  },
  {
    id: 'kling-v2-5-turbo-text-to-video-pro',
    name: 'Kling 2.5 Turbo Pro (Text)',
    type: 'video',
    description: 'Fast text-to-video synthesis in 5s or 10s clips.',
    parameters: { durations: [5, 10], aspectRatios: ['16:9', '9:16', '1:1'] },
  },
  {
    id: 'kling-v2-5-turbo-image-to-video-pro',
    name: 'Kling 2.5 Turbo Pro (Image)',
    type: 'video',
    description: 'Image-to-video animation in 5s or 10s clips.',
    parameters: { durations: [5, 10], features: { imageToVideo: true } },
  },
  {
    id: 'veo-3-1',
    name: 'Veo 3.1',
    type: 'video',
    description: 'Text- or image-to-video with fallback and translation controls.',
    parameters: {
      durations: [4, 6, 8],
      aspectRatios: ['16:9', '9:16', 'auto'],
      resolutions: ['720p', '1080p', '4k'],
      features: { imageToVideo: true },
    },
  },
  {
    id: 'wan-2-5-text-to-video',
    name: 'Wan 2.5 (Text)',
    type: 'video',
    description: 'Text-to-video synthesis with prompt expansion.',
    parameters: { durations: [5, 10], aspectRatios: ['16:9', '9:16', '1:1'], resolutions: ['720p', '1080p'] },
  },
  {
    id: 'wan-2-5-image-to-video',
    name: 'Wan 2.5 (Image)',
    type: 'video',
    description: 'Image-to-video animation with prompt expansion.',
    parameters: { durations: [5, 10], resolutions: ['720p', '1080p'], features: { imageToVideo: true } },
  },
  {
    id: 'hailuo-02-text-to-video-pro',
    name: 'Hailuo 02 Pro (Text)',
    type: 'video',
    description: 'Text-to-video synthesis with prompt optimization.',
    parameters: { features: { safetyChecker: true } },
  },
  {
    id: 'hailuo-02-image-to-video-pro',
    name: 'Hailuo 02 Pro (Image)',
    type: 'video',
    description: 'Image-to-video animation with optional end frames.',
    parameters: { features: { imageToVideo: true, endFrame: true, safetyChecker: true } },
  },
  {
    id: 'seedance-1-5-pro',
    name: 'Seedance 1.5 Pro',
    type: 'video',
    description: 'Text- or image-to-video with fixed-lens and audio options.',
    parameters: {
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      features: { imageToVideo: true },
    },
  },
  {
    id: 'wan-2-6-video-to-video',
    name: 'Wan 2.6 (Video)',
    type: 'video',
    description: 'Video-to-video restyling with multi-shot support.',
    parameters: { durations: [5, 10], resolutions: ['720p', '1080p'] },
  },
  {
    id: 'topaz-video-upscale',
    name: 'Topaz Video Upscaler',
    type: 'video',
    description: 'Upscales videos by 1x, 2x, or 4x.',
    parameters: {},
  },
  // --- Audio ---
  {
    id: 'elevenlabs-tts',
    name: 'ElevenLabs TTS',
    type: 'audio',
    description: 'Speech synthesis with prosody continuity controls.',
    parameters: { features: { timestamps: true, dialogue: true } },
  },
  {
    id: 'elevenlabs-turbo-tts',
    name: 'ElevenLabs Turbo TTS',
    type: 'audio',
    description: 'Low-latency speech synthesis with timestamps.',
    parameters: { features: { timestamps: true } },
  },
  {
    id: 'gemini-2-5-pro-tts',
    name: 'Gemini 2.5 Pro TTS',
    type: 'audio',
    description: 'Multi-speaker dialogue synthesis with scene context.',
    parameters: { features: { dialogue: true } },
  },
  {
    id: 'suno',
    name: 'Suno',
    type: 'audio',
    description: 'Music composition from prompts, styles, and lyrics.',
    parameters: { features: { lyrics: true, stems: false } },
  },
  {
    id: 'suno-extend',
    name: 'Suno Extend',
    type: 'audio',
    description: 'Continues an existing Suno track; pass the track id as the attachment.',
    parameters: { features: { lyrics: true } },
  },
  {
    id: 'suno-cover',
    name: 'Suno Cover',
    type: 'audio',
    description: 'Renders a cover of an uploaded audio; pass its hosted URL as the attachment.',
    parameters: { features: { lyrics: true } },
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    type: 'audio',
    description: 'Speech-to-text transcription.',
    parameters: { features: { timestamps: true } },
  },
];

/**
 * Narrows the catalog by generation type and case-insensitive search over id, name, and description.
 * @param models The catalog entries to filter.
 * @param filter Optional criteria matching type or search keywords.
 * @returns The filtered catalog entries in catalog order.
 */
export function filterModels(models: AIModel[], filter?: ModelFilter): AIModel[] {
  return models.filter((model) => {
    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(model.type)) return false;
    }
    if (filter?.search) {
      const needle = filter.search.toLowerCase();
      const haystack = `${model.id} ${model.name} ${model.description ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
