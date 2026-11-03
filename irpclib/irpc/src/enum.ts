import { $symbol } from '@airlib/core';

export const IRPC_PACKET_TYPE = {
  CALL: 'call',
  EVENT: 'event',
  CLOSE: 'close',
  ANSWER: 'answer',
  ASK: 'ask',
  REPLY: 'reply',
} as const;

export const IRPC_STATUS = {
  IDLE: 'idle',
  ERROR: 'error',
  PENDING: 'pending',
  SUCCESS: 'success',
  ABORTED: 'aborted',
} as const;

export const IRPC_STORE_EVENT = {
  ROUTE: 'route',
  QUEUE: 'queue',
  DEQUEUE: 'dequeue',
  REGISTER: 'register',
  ERROR: 'error',
} as const;

export const IRPC_BASE_CONTEXT = {
  ABORT_SIGNAL: $symbol('irpc-abort-signal'),
  ABORT_CONTROLLER: $symbol('irpc-abort-controller'),
  CREDENTIALS: $symbol('irpc-credentials'),
  DEFERRED_HOOK: $symbol('irpc-deferred-hook'),
} as const;

export const IRPC_FILE_STATUS = {
  IDLE: 'idle',
  PENDING: 'pending',
  SUCCESS: 'success',
  ABORTED: 'aborted',
  ERROR: 'error',
} as const;
