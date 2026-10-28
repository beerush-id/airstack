import { getEnv, type IRPCData } from '@irpclib/irpc';
import { type ChatMessage, type ChatOutput, type ChatTool, chatTurns, type ToolCall } from '../../chat/index.js';
import type { AIEnv, AskContext } from '../../types/context.js';
import type { AIDriver } from '../../types/driver.js';
import { DriverError } from '../../types/errors.js';
import type { OutputMeta } from '../../types/output.js';
import { createBatcher, createChunkWriter } from '../../utils/chunks.js';
import { readSSE } from '../../utils/sse.js';

/** Configuration for one OpenAI-compatible endpoint. */
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
  /**
   * Which API to speak: `chat` (Chat Completions, the default) or `responses` (the Responses API,
   * which streams answers in real deltas, reasoning summaries, and commentary apart from the answer).
   */
  api?: 'chat' | 'responses';
  /** Explicitly disables this driver regardless of credentials. */
  enabled?: boolean;
}

/**
 * Chat driver for any OpenAI-compatible endpoint (Meta Model API, Baseten, and others), one instance
 * per endpoint, over Chat Completions or the Responses API. Streams the answer into `chunks`, keeps
 * reasoning and commentary apart when the provider separates them, assembles tool calls, and
 * translates tool names to the provider's allowed form and back, so callers keep their own naming
 * (`sys.fs.read`).
 */
export class OpenAIDriver implements AIDriver {
  readonly name: string;
  protected readonly options: OpenAIOptions;

  constructor(options: OpenAIOptions) {
    this.options = { ...options };
    this.name = options.name;
  }

  /**
   * Runs one chat turn: the answer streams into `ctx.state.data.chunks`; `text` and `toolCalls` are
   * set once the stream completes. Reasoning summaries and commentary stream into their own fields.
   */
  async ask<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(ctx: AskContext<T, M>): Promise<void> {
    const output = ctx.state.data;
    if (!this.canHandle(output.text || output.chunks?.length || output.data || output.toolCalls?.length)) return;
    const model = ctx.payload.model ?? this.options.defaultModel;
    if (!model || !this.options.models.includes(model)) return;

    const tools = ctx.payload.tools ?? [];
    const turns = chatTurns(ctx.input);
    const sampling = {
      ...(typeof ctx.payload.temperature === 'number' ? { temperature: ctx.payload.temperature } : {}),
    };
    const names = new Map(tools.map((tool) => [encodeName(tool.name), tool.name]));
    const decode = (name: string) => names.get(name) ?? name;

    const calls =
      this.options.api === 'responses'
        ? await this.streamResponses(
            output,
            {
              model,
              stream: true,
              ...(ctx.payload.system ? { instructions: ctx.payload.system } : {}),
              input: toInputItems(turns),
              ...(tools.length ? { tools: tools.map(toResponsesFunction) } : {}),
              ...sampling,
              ...(typeof ctx.payload.maxTokens === 'number' ? { max_output_tokens: ctx.payload.maxTokens } : {}),
              reasoning: {
                summary: 'auto',
                ...(ctx.payload.reasoningEffort ? { effort: ctx.payload.reasoningEffort } : {}),
              },
            },
            ctx.signal
          )
        : await this.streamChat(
            output,
            {
              model,
              stream: true,
              messages: toMessages(turns, ctx.payload.system),
              ...(tools.length ? { tools: tools.map(toChatFunction) } : {}),
              ...sampling,
              ...(typeof ctx.payload.maxTokens === 'number' ? { max_tokens: ctx.payload.maxTokens } : {}),
              ...(ctx.payload.reasoningEffort ? { reasoning_effort: ctx.payload.reasoningEffort } : {}),
            },
            ctx.signal
          );

    if (calls.length) {
      output.toolCalls = calls.map(
        (call): ToolCall => ({ id: call.id, name: decode(call.name), args: parseArgs(call.args) })
      );
    }
  }

