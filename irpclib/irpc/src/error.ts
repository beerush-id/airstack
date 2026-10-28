import type { IRPCPacketError } from './types.js';

export const IRPC_ERROR_TYPE = {
  STUB: 'stub',
  HOOK: 'hook',
  CALL: 'call',
  CRUD: 'crud',
  GUARD: 'guard',
  HANDLER: 'handler',
  RESOLVE: 'resolve',
  TRANSPORT: 'transport',
} as const;

export type IRPCErrorType = (typeof IRPC_ERROR_TYPE)[keyof typeof IRPC_ERROR_TYPE];

// ---------------------------------------------------------------------------
// Error codes per domain
// ---------------------------------------------------------------------------

export const STUB_ERROR = {
  DUPLICATE: 'duplicate',
  INVALID: 'invalid',
  NOT_FOUND: 'not_found',
  INVALID_NAME: 'invalid_name',
  INVALID_VERSION: 'invalid_version',
  NOT_DECLARED: 'not_declared',
  INVALID_TOOL: 'invalid_tool',
} as const;

export const HANDLER_ERROR = {
  INVALID: 'invalid',
  MISSING: 'missing',
  ERROR: 'error',
} as const;

export const TRANSPORT_ERROR = {
  INVALID: 'invalid',
  MISSING: 'missing',
  NOT_IMPLEMENTED: 'not_implemented',
  NOT_CONNECTED: 'not_connected',
  CLOSED: 'closed',
  INVALID_BODY: 'invalid_body',
  STREAM_TERMINATED: 'stream_terminated',
  ERROR: 'error',
  NOT_FOUND: 'not_found',
} as const;

export const RESOLVE_ERROR = {
  NOT_FOUND: 'not_found',
  INVALID_INPUT: 'invalid_input',
  INVALID_OUTPUT: 'invalid_output',
  ERROR: 'error',
} as const;

export const HOOK_ERROR = {
  INVALID: 'invalid',
  ERROR: 'error',
} as const;

export const GUARD_ERROR = {
  INVALID: 'invalid',
  ERROR: 'error',
};

export const CALL_ERROR = {
  TIMEOUT: 'timeout',
  MAX_RETRIES: 'max_retries',
  STREAM_ERROR: 'stream_error',
} as const;

export const CRUD_ERROR = {
  NOT_FOUND: 'not_found',
  NOT_IMPLEMENTED: 'not_implemented',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrap(input: Error | string): { message: string; cause?: Error } {
  if (input instanceof Error) return { message: input.message, cause: input };
  return { message: input };
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base error class for all IRPC errors.
 *
 * @property type - The domain category of the error (stub, handler, transport, etc.)
 * @property code - A stable, machine-readable code for translation or programmatic matching.
 */
export class IRPCError extends Error {
  constructor(
    public type: IRPCErrorType,
    public code: string,
    message: string,
    public cause?: Error
  ) {
    super(message);
  }

  /** Serialize to the wire format used in IRPC packets. */
  json(): IRPCPacketError {
    return { type: this.type, code: this.code, message: this.message };
  }

  /** Reconstruct an IRPCError from a wire packet error. */
  static from(obj: IRPCPacketError): IRPCError {
    const ErrorClass = IRPC_ERROR_CLASS[obj.type as IRPCErrorType];
    if (ErrorClass) return new ErrorClass(obj.code, obj.message);
    return new IRPCError(obj.type as IRPCErrorType, obj.code, obj.message);
  }
}

/** Errors related to stub declaration, registration, and lookup. */
export class StubError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.STUB, code, message, cause);
  }

  static duplicate(name: string) {
    return new StubError(STUB_ERROR.DUPLICATE, `IRPC "${name}" already exists.`);
  }
  static invalid() {
    return new StubError(STUB_ERROR.INVALID, 'Invalid stub.');
  }
  static notFound() {
    return new StubError(STUB_ERROR.NOT_FOUND, 'No spec found for stub.');
  }
  static invalidName(name: string) {
    return new StubError(STUB_ERROR.INVALID_NAME, `Invalid name: ${name}`);
  }
  static invalidVersion(version: string) {
    return new StubError(STUB_ERROR.INVALID_VERSION, `Invalid version: ${version}`);
  }
  static notDeclared(name: string, href: string) {
    return new StubError(STUB_ERROR.NOT_DECLARED, `IRPC "${name}" is not declared in ${href}.`);
  }
  static invalidTool(name: string) {
    return new StubError(
      STUB_ERROR.INVALID_TOOL,
      `IRPC "${name}" takes positional arguments, so its mcp options must name them (args).`
    );
  }
}

/** Errors related to handler registration and execution. */
export class HandlerError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.HANDLER, code, message, cause);
  }

  static invalid() {
    return new HandlerError(HANDLER_ERROR.INVALID, 'Handler must be a function.');
  }
  static missing(name: string) {
    return new HandlerError(HANDLER_ERROR.MISSING, `IRPC "${name}" has no implementation.`);
  }
  static failed(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new HandlerError(HANDLER_ERROR.ERROR, message, cause);
  }
}

