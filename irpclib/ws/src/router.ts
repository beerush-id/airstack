import {
  createContextStore,
  createCredentials,
  decode,
  IRPC_BASE_CONTEXT,
  IRPC_FILE_STATUS,
  IRPC_STORE,
  type IRPCCredentials,
  type IRPCData,
  type IRPCFilePointer,
  type IRPCPackage,
  type IRPCRequest,
  IRPCResolver,
  IRPCRouter,
  IRPCStream,
  IRPCTransport,
  setScope,
  withContext,
} from '@irpclib/irpc';
import { FILE_BUFFER_TTL, WS_MESSAGE_TYPE } from './enum.js';
import { decodeFileFrame } from './frame.js';
import type { WebSocketTransport } from './transport.js';

/**
 * Default resolver function that creates an IRPCResolver instance
 * @param req - The incoming IRPC request
 * @param module - The IRPC package module
 * @returns A new IRPCResolver instance
 */
const defaultResolver = (req: IRPCRequest, module?: IRPCPackage) => {
  return new IRPCResolver(req, module);
};

export type WebSocketResolveConfig = {
  /** The WebSocket endpoint for connections */
  endpoint: string;
  /** Custom resolver function to handle requests */
  resolver: typeof defaultResolver;
  /** TTL in ms for buffered binary data before auto-cleanup. Defaults to 30s. */
  fileBufferTTL: number;
};

/**
 * WebSocket router that handles IRPC requests over WebSocket transport
 */
export class WebSocketRouter extends IRPCRouter {
  /** Configuration for WebSocket resolver */
  public config: WebSocketResolveConfig;
  /** AbortControllers for active stream requests */
  private abortControllers = new Map<string, { controller: AbortController; ws?: WebSocket }>();
  /** Buffered binary data waiting for JSON requests, keyed by file pointer ID */
  private fileBuffer = new Map<string, Uint8Array>();

  /**
   * Gets the WebSocket endpoint for connections
   * Returns the configured endpoint from transport
   */
  public get endpoint(): string {
    return this.config.endpoint;
  }

  public get module() {
    return this.transport.packages.values().next().value;
  }

  /**
   * Creates a new WebSocket router with the specified transport and configuration.
   *
   * @param transport - The WebSocketTransport instance to use.
   * @param config - The configuration options for the WebSocket resolver.
   */
  constructor(transport: WebSocketTransport, config?: Partial<WebSocketResolveConfig>);

  /**
   * @deprecated Only for backwards compatibility.
   * Creates a new WebSocket router with the specified module, transport, and configuration.
   *
   * @param module - The IRPC package module.
   * @param transport - The WebSocketTransport instance to use.
   * @param config - The configuration options for the WebSocket resolver.
   */
  constructor(module: IRPCPackage, transport: WebSocketTransport, config?: Partial<WebSocketResolveConfig>);

  constructor(
    module: IRPCPackage | WebSocketTransport,
    transport: WebSocketTransport | Partial<WebSocketResolveConfig> = {},
    config: Partial<WebSocketResolveConfig> = {}
  ) {
    if (module instanceof IRPCTransport) {
      super(module);
      config = transport;
    } else {
      super(module, transport as IRPCTransport);
    }

    this.config = {
      endpoint: (this.transport as WebSocketTransport).endpoint,
      resolver: defaultResolver,
      fileBufferTTL: FILE_BUFFER_TTL,
      ...config,
    };
  }