  /** Streams a Chat Completions response: answer deltas, and tool calls assembled from fragments. */
  private async streamChat(output: ChatOutput, body: Record<string, unknown>, signal?: AbortSignal) {
    const response = await this.post('/chat/completions', body, signal);
    const calls: RawCall[] = [];
    const writer = createChunkWriter(output);

    await readSSE(response, (event) => {
      const delta = (event.choices as Array<{ delta?: ChatDelta }> | undefined)?.[0]?.delta;
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

    return calls.filter(Boolean);
  }

  /**
   * Streams a Responses API response. Text of a message the provider marks as commentary goes to
   * `commentary`, the rest to the answer; reasoning summaries go to `reasoning`; function calls are
   * taken whole when their item completes.
   */
  private async streamResponses(output: ChatOutput, body: Record<string, unknown>, signal?: AbortSignal) {
    const response = await this.post('/responses', body, signal);
    const calls: RawCall[] = [];
    const phases = new Map<string, string | undefined>();
    const answer = createChunkWriter(output);
    const commentary = createBatcher((batch) => {
      output.commentary ??= [];
      output.commentary.push(batch);
    });
    const reasoning = createBatcher((batch) => {
      output.reasoning ??= [];
      output.reasoning.push(batch);
    });
    let summaries = 0;
    let failure: string | undefined;

    await readSSE(response, (event) => {
      const item = event.item as ResponsesItem | undefined;

      switch (event.type) {
        case 'response.output_item.added':
          if (item?.type === 'message') phases.set(item.id, item.phase);
          break;
        case 'response.output_text.delta':
          if (phases.get(event.item_id as string) === 'commentary') commentary.write(event.delta as string);
          else answer.write(event.delta as string);
          break;
        case 'response.reasoning_summary_part.added':
          if (summaries > 0) reasoning.write('\n\n');
          summaries += 1;
          break;
        case 'response.reasoning_summary_text.delta':
          reasoning.write(event.delta as string);
          break;
        case 'response.output_item.done':
          if (item?.type === 'function_call') {
            calls.push({ id: item.call_id ?? '', name: item.name ?? '', args: item.arguments ?? '' });
          }
          break;
        case 'response.failed':
        case 'error':
          failure = failureMessage(event) ?? 'unknown error';
          break;
      }
    });

    commentary.flush();
    reasoning.flush();
    answer.end();
    if (failure) throw new DriverError(`${this.name} response failed: ${failure}`, this.name, 'UPSTREAM_ERROR');

    return calls;
  }

  /** Posts a streaming request, rejecting a failed HTTP status. */
  private async post(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new DriverError(`${this.name} chat request failed: ${response.status}`, this.name, 'UPSTREAM_ERROR');
    }
    return response;
  }

  /** Reports whether this driver may serve: enabled, credentialed, allowed, and the output not yet served. */
  private canHandle(served?: unknown): boolean {
    if (this.options.enabled === false || !this.options.apiKey) return false;
    const allowed = getEnv<AIEnv>().allowedDrivers;
    if (allowed && !allowed.has(this.name)) return false;
    return !served;
  }
}

/** A tool call as it came off the wire: provider id, encoded name, raw argument text. */
type RawCall = { id: string; name: string; args: string };

/** The parts of a Chat Completions stream delta this driver reads. */
interface ChatDelta {
  content?: string | null;
  tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
}

/** The parts of a Responses API output item this driver reads. */
interface ResponsesItem {
  id: string;
  type: string;
  phase?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

/**
 * Encodes a tool name into the providers' allowed form: letters, digits, `_`, `-`, and at most one
 * dot. Dots become `__`, so `sys.fs.read` is sent as `sys__fs__read`.
 */
function encodeName(name: string): string {
  return name.replace(/\./g, '__');
}

/** A normalized tool as a Chat Completions function definition. */
function toChatFunction(tool: ChatTool): Record<string, unknown> {
  return { type: 'function', function: functionShape(tool) };
}

/** A normalized tool as a Responses API function definition: the same fields, flat. */
function toResponsesFunction(tool: ChatTool): Record<string, unknown> {
  return { type: 'function', ...functionShape(tool) };
}

function functionShape(tool: ChatTool): Record<string, unknown> {
  return {
    name: encodeName(tool.name),
    ...(tool.description ? { description: tool.description } : {}),
    ...(tool.parameters ? { parameters: tool.parameters } : {}),
  };
}

/** The text a turn carries: its text, or its data as JSON. */
function contentOf<T extends IRPCData, M extends IRPCData>(turn: ChatMessage<T, M>): string {
  return turn.type === 'text' ? turn.text : JSON.stringify(turn.data);
}

/** A turn's attachments that are URLs, sent as images. */
function imagesOf<T extends IRPCData, M extends IRPCData>(turn: ChatMessage<T, M>): string[] {
  return (turn.attachments ?? []).filter((item): item is string => typeof item === 'string');
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
    const content = contentOf(turn);

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
      const images = imagesOf(turn);
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

/**
 * Translates normalized turns into Responses API input items: messages by role, an assistant turn's
 * tool calls as `function_call` items after its text, tool results as `function_call_output`, and
 * user attachments as `input_image` parts. The system prompt travels as `instructions` instead.
 */
function toInputItems<T extends IRPCData, M extends IRPCData>(turns: ChatMessage<T, M>[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];

  for (const turn of turns) {
    const content = contentOf(turn);

    if (turn.role === 'tool') {
      items.push({ type: 'function_call_output', call_id: turn.toolCallId, output: content });
      continue;
    }

    const images = imagesOf(turn);
    if (content || images.length || !turn.toolCalls?.length) {
      items.push({
        role: turn.role,
        content: images.length
          ? [{ type: 'input_text', text: content }, ...images.map((url) => ({ type: 'input_image', image_url: url }))]
          : content,
      });
    }

    for (const call of turn.toolCalls ?? []) {
      items.push({
        type: 'function_call',
        call_id: call.id,
        name: encodeName(call.name),
        arguments: JSON.stringify(call.args),
      });
    }
  }

  return items;
}

/** The message of a failed Responses stream, wherever the provider put it. */
function failureMessage(event: Record<string, unknown>): string | undefined {
  const response = event.response as { error?: { message?: string } } | undefined;
  const error = event.error as { message?: string } | undefined;
  return response?.error?.message ?? error?.message ?? (event.message as string | undefined);
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
