/** Base URL for KIE API calls. */
export const DEFAULT_BASE_URL = 'https://api.kie.ai';

/** Default completion budget in tokens (the Claude Messages schema requires max_tokens). */
export const DEFAULT_MAX_TOKENS = 8192;

/** Interval in milliseconds for polling asynchronous generative tasks (default: 2000ms). */
export const DEFAULT_POLL_INTERVAL = 2000;

/** Timeout in milliseconds before timing out an async job (default: 300000ms / 5 min). */
export const DEFAULT_TIMEOUT = 300000;

/** Instruction prompt used when no transcription guidance is supplied. */
export const DEFAULT_TRANSCRIBE_PROMPT = 'Transcribe the audio verbatim.';

/** OpenAI-compatible transcription endpoint (audio URL mapped to a Gemini media block). */
export const TRANSCRIBE_ENDPOINT = '/gemini-3-pro/v1/chat/completions';

/** Suno engine version used for music composition tasks (required by the schema; V5 and below are discontinued). */
export const DEFAULT_SUNO_MODEL = 'V6';

/** Default voice persona for speech synthesis (the schema requires voice). */
export const DEFAULT_VOICE = 'Rachel';

/** Base URL of the KIE file service (separate domain from the API). */
export const UPLOAD_BASE_URL = 'https://kieai.redpandaai.co';

/** Default target path for uploaded files on the KIE file service. */
export const UPLOAD_PATH = 'ai-kit/uploads';
