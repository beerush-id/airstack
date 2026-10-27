import { getEnv, type IRPCData } from '@irpclib/irpc';
import { type ChatMessage, type ChatTool, chatTurns, type ToolCall } from '../../chat/index.js';
import type { AIEnv, AskContext } from '../../types/context.js';
import type { AIDriver } from '../../types/driver.js';
import { DriverError } from '../../types/errors.js';
import type { OutputMeta } from '../../types/output.js';
import { createChunkWriter } from '../../utils/chunks.js';
import { readSSE } from '../../utils/sse.js';

/** Configuration for one OpenAI-compatible Chat Completions endpoint. */
export interface OpenAIOptions {
  /** Driver name, also the key checked against the environment's `allowedDrivers`. */
  name: string;
  /** API root including the version segment, e.g. `https://api.meta.ai/v1`. */
  baseUrl: string;
  /** Bearer token for the endpoint. */
  apiKey: string;
  /** Model ids this endpoint serves; calls for any other model are left to other drivers. */
  models: string[];
  /** Model used when a call names none. */
  defaultModel?: string;
  /** Explicitly disables this driver regardless of credentials. */
  enabled?: boolean;
}

/**
 * Chat driver for any OpenAI-compatible Chat Completions endpoint (Meta Model API, Baseten, and
 * others), one instance per endpoint. Streams text into the output, assembles streamed tool calls,
 * and translates tool names to the provider's allowed form and back, so callers keep their own
 * naming (`sys.fs.read`).
 */
export class OpenAIDriver implements AIDriver {
  readonly name: string;
  protected readonly options: OpenAIOptions;

  constructor(options: OpenAIOptions) {
    this.options = { ...options };
    this.name = options.name;
  }

  /**
   * Runs one chat turn: text deltas stream into `ctx.state.data.chunks`; `text` and `toolCalls` are
   * set once the stream completes. Reasoning deltas are never surfaced.
   */
  async ask<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(ctx: AskContext<T, M>): Promise<void> {
    const output = ctx.state.data;
    if (!this.canHandle(output.text || output.chunks?.length || output.data || output.toolCalls?.length)) return;
    const model = ctx.payload.model ?? this.options.defaultModel;
    if (!model || !this.options.models.includes(model)) return;

    const tools = ctx.payload.tools ?? [];
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: toMessages(chatTurns(ctx.input), ctx.payload.system),
        ...(tools.length ? { tools: tools.map(toFunction) } : {}),
        ...(typeof ctx.payload.temperature === 'number' ? { temperature: ctx.payload.temperature } : {}),
        ...(typeof ctx.payload.maxTokens === 'number' ? { max_tokens: ctx.payload.maxTokens } : {}),
      }),
      signal: ctx.signal,
    });
    if (!response.ok) {
      throw new DriverError(`${this.name} chat request failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
    }

    const calls: Array<{ id: string; name: string; args: string }> = [];
    const writer = createChunkWriter(output);
    await readSSE(response, (event) => {
      const delta = (event.choices as Array<{ delta?: StreamDelta }> | undefined)?.[0]?.delta;
      if (!delta) return;
      if (delta.content) writer.write(delta.content);
      for (const part of delta.tool_calls ?? []) {
        calls[part.index] ??= { id: '', name: '', args: '' };
        const call = calls[part.index];
        if (part.id) call.id = part.id;
        if (part.function?.name) call.name += part.function.name;
        if (part.function?.arguments) call.args += part.function.arguments;
      }
    });
    writer.end();

    if (calls.length) {
      const names = new Map(tools.map((tool) => [encodeName(tool.name), tool.name]));
      output.toolCalls = calls
        .filter(Boolean)
        .map(
          (call): ToolCall => ({ id: call.id, name: names.get(call.name) ?? call.name, args: parseArgs(call.args) })
        );
    }
  }

  /** Reports whether this driver may serve: enabled, credentialed, allowed, and the output not yet served. */
  private canHandle(served?: unknown): boolean {
    if (this.options.enabled === false || !this.options.apiKey) return false;
    const allowed = getEnv<AIEnv>().allowedDrivers;
    if (allowed && !allowed.has(this.name)) return false;
    return !served;
  }
}

/** The parts of a Chat Completions stream delta this driver reads. */
interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
}

/**
 * Encodes a tool name into the providers' allowed form: letters, digits, `_`, `-`, and at most one
 * dot. Dots become `__`, so `sys.fs.read` is sent as `sys__fs__read`.
 */
function encodeName(name: string): string {
  return name.replace(/\./g, '__');
}

/** Translates a normalized tool into a Chat Completions function definition. */
function toFunction(tool: ChatTool): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: encodeName(tool.name),
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.parameters ? { parameters: tool.parameters } : {}),
    },
  };
}

/**
 * Translates normalized turns into Chat Completions messages: the system option first, assistant
 * tool calls with encoded names and string arguments, tool results by call id, and user
 * attachments as image parts.
 */
function toMessages<T extends IRPCData, M extends IRPCData>(
  turns: ChatMessage<T, M>[],
  system?: string
): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = system ? [{ role: 'system', content: system }] : [];

  for (const turn of turns) {
    const content = turn.type === 'text' ? turn.text : JSON.stringify(turn.data);

    if (turn.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: turn.toolCallId, content });
    } else if (turn.role === 'assistant' && turn.toolCalls?.length) {
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: turn.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: encodeName(call.name), arguments: JSON.stringify(call.args) },
        })),
      });
    } else {
      const images = (turn.attachments ?? []).filter((item): item is string => typeof item === 'string');
      messages.push({
        role: turn.role,
        content: images.length
          ? [{ type: 'text', text: content }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
          : content,
      });
    }
  }

  return messages;
}

/** Parses streamed tool arguments; empty means no arguments, invalid JSON is kept as the raw string. */
function parseArgs(raw: string): IRPCData {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as IRPCData;
  } catch {
    return raw;
  }
}
