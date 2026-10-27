import type { IRPCData } from '@irpclib/irpc';
import type { ChatMessage, ObjectMessage } from '../../chat/index.js';
import { DEFAULT_MAX_TOKENS } from './constant.js';

/** Endpoint families serving KIE chat models. */
export type ChatFamily = 'claude' | 'codex' | 'gemini';

/** Model-id prefixes mapped to their serving endpoint family. */
const CHAT_FAMILY_PREFIXES: Array<{ prefix: string; family: ChatFamily }> = [
  { prefix: 'claude', family: 'claude' },
  { prefix: 'gemini', family: 'gemini' },
  { prefix: 'gpt', family: 'codex' },
  { prefix: 'deepseek', family: 'codex' },
  { prefix: 'grok', family: 'codex' },
  { prefix: 'kimi', family: 'codex' },
];

/** Resolves the serving family for a chat model id from its prefix. */
export function chatFamily(model: string): ChatFamily {
  return CHAT_FAMILY_PREFIXES.find((entry) => model.startsWith(entry.prefix))?.family ?? 'codex';
}

/** Extracts the textual content of a message turn. */
function textContent(turn: ChatMessage<IRPCData, IRPCData>): string {
  return turn.type === 'text' ? turn.text : JSON.stringify((turn as ObjectMessage).data);
}

/** Builds an Anthropic Messages payload, mapping the system option to the top-level system field. */
function claudeBody(
  model: string,
  turns: ChatMessage<IRPCData, IRPCData>[],
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    model,
    max_tokens: (payload.maxTokens as number | undefined) ?? DEFAULT_MAX_TOKENS,
    stream: true,
    ...(typeof payload.system === 'string' ? { system: payload.system } : {}),
    ...(typeof payload.temperature === 'number' ? { temperature: payload.temperature } : {}),
    messages: turns.map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: textContent(turn),
    })),
  };
}

/**
 * Builds a Responses payload: each turn is a message with typed `input_text` /
 * `input_image` content blocks, and reasoning defaults to `low` upstream.
 */
function codexBody(
  model: string,
  turns: ChatMessage<IRPCData, IRPCData>[],
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    model,
    stream: true,
    input: turns.map((turn, index) => {
      const attachments =
        turn.attachments ?? (index === turns.length - 1 ? (payload.attachments as string[] | undefined) : undefined);
      const content = [
        { type: 'input_text', text: textContent(turn) },
        ...(attachments ?? []).map((url) => ({ type: 'input_image', image_url: url })),
      ];
      return { role: turn.role === 'assistant' ? 'assistant' : 'user', content };
    }),
  };
}

/** Builds a Gemini `contents` payload with text and `file_data` media parts. */
function geminiBody(_model: string, turns: ChatMessage<IRPCData, IRPCData>[]): Record<string, unknown> {
  return {
    contents: turns.map((turn, index) => {
      const attachments =
        turn.attachments ?? (index === turns.length - 1 ? (turn.attachments as string[] | undefined) : undefined);
      const parts = [
        { text: textContent(turn) },
        ...(attachments ?? []).map((url) => ({ file_data: { file_uri: url } })),
      ];
      return { role: turn.role === 'assistant' ? 'model' : 'user', parts };
    }),
  };
}

/** Reads the streamed text delta from an Anthropic Messages `content_block_delta` event. */
function claudeDelta(event: Record<string, unknown>): string {
  return event.type === 'content_block_delta' ? ((event.delta as { text?: string } | undefined)?.text ?? '') : '';
}

/** Reads the streamed text delta from a Responses `response.output_text.delta` event. */
function responsesDelta(event: Record<string, unknown>): string {
  return event.type === 'response.output_text.delta' ? ((event.delta as string | undefined) ?? '') : '';
}

/** Reads the streamed text delta from a Gemini `streamGenerateContent` chunk. */
function geminiDelta(event: Record<string, unknown>): string {
  const candidates = event.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const parts = candidates?.[0]?.content?.parts;
  return parts?.map((part) => part.text ?? '').join('') ?? '';
}

/** Payload builder translating normalized chat turns into a family-native request body. */
export type ChatBodyBuilder = (
  model: string,
  turns: ChatMessage<IRPCData, IRPCData>[],
  payload: Record<string, unknown>
) => Record<string, unknown>;

/**
 * Chat endpoint routing per family: canonical KIE path, payload builder, and SSE delta
 * reader. Gemini paths are model-specific (`/gemini/v1/models/{model}:streamGenerateContent`)
 * with the catalog id's dots mapped to the docs' dashes.
 */
export const CHAT_ROUTES: Record<
  ChatFamily,
  {
    endpoint: (model: string) => string;
    body: ChatBodyBuilder;
    delta: (event: Record<string, unknown>) => string;
  }
> = {
  claude: {
    endpoint: () => '/claude/v1/messages',
    body: claudeBody,
    delta: claudeDelta,
  },
  gemini: {
    endpoint: (model) => `/gemini/v1/models/${model.replace(/\./g, '-')}:streamGenerateContent`,
    body: (model, turns) => geminiBody(model, turns),
    delta: geminiDelta,
  },
  codex: {
    endpoint: () => '/codex/v1/responses',
    body: codexBody,
    delta: responsesDelta,
  },
};