  /**
   * Resolves incoming WebSocket messages
   * @param message - The incoming WebSocket message
   * @param ws - The WebSocket connection instance
   * @param initContext - Optional initial context entries to inject
   * @param initScope - Optional initial scope entries to inject
   * @returns void (responses are sent via WebSocket)
   */
  public async resolve(
    message: string | ArrayBuffer,
    ws: WebSocket,
    initContext: [string | symbol, unknown][] = [],
    initScope: [string | symbol, unknown][] = []
  ): Promise<void> {
    if (message instanceof ArrayBuffer) {
      const frame = decodeFileFrame(message);
      this.fileBuffer.set(frame.id, frame.data);
      setTimeout(() => this.fileBuffer.delete(frame.id), this.config.fileBufferTTL);
      return;
    }

    const parsed = this.parseMessage(message);

    if (!parsed) return;

    // Handle cancel
    const req = parsed.call as IRPCRequest & { type?: string; files?: IRPCFilePointer[] };

    if (req.type === (WS_MESSAGE_TYPE.CANCEL as never)) {
      const entry = this.abortControllers.get(req.id);
      if (entry) entry.controller.abort();
      this.abortControllers.delete(req.id);
      return;
    }

    // Decode files if present
    if (req.files?.length) {
      const stream = decode({ data: req.args as IRPCData, files: req.files });

      for (const [id, file] of stream.files) {
        const buffered = this.fileBuffer.get(id);

        if (buffered) {
          file.data = new Blob([buffered] as [BlobPart], { type: file.meta.type });
          file.status = IRPC_FILE_STATUS.SUCCESS;
          this.fileBuffer.delete(id);
        }
      }

      req.args = stream.data as unknown[];
      delete req.files;
    }

    /* istanbul ignore next - Transport always sends credentials, ?? is defensive only */
    const credStore = createCredentials(parsed.credentials ?? []);
    const resolver = this.config.resolver(req, this.packageOf(req));
    const abortController = new AbortController();
    const ctx = createContextStore<string | symbol, unknown>([
      [IRPC_BASE_CONTEXT.ABORT_SIGNAL, abortController.signal],
      [IRPC_BASE_CONTEXT.ABORT_CONTROLLER, abortController],
      [IRPC_BASE_CONTEXT.CREDENTIALS, credStore],
      ...initContext,
    ]);

    this.abortControllers.set(resolver.req.id, { controller: abortController, ws });

    await withContext(ctx, async () => {
      for (const [key, value] of initScope) {
        setScope(key, value);
      }
      const error = await this.resolveHooks(resolver.req);

      if (error) {
        this.abortControllers.delete(resolver.req.id);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(error));
        }
        return;
      }

      const stream = new IRPCStream(resolver.req.id, resolver.req.name, () => resolver.resolve(), resolver.spec, this);

      stream.pipe((packet) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(packet));
        }
      });

      let ttlTimer: ReturnType<typeof setTimeout>;

      if (resolver.spec?.ttl) {
        ttlTimer = setTimeout(() => {
          abortController.abort();
        }, resolver.spec.ttl);
      }

      await new Promise<void>((resolve) => {
        stream.close(() => {
          clearTimeout(ttlTimer);
          this.abortControllers.delete(resolver.req.id);
          resolve();
        });
      });
    });
  }

  /**
   * Aborts all active stream controllers.
   * Call this on WebSocket disconnect to clean up all active streams.
   * @param ws - Optional WebSocket instance to clean up specific streams.
   */
  public disconnect(ws?: WebSocket) {
    if (ws) {
      this.abortControllers.forEach((entry, id) => {
        if (entry.ws === ws) {
          entry.controller.abort();
          this.abortControllers.delete(id);
        }
      });
    } else {
      this.abortControllers.forEach((entry) => entry.controller.abort());
      this.abortControllers.clear();
      this.fileBuffer.clear();
    }
  }

  /**
   * Parses incoming WebSocket message.
   * Returns the call and credentials, or undefined if parsing fails.
   * @param message - The incoming WebSocket message string
   * @returns The parsed call and credentials, or undefined on error
   */
  private parseMessage(message: string): { call: IRPCRequest; credentials?: IRPCCredentials } | undefined {
    try {
      const parsed = JSON.parse(message);

      // { call, credentials } format
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.call) {
        return parsed;
      }

      return undefined;
    } catch (error) {
      IRPC_STORE.error(new Error('Failed to parse WebSocket message:', { cause: error }), [
        { endpoint: this.endpoint },
      ]);
      return undefined;
    }
  }
}
