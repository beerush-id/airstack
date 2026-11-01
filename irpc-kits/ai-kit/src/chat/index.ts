import type { IRPCData, IRPCFile } from '@irpclib/irpc';
import type { Output, OutputMeta } from '../types/output.js';

/** Role of the entity authoring the conversational turn. */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Base properties shared by all conversation message turns.
 * @template M JSON-serializable custom metadata payload attached to this turn.
 */
export interface BaseChatMessage<M extends IRPCData = OutputMeta> {
  role: ChatRole;
  meta?: M;
  /** Reference URLs for multimodal turns, or IRPCFiles uploaded automatically before dispatch. */
  attachments?: (string | IRPCFile)[];
  /** On an assistant turn: the tool calls the model made in that turn. */
  toolCalls?: ToolCall[];
  /** On a tool turn: the id of the call this turn answers. */
  toolCallId?: string;
  [key: string]: IRPCData;
}

/**
 * A tool the model may call, described in provider-neutral form. Drivers translate it into
 * their provider's function-calling format, including any naming constraints.
 */
/** The web search a provider hosts, as a tool in a request and as a call in `calling`. */
export const WEB_SEARCH = 'web_search';

export type ChatTool = {
  /** Caller-facing name; drivers encode it when the provider restricts tool names. */
  name: string;
  /** What the tool does, for the model. */
  description?: string;
  /** JSON Schema of the arguments object. */
  parameters?: Record<string, IRPCData>;
};

/** A tool call made by the model, normalized across providers. */
export type ToolCall = {
  /** Provider-issued id, echoed back on the tool turn that answers it. */
  id: string;
  /** The tool's caller-facing name, decoded from the provider's encoding. */
  name: string;
  /** The parsed arguments; the raw string when the model produced invalid JSON. */
  args: IRPCData;
};

/**
 * A message turn containing textual content.
 * @template M JSON-serializable custom metadata payload attached to this turn.
 */
export interface TextMessage<M extends IRPCData = OutputMeta> extends BaseChatMessage<M> {
  type: 'text';
  text: string;
}

/**
 * A message turn containing structured data or tool execution results.
 * @template T JSON-serializable shape of the structured data payload.
 * @template M JSON-serializable custom metadata payload attached to this turn.
 */
export interface ObjectMessage<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>
  extends BaseChatMessage<M> {
  type: 'object';
  data: T;
}

/**
 * A discriminated conversation turn containing either text or structured data.
 * @template T JSON-serializable shape of the structured data payload if an object turn.
 * @template M JSON-serializable custom metadata payload attached to this turn.
 */
export type ChatMessage<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> =
  | TextMessage<M>
  | ObjectMessage<T, M>;

/**
 * Normalized input accepted by chat invocations.
 * Supports a single prompt string, a single structured message turn, or an array of turns.
 * @template T JSON-serializable shape of the structured data payload if an object turn.
 * @template M JSON-serializable custom metadata payload attached to message turns.
 */
export type ChatInput<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> =
  | string
  | ChatMessage<T, M>
  | ChatMessage<T, M>[];

/** Execution and sampling parameters for chat invocations. */
export interface ChatOptions {
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  attachments?: string[];
  /** Tools the model may call this turn; the results return as `tool` turns in the next call. */
  tools?: ChatTool[];
  /** How hard the model reasons before answering, in the provider's terms (e.g. `minimal`, `low`, `high`). */
  reasoningEffort?: string;
  /** Lets the model search the web itself, where the provider hosts it; ignored where it doesn't. */
  webSearch?: boolean;
  [key: string]: unknown;
}

/**
 * Normalizes any accepted chat input into an ordered list of turns.
 *
 * @param input - A prompt string, one turn, or a list of turns.
 * @returns The turns, a prompt string becoming one user text turn.
 */
export function chatTurns<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>(
  input: ChatInput<T, M>
): ChatMessage<T, M>[] {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') return [{ role: 'user', type: 'text', text: input }];
  return [input];
}

/**
 * Normalized generative output returned by chat completion operations.
 * Extends canonical Output with the generated assistant response.
 * @template T JSON-serializable shape of the structured data payload if an object turn.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface ChatOutput<T extends IRPCData = IRPCData, M extends IRPCData = OutputMeta>
  extends Output<ChatInput<T, M>, M> {
  /** Role of the completion entity (always 'assistant'). */
  role: 'assistant';
  /** Type of the assistant turn ('text' or 'object'). */
  type: 'text' | 'object';
  /** Text deltas as they stream, each pushed once; join them for the text so far. */
  chunks?: string[];
  /** The complete response text, set once the stream ends. */
  text?: string;
  /** Structured object payload when type is 'object'. */
  data?: T;
  /** Optional attachments produced by the assistant. */
  attachments?: string[];
  /** Tool calls the model made in this turn, complete once the output succeeds. */
  toolCalls?: ToolCall[];
  /**
   * The tools the model is calling, by name, as soon as it starts each call: writing a long
   * argument can take a while, and this says what's coming before `toolCalls` can.
   */
  calling?: string[];
  /**
   * What each call in `calling` has written of its arguments so far, in the same order: raw JSON
   * deltas, each pushed once. Part of a call can matter long before the call is whole.
   */
  drafts?: string[][];
  /** What the provider searched the web for, each as its search finishes; it starts in `calling`. */
  searched?: string[];
  /**
   * Text the provider marks as commentary on its tool calls, kept apart from the answer. Absent when
   * the provider doesn't separate it.
   */
  commentary?: string[];
  /**
   * Reasoning summaries as they stream; separate summaries are divided by a blank line. Absent when
   * the provider gives none.
   */
  reasoning?: string[];
}
