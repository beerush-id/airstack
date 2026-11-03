import {
  CallError,
  decodeBlobs,
  encode,
  IRPC_PACKET_TYPE,
  IRPC_STATUS,
  IRPC_STORE,
  type IRPCCall,
  type IRPCData,
  type IRPCFileQueue,
  type IRPCPacketCall,
  type IRPCPacketStream,
  IRPCTransport,
  type TransportConfig,
  TransportError,
} from '@irpclib/irpc';
import {
  DEFAULT_CONNECTION_TIMEOUT,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_RECONNECT_DELAY,
  WebSocketState,
  WS_MESSAGE_TYPE,
} from './enum.js';
import { encodeFileFrame } from './frame.js';

/**
 * Configuration interface for WebSocket transport.
 * Extends the base TransportConfig with WebSocket-specific options.
 */
export type WebSocketTransportConfig = TransportConfig & {
  /**
   * The WebSocket URL to connect to.
   * Required parameter that defines the WebSocket endpoint.
   */
  url: string;

  /**
   * Custom protocols to use for the WebSocket connection.
   * Optional array of sub-protocols.
   */
  protocols?: string[];

  /**
   * Maximum number of reconnection attempts.
   * Defaults to 5 if not provided.
   */
  maxReconnectAttempts?: number;

  /**
   * The delay between reconnection attempts.
   * Defaults to 1000ms if not provided.
   */
  reconnectDelay?: number;

  /**
   * Whether to automatically reconnect when the connection is lost.
   * Defaults to true if not provided.
   */
  autoReconnect?: boolean;

  /**
   * Connection timeout in milliseconds.
   * Defaults to 10000ms if not provided.
   */
  connectionTimeout?: number;

  /**
   * Custom headers to be included in the WebSocket connection.
   * Note: Not all WebSocket clients support custom headers.
   */
  headers?: Record<string, string>;
};

/**
 * WebSocket transport implementation for IRPC communication.
 * Handles sending RPC calls over WebSocket and processing real-time responses.
 */
export class WebSocketTransport extends IRPCTransport {
  /**
   * The WebSocket instance.
   */
  private ws?: WebSocket;

  /**
   * Current connection state.
   */
  public get state() {
    return this.ws?.readyState ?? WebSocketState.CLOSED;
  }

  /**
   * Whether the connection is currently open.
   */
  public get isOpen() {
    return this.state === WebSocketState.OPEN;
  }

  /**
   * Gets the WebSocket URL endpoint.
   * Returns the configured URL.
   */
  public get endpoint(): string {
    return this.config.url;
  }

  /**
   * Pending calls waiting for responses.
   */
  private pendingCalls = new Map<string, IRPCCall>();

  /**
   * Reconnection attempt counter.
   */
  private reconnectAttempts = 0;

  /**
   * Whether reconnection is currently in progress.
   */
  private isReconnecting = false;

  /**
   * Pending connection promise to prevent multiple simultaneous connection attempts.
   */
  private pendingConnection?: Promise<void>;

  /**
   * Creates a new WebSocket transport instance.
   * @param config - The configuration for this transport instance.
   */
  constructor(public config: WebSocketTransportConfig) {
    super(config);

    /* istanbul ignore start - Dev-only HMR signal handler */
    if (import.meta.hot) {
      // biome-ignore lint/suspicious/noExplicitAny: Detected as Bun's hot, not Vite's.
      const hot = import.meta.hot as any;

      hot.on('custom', (e: { type?: string }) => {
        if (e?.type !== 'irpc:invalidate-handler') return;
        if (this.isOpen || this.state === WebSocketState.CONNECTING) {
          void this.reconnect();
        }
      });
    }
    /* istanbul ignore stop */
  }

