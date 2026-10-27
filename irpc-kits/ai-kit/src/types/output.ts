import type { IRPCData } from '@irpclib/irpc';

/**
 * Canonical lifecycle execution status from the IRPC runtime (IRPC_STATUS).
 * Values: 'idle' | 'pending' | 'success' | 'error' | 'aborted'.
 */
export type IRPCStatus = 'idle' | 'pending' | 'success' | 'error' | 'aborted';

/** Canonical lifecycle execution status matching the IRPC runtime. */
export type OutputStatus = IRPCStatus;

/** Default JSON-serializable metadata payload attached to outputs and message turns. */
export type OutputMeta = Record<string, IRPCData>;

/**
 * Normalized generative output representing an operation turn or task.
 * Embeds the original input options for reproducibility and retry/regeneration.
 * @template I JSON-serializable shape of the input parameters that produced this output.
 * @template M JSON-serializable custom metadata payload attached to this output.
 */
export interface Output<I extends IRPCData = IRPCData, M extends IRPCData = OutputMeta> {
  /** Unique client output identifier. */
  id: string;
  /** Current lifecycle status of the generation task matching canonical IRPCStatus. */
  status: OutputStatus;
  /** The input options that produced this output (enables regeneration/forking). */
  input: I;
  /** Publicly accessible URL or base64 data URI of the generated asset once ready. */
  url?: string;
  /** MIME type of the generated asset (e.g. 'image/webp', 'video/mp4', 'audio/mp3'). */
  type?: string;
  /** Serialized error detail if the generation task encountered an error or failed. */
  error?: IRPCData;
  /** Custom or provider metadata payload (e.g. upstream taskId, provider performance diagnostics). */
  meta?: M;
  [key: string]: IRPCData;
}
