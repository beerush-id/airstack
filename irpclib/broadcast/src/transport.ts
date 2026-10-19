import {
  decodeBlobs,
  encode,
  IRPC_PACKET_TYPE,
  IRPC_STATUS,
  IRPC_STORE,
  type IRPCCall,
  type IRPCData,
  type IRPCPacketStream,
  IRPCTransport,
  type TransportConfig,
  TransportError,
} from '@irpclib/irpc';
import { BC_MESSAGE_TYPE } from './enum.js';

/**
 * Configuration interface for BroadcastChannel transport.
 * Extends the base TransportConfig with BroadcastChannel-specific options.
 */
export type BroadcastTransportConfig = TransportConfig & {
  /**
   * The channel name for BroadcastChannel communication.
   * This will be prefixed with 'irpc://' internally to avoid conflicts.
   */
  channel: string;
};

/**
 * BroadcastChannel transport implementation for IRPC communication.
 * Enables cross-context communication (tabs, windows, iframes, workers) using the BroadcastChannel API.
 * The same transport configuration works on both client and server sides.
 */
export class BroadcastTransport extends IRPCTransport {
  /**
   * The BroadcastChannel instance.
   */
  private channel?: BroadcastChannel;

  /**
   * Gets the channel name with irpc:// prefix.
   * Returns the namespaced channel name.
   */
  public get endpoint(): string {
    return `irpc://${this.config.channel}`;
  }

  /**
   * Pending calls waiting for responses.
   */
  private pendingCalls = new Map<string, IRPCCall>();

  /**
   * Creates a new BroadcastChannel transport instance.
   * @param config - The configuration for this transport instance.
   */
  constructor(public config: BroadcastTransportConfig) {
    super(config);
    this.connect();
  }

  /**
   * Establishes a BroadcastChannel connection.
   */
  private connect(): void {
    if (this.channel) return;

    // Create channel with irpc:// prefix to avoid conflicts
    this.channel = new BroadcastChannel(this.endpoint);

    // Listen for incoming messages (both responses and requests for router)
    this.channel.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  /**
   * Handles incoming BroadcastChannel messages.
   * Determines if the message is a response or request and routes accordingly.
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = event.data;

      // Check if it's a response (has 'result' or 'error' field)
      if (this.isResponse(data)) {
        this.resolveResponse(data);
      }
      // Otherwise, it's a request that should be handled by the router
      // The router will set up its own message listener
    } catch (error) {
      IRPC_STORE.error(new Error('Failed to handle BroadcastChannel message:', { cause: error }), [
        { endpoint: this.endpoint },
      ]);
    }
  }

  /**
   * Checks if the data is an IRPC packet stream response.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Expect any.
  private isResponse(data: any): data is IRPCPacketStream<IRPCData> {
    return data && typeof data === 'object' && 'type' in data && 'status' in data;
  }

  /**
   * Resolves a response message.
   * Routes responses back to pending calls via enqueuing the packet boundary cleanly natively.
   */
  private resolveResponse(response: IRPCPacketStream<IRPCData>): void {
    const call = this.pendingCalls.get(response.id);

    if (!call) {
      console.warn('Received response for unknown call:', response.id);
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Expect any.
    if ((response as any).data) (response as any).data = decodeBlobs((response as any).data);
    call.enqueue(response);

    if (response.status === IRPC_STATUS.SUCCESS || response.status === IRPC_STATUS.ERROR) {
      this.pendingCalls.delete(response.id);
    }
  }

  /**
   * Dispatches RPC calls over BroadcastChannel.
   * Batches all calls into a single BroadcastChannel message.
   */
  public async dispatch(calls: IRPCCall[]): Promise<void> {
    if (!this.channel) {
      calls.forEach((call) => {
        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: TransportError.notConnected('BroadcastChannel').json(),
          createdAt: Date.now(),
        } as IRPCPacketStream<IRPCData>);
      });
      return;
    }

    try {
      calls.forEach((call) => {
        const { id, payload } = call;
        const { name, package: pkg, args, type, callId } = payload;

        this.pendingCalls.set(id, call);

        const packet = encode(args as IRPCData);
        const req: Record<string, unknown> = {
          id,
          name,
          package: pkg,
          args: packet.json.data,
          files: packet.json.files,
          type,
          callId,
        };

        if (packet.queues.length > 0) {
          const blobs: Record<string, Blob> = {};

          for (const queue of packet.queues) {
            blobs[queue.file.id] = queue.data;
          }

          req.blobs = blobs;
        }

        this.channel!.postMessage({ call: req, credentials: this.credentials });
      });
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
   * Closes the BroadcastChannel connection.
   */
  public close(call?: IRPCCall): void {
    if (call) {
      if (this.channel) {
        this.channel.postMessage({
          call: {
            id: call.id,
            name: call.payload.name,
            type: BC_MESSAGE_TYPE.CANCEL,
          },
          credentials: this.credentials,
        });
      }
      this.pendingCalls.delete(call.id);
      return;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = undefined;
    }

    // Reject all pending calls
    this.pendingCalls.forEach((call) => {
      call.enqueue({
        id: call.id,
        name: call.payload.name,
        type: IRPC_PACKET_TYPE.CLOSE,
        status: IRPC_STATUS.ERROR,
        error: TransportError.closed('BroadcastChannel').json(),
        createdAt: Date.now(),
      } as IRPCPacketStream<IRPCData>);
    });
    this.pendingCalls.clear();
  }
}