  /**
   * Establishes a WebSocket connection.
   */
  private async connect(): Promise<void> {
    if (this.pendingConnection) {
      return this.pendingConnection;
    }

    this.pendingConnection = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        const timeout = setTimeout(() => {
          this.ws?.close();
          reject(CallError.timeout());
        }, this.config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          delete this.pendingConnection;
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          delete this.pendingConnection;
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          delete this.pendingConnection;
          IRPC_STORE.error(TransportError.failed('WebSocket connection failed'), [{ url: this.config.url }]);
          reject(TransportError.failed('WebSocket connection failed'));
        };

        this.ws.onmessage = (event) => {
          this.resolve(event);
        };
      } catch (error) {
        delete this.pendingConnection;
        IRPC_STORE.error(error as Error, [{ url: this.config.url }]);
        reject(error);
      }
    });

    return this.pendingConnection;
  }

  /**
   * Handles WebSocket connection close events.
   */
  private handleClose(event: CloseEvent): void {
    // Reject all pending calls
    this.pendingCalls.forEach((call) => {
      call.enqueue({
        id: call.id,
        name: call.payload.name,
        type: IRPC_PACKET_TYPE.CLOSE,
        status: IRPC_STATUS.ERROR,
        error: TransportError.closed('WebSocket').json(),
        createdAt: Date.now(),
      } as IRPCPacketStream<IRPCData>);
    });
    this.pendingCalls.clear();

    // Attempt reconnection if enabled and connection wasn't closed intentionally
    if (
      this.config.autoReconnect !== false &&
      this.reconnectAttempts < (this.config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS)
    ) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedules a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    const delay = this.config.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;

    setTimeout(async () => {
      try {
        this.reconnectAttempts++;
        await this.connect();
      } catch (error) {
        IRPC_STORE.error(TransportError.failed(error as Error), [
          { url: this.config.url, attempts: this.reconnectAttempts },
        ]);
        if (
          this.config.autoReconnect !== false &&
          this.reconnectAttempts < (this.config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS)
        ) {
          this.isReconnecting = false;
          this.scheduleReconnect();
        } else {
          this.isReconnecting = false;
        }
      }
    }, delay);
  }

  /**
   * Handles incoming WebSocket messages.
   * Routes responses back to pending calls.
   */
  protected resolve(event: MessageEvent): void {
    try {
      const response: IRPCPacketStream<IRPCData> = decodeBlobs(JSON.parse(event.data));
      const call = this.pendingCalls.get(response.id);

      if (!call) {
        console.warn('Received response for unknown call:', response.id);
        return;
      }

      call.enqueue(response);

      if (response.status === IRPC_STATUS.SUCCESS || response.status === IRPC_STATUS.ERROR) {
        this.pendingCalls.delete(response.id);
      }
    } catch (error) {
      IRPC_STORE.error(new Error('Failed to parse WebSocket message:', { cause: error }), [{ url: this.config.url }]);
    }
  }

  /**
   * Dispatches RPC calls over WebSocket.
   * Batches all calls into a single WebSocket message.
   */
  public async dispatch(calls: IRPCCall[]): Promise<void> {
    // Reject calls if connection is closing or intentionally closed
    if (
      this.state === WebSocketState.CLOSING ||
      (this.state === WebSocketState.CLOSED && this.config.autoReconnect === false)
    ) {
      calls.forEach((call) => {
        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: TransportError.notConnected('WebSocket').json(),
          createdAt: Date.now(),
        } as IRPCPacketStream<IRPCData>);
      });

      return;
    }

    // Wait for existing connection attempt
    if (this.state === WebSocketState.CONNECTING) {
      try {
        await this.pendingConnection;
      } catch (error) {
        IRPC_STORE.error(
          error as Error,
          calls.map((c) => ({ id: c.id, name: c.payload.name }))
        );
        calls.forEach((call) => {
          call.enqueue({
            id: call.id,
            name: call.payload.name,
            type: IRPC_PACKET_TYPE.CLOSE,
            status: IRPC_STATUS.ERROR,
            error: TransportError.failed(error as Error).json(),
            createdAt: Date.now(),
          } as IRPCPacketStream<IRPCData>);
        });

        return;
      }
    }

    // Establish connection if closed
    if (!this.isOpen) {
      try {
        await this.connect();
      } catch (error) {
        IRPC_STORE.error(
          error as Error,
          calls.map((c) => ({ id: c.id, name: c.payload.name }))
        );
        calls.forEach((call) => {
          call.enqueue({
            id: call.id,
            name: call.payload.name,
            type: IRPC_PACKET_TYPE.CLOSE,
            status: IRPC_STATUS.ERROR,
            error: TransportError.failed(error as Error).json(),
            createdAt: Date.now(),
          } as IRPCPacketStream<IRPCData>);
        });
        return;
      }
    }

    try {
      const queues = new Set<{ call: IRPCPacketCall; files: IRPCFileQueue[] }>();

      calls.forEach((call) => {
        const { id, payload } = call;
        const { name, package: pkg, args, type, callId } = payload;

        this.pendingCalls.set(id, call);

        const packet = encode(args as IRPCData);

        if (packet.queues.length > 0) {
          queues.add({
            call: {
              id,
              name,
              package: pkg,
              args: packet.json.data,
              files: packet.json.files,
              type,
              callId,
            } as never as IRPCPacketCall,
            files: packet.queues,
          });
        } else {
          this.ws!.send(
            JSON.stringify({
              call: { id, name, package: pkg, args, type, callId },
              credentials: this.credentials,
            })
          );
        }
      });

      for (const queue of queues) {
        for (const file of queue.files) {
          const buffer = await file.data.arrayBuffer();
          this.ws!.send(encodeFileFrame(file.file.id, buffer));
        }

        this.ws!.send(JSON.stringify({ call: queue.call, credentials: this.credentials }));
      }

      queues.clear();
    } catch (error) {
      IRPC_STORE.error(
        error as Error,
        calls.map((c) => ({ id: c.id, name: c.payload.name }))
      );
      calls.forEach((call) => {
        this.pendingCalls.delete(call.id);

        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: TransportError.failed(error as Error).json(),
          createdAt: Date.now(),
        } as IRPCPacketStream<IRPCData>);
      });
    }
  }

  /**
   * Closes the WebSocket connection.
   */
  public close(call?: IRPCCall): void {
    if (call) {
      if (this.isOpen) {
        this.ws!.send(
          JSON.stringify({
            call: {
              id: call.id,
              name: call.payload.name,
              type: WS_MESSAGE_TYPE.CANCEL,
            },
            credentials: this.credentials,
          })
        );
      }

      this.pendingCalls.delete(call.id);
      return;
    }

    if (this.ws) {
      this.config.autoReconnect = false;
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Forces a reconnection.
   */
  public async reconnect(): Promise<void> {
    const autoReconnect = this.config.autoReconnect;
    this.close();
    this.config.autoReconnect = autoReconnect;
    this.reconnectAttempts = 0;
    await this.connect();
  }
}