/** Errors related to the transport layer. */
export class TransportError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.TRANSPORT, code, message, cause);
  }

  static missing() {
    return new TransportError(TRANSPORT_ERROR.MISSING, 'No transport configured.');
  }
  static invalid() {
    return new TransportError(TRANSPORT_ERROR.INVALID, 'Invalid transport.');
  }
  static notImplemented() {
    return new TransportError(TRANSPORT_ERROR.NOT_IMPLEMENTED, 'Transport dispatch not implemented.');
  }
  static notConnected(name: string) {
    return new TransportError(TRANSPORT_ERROR.NOT_CONNECTED, `${name} is not connected.`);
  }
  static closed(name: string) {
    return new TransportError(TRANSPORT_ERROR.CLOSED, `${name} connection closed.`);
  }
  static invalidBody() {
    return new TransportError(TRANSPORT_ERROR.INVALID_BODY, 'Invalid response body.');
  }
  static streamTerminated() {
    return new TransportError(TRANSPORT_ERROR.STREAM_TERMINATED, 'Response stream terminated.');
  }
  static failed(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new TransportError(TRANSPORT_ERROR.ERROR, message, cause);
  }
  static notFound(name: string) {
    return new TransportError(TRANSPORT_ERROR.NOT_FOUND, `Can not resolve package for "${name}" call.`);
  }
}

/** Errors related to server-side request resolution. */
export class ResolveError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.RESOLVE, code, message, cause);
  }

  static notFound(name: string) {
    return new ResolveError(RESOLVE_ERROR.NOT_FOUND, `IRPC "${name}" does not exist.`);
  }
  static invalidInput(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new ResolveError(RESOLVE_ERROR.INVALID_INPUT, message, cause);
  }
  static invalidOutput(input?: Error | string) {
    if (!input) return new ResolveError(RESOLVE_ERROR.INVALID_OUTPUT, 'Invalid output.');
    const { message, cause } = unwrap(input);
    return new ResolveError(RESOLVE_ERROR.INVALID_OUTPUT, message, cause);
  }
  static failed(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new ResolveError(RESOLVE_ERROR.ERROR, message, cause);
  }
}

/** Errors related to hook registration and execution. */
export class HookError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.HOOK, code, message, cause);
  }

  static invalid() {
    return new HookError(HOOK_ERROR.INVALID, 'Hook must be a function.');
  }
  static failed(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new HookError(HOOK_ERROR.ERROR, message, cause);
  }
}

/** Errors related to guard registration and execution. */
export class GuardError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.GUARD, code, message, cause);
  }

  static invalid() {
    return new GuardError(GUARD_ERROR.INVALID, 'Guard must be a function.');
  }
  static failed(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new GuardError(GUARD_ERROR.ERROR, message, cause);
  }
}

/** Errors related to call execution lifecycle. */
export class CallError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.CALL, code, message, cause);
  }

  static timeout() {
    return new CallError(CALL_ERROR.TIMEOUT, 'Call timed out.');
  }
  static maxRetries(reasons: Set<Error>) {
    const detail = Array.from(reasons)
      .map((r) => r.message)
      .join(', ');
    return new CallError(CALL_ERROR.MAX_RETRIES, `Max retries reached: ${detail}`);
  }
  static streamError(input: Error | string) {
    const { message, cause } = unwrap(input);
    return new CallError(CALL_ERROR.STREAM_ERROR, message, cause);
  }
}

/** Errors related to CRUD adapter operations. */
export class CrudError extends IRPCError {
  constructor(code: string, message: string, cause?: Error) {
    super(IRPC_ERROR_TYPE.CRUD, code, message, cause);
  }

  static notFound() {
    return new CrudError(CRUD_ERROR.NOT_FOUND, 'Unknown CRUD instance — was it created with pkg.crud()?');
  }
  static notImplemented(method: string) {
    return new CrudError(CRUD_ERROR.NOT_IMPLEMENTED, `CRUD method "${method}" not implemented.`);
  }
}

// ---------------------------------------------------------------------------
// Type → Class mapping for reconstruction
// ---------------------------------------------------------------------------

type IRPCErrorSubclass = new (code: string, message: string, cause?: Error) => IRPCError;

const IRPC_ERROR_CLASS: Record<string, IRPCErrorSubclass> = {
  [IRPC_ERROR_TYPE.STUB]: StubError,
  [IRPC_ERROR_TYPE.HANDLER]: HandlerError,
  [IRPC_ERROR_TYPE.TRANSPORT]: TransportError,
  [IRPC_ERROR_TYPE.RESOLVE]: ResolveError,
  [IRPC_ERROR_TYPE.HOOK]: HookError,
  [IRPC_ERROR_TYPE.CALL]: CallError,
  [IRPC_ERROR_TYPE.CRUD]: CrudError,
};
