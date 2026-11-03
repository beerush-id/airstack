/** Error raised when an operation or stream is cancelled via an AbortSignal. */
export class AbortError extends Error {
  readonly name = 'AbortError';
}

/**
 * Error raised when a provider driver encounters an execution, network, or upstream failure.
 * Standardized codes: 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'INVALID_PAYLOAD' | 'NETWORK_ERROR' | 'UPSTREAM_ERROR' | 'TIMEOUT'.
 */
export class DriverError extends Error {
  readonly name = 'DriverError';

  constructor(
    message: string,
    public readonly driver: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}
