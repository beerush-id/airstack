import {
  CallError,
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
import { IRPC_JSON_KEY, IRPC_WEB_PATH } from './enum.js';

export const COOKIES_EVENT = 'anchor:cookie-sync';
export const DEFAULT_ORIGIN = 'http://localhost';
export const COOKIES_SYNC_KEY = 'x-anchor-set-cookie';
export const DEFAULT_ENDPOINT = '/irpc';

/**
 * Configuration interface for HTTP transport.
 * Extends the base TransportConfig with HTTP-specific options.
 */
export type HTTPTransportConfig = TransportConfig & {
  /**
   * The base URL for all HTTP requests.
   * Optional parameter that defines the root URL for API endpoints.
   */
  baseURL?: string;

  /**
   * The specific endpoint path for RPC calls.
   * Defaults to '/irpc' if not provided.
   */
  endpoint?: string;

  /**
   * Custom headers to be included in every HTTP request.
   * Allows setting authentication tokens, content types, etc.
   */
  headers?: Record<string, string>;

  /**
   * Additional options to be passed to the fetch request.
   * Allows configuring credentials, mode, cache, etc.
   */
  fetchOptions?: RequestInit;
};

/**
 * HTTP transport implementation for iRPC communication.
 * Handles sending RPC calls over HTTP and processing streaming responses.
 */
export class HTTPTransport extends IRPCTransport {
  private callControllers = new Map<IRPCCall, AbortController>();
  private abortControllers = new Map<AbortController, Set<IRPCCall>>();

  /**
   * Gets the endpoint path for RPC calls.
   * Returns the configured endpoint or defaults to '/irpc'.
   */
  public get endpoint() {
    return this.config.endpoint ?? DEFAULT_ENDPOINT;
  }

  public get webPath() {
    return `${this.endpoint}${IRPC_WEB_PATH}`;
  }

  /**
   * Constructs the full URL for HTTP requests.
   * Combines the baseURL and endpoint to create a complete URL.
   */
  public get url() {
    return this.createUrl();
  }

  /**
   * Creates a new HTTP transport instance.
   * @param config - The configuration for this transport instance.
   */
  constructor(public config: HTTPTransportConfig) {
    super(config);
  }

  private createUrl(web?: string) {
    const defaultUrl =
      typeof globalThis.location !== 'undefined' ? (globalThis.location.origin ?? DEFAULT_ORIGIN) : DEFAULT_ORIGIN;
    const endpoint = web ? `${this.webPath}/${web}` : this.endpoint;
    return new URL(endpoint, this.config.baseURL ?? defaultUrl);
  }

  private dequeue(call: IRPCCall, abort?: boolean) {
    const controller = this.callControllers.get(call);
    this.callControllers.delete(call);

    const queues = this.abortControllers.get(controller!);
    if (!controller || !queues) return;

    queues.delete(call);

    if (!queues.size) {
      if (abort && !controller.signal.aborted) {
        controller.abort();
      }

      this.abortControllers.delete(controller);
    }
  }

  /**
   * Dispatches RPC calls over HTTP.
   * Sends all pending calls in a single HTTP POST request.
   * @param calls - Array of RPC calls to dispatch.
   * @param standalone - When true, dispatches to the standalone web endpoint and reads a JSON response.
   */
  public async dispatch(calls: IRPCCall[], standalone?: boolean) {
    try {
      const form = new FormData();

      const requests = calls.map(({ id, payload: { name, package: pkg, args, type, callId } }) => {
        const packet = encode(args as IRPCData);

        for (const queue of packet.queues) {
          form.append(queue.file.id, queue.data, queue.file.meta.name);
        }

        return {
          id,
          name,
          package: pkg,
          args: packet.json.data,
          files: packet.json.files.length ? packet.json.files : undefined,
          type,
          callId,
        };
      });

      form.append(
        IRPC_JSON_KEY,
        JSON.stringify({
          calls: requests,
          credentials: this.credentials,
        })
      );

      const maxTimeout =
        calls.reduce((acc, req) => Math.max(acc, req.options?.timeout ?? 0), 0) || this.config?.timeout;

      const controller = new AbortController();
      const controllerSet = new Set<IRPCCall>();
      this.abortControllers.set(controller, controllerSet);

      calls.forEach((call) => {
        this.callControllers.set(call, controller);
        controllerSet.add(call);
      });

      let breaker: number | undefined;

      if (maxTimeout) {
        breaker = setTimeout(() => {
          controller.abort(CallError.timeout());
        }, maxTimeout) as never;
      }

      const url = standalone ? this.createUrl(calls[0].payload.name) : this.url;

      const init: RequestInit = {
        ...this.config.fetchOptions,
        method: 'POST',
        headers: {
          ...this.config.headers,
          ...this.config.fetchOptions?.headers,
        },
        body: form,
        signal: controller.signal,
      };

      const response = standalone ? await fetch(url, init) : await this.request(init, url);

      clearTimeout(breaker);
      if (typeof window !== 'undefined' && response?.headers?.has(COOKIES_SYNC_KEY)) {
        window.dispatchEvent(new CustomEvent(COOKIES_EVENT));
      }

      if (!response?.ok) {
        calls.forEach((call) => {
          this.dequeue(call);

          call.enqueue({
            id: call.id,
            name: call.payload.name,
            type: IRPC_PACKET_TYPE.CLOSE,
            status: IRPC_STATUS.ERROR,
            error: TransportError.failed(response?.statusText ?? 'Request failed.').json(),
            createdAt: Date.now(),
          } as IRPCPacketStream<IRPCData>);
        });
        return;
      }

      if (standalone) {
        const call = calls[0];
        const packet = await response.json();
        // biome-ignore lint/suspicious/noExplicitAny: Expect any.
        if (packet.data) packet.data = decodeBlobs(packet.data) as any;
        call.enqueue(packet);
        this.dequeue(call);
      } else {
        await this.resolveAll(calls, response);
      }
    } catch (error) {
      IRPC_STORE.error(
        error as Error,
        calls.map((c) => ({ id: c.id, name: c.payload.name }))
      );
      calls.forEach((call) => {
        this.dequeue(call);

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
   * Sends an HTTP request. Uses XHR in browsers to work around Chromium/WebKit
   * buffering fetch() POST streaming responses after page load.
   * Falls back to fetch() in non-browser environments (Workers, Deno).
   */
  private request(init: RequestInit, url: URL = this.url): Promise<Response> {
    if (typeof XMLHttpRequest === 'undefined') {
      return fetch(url, init);
    }

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url.toString());

      if (init.headers) {
        const headers = new Headers(init.headers as Record<string, string>);
        headers.forEach((v, k) => xhr.setRequestHeader(k, v));
      }

      const abort = () => xhr.abort();

      if (init.signal) {
        init.signal.addEventListener('abort', abort);
      }

      let lastIndex = 0;
      let ctrl: ReadableStreamDefaultController;

      const body = new ReadableStream({
        start(c) {
          ctrl = c;
        },
      });

      xhr.onprogress = () => {
        const chunk = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;
        if (chunk) ctrl.enqueue(chunk);
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          const raw = xhr.getAllResponseHeaders().trim();
          const headers = new Headers();
          for (const line of raw.split('\r\n')) {
            const i = line.indexOf(': ');
            if (i > 0) headers.append(line.substring(0, i), line.substring(i + 2));
          }
          resolve(new Response(body, { status: xhr.status, statusText: xhr.statusText, headers }));
        }
      };

      xhr.onload = () => {
        const chunk = xhr.responseText.substring(lastIndex);
        if (chunk) ctrl.enqueue(chunk);
        ctrl.close();
        init.signal?.removeEventListener('abort', abort);
      };

      xhr.onerror = () => {
        const err = TransportError.failed('Request failed.');
        ctrl.error(err);
        reject(err);
        init.signal?.removeEventListener('abort', abort);
      };

      xhr.onabort = () => {
        ctrl.close();
        init.signal?.removeEventListener('abort', abort);
      };

      xhr.send(init.body as FormData);
    });
  }

  public close(call: IRPCCall) {
    this.dequeue(call, true);
  }

  /**
   * Processes all responses from the HTTP response stream.
   * Reads the response body as a stream and resolves individual calls.
   * @param calls - Array of pending RPC calls.
   * @param response - The HTTP response object.
   */
  protected async resolveAll(calls: IRPCCall[], response: Response) {
    const reader = response.body?.getReader?.();
    const pendingCalls = new Map<string, IRPCCall>(calls.map((call) => [call.id, call]));

    if (!reader) {
      calls.forEach((call) => {
        this.dequeue(call);

        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: TransportError.invalidBody().json(),
          createdAt: Date.now(),
        } as IRPCPacketStream<IRPCData>);
      });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
          const parts = buffer.split('\n');

          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.trim()) continue;

            try {
              const packet: IRPCPacketStream<IRPCData> = JSON.parse(part);
              const call = pendingCalls.get(packet.id);

              if (call) {
                // biome-ignore lint/suspicious/noExplicitAny: Expect any.
                if ((packet as any).data) (packet as any).data = decodeBlobs((packet as any).data);
                call.enqueue(packet);

                if (packet.status !== IRPC_STATUS.PENDING) {
                  this.dequeue(call);
                  pendingCalls.delete(packet.id);
                }
              }
            } catch (error) {
              IRPC_STORE.error(new Error(`Unable to parse response chunk: ${part}`, { cause: error }), [
                { pending: Array.from(pendingCalls.keys()) },
              ]);
            }
          }
        }

        if (done) {
          if (buffer.trim()) {
            try {
              const packet: IRPCPacketStream<IRPCData> = JSON.parse(buffer);
              const call = pendingCalls.get(packet.id);

              if (call) {
                // biome-ignore lint/suspicious/noExplicitAny: Expect any.
                if ((packet as any).data) (packet as any).data = decodeBlobs((packet as any).data);
                call.enqueue(packet);
                pendingCalls.delete(packet.id);
                this.dequeue(call);
              }
            } catch (error) {
              IRPC_STORE.error(new Error(`Unable to parse final response chunk: ${buffer}`, { cause: error }), [
                { pending: Array.from(pendingCalls.keys()) },
              ]);
            }
          }
          break;
        }
      }
    } catch (error) {
      IRPC_STORE.error(new Error(`Unable to read response stream`, { cause: error }), [
        { pending: Array.from(pendingCalls.keys()) },
      ]);

      calls.forEach((call) => {
        if (call.resolved) return;
        this.dequeue(call);
        pendingCalls.delete(call.id);

        call.enqueue({
          id: call.id,
          name: call.payload.name,
          type: IRPC_PACKET_TYPE.CLOSE,
          status: IRPC_STATUS.ERROR,
          error: TransportError.streamTerminated().json(),
          createdAt: Date.now(),
        } as IRPCPacketStream<IRPCData>);
      });
    } finally {
      reader.releaseLock();
    }
  }
}
