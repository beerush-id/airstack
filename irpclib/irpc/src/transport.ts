import { onCleanup, uuid } from '@airlib/core';
import { IRPCCall } from './call.js';
import { IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import { TransportError } from './error.js';
import type { IRPCPackage } from './package.js';
import { IRPCReader } from './reader.js';
import { IRPC_STORE } from './store.js';
import type {
  IRPCCallConfig,
  IRPCCredentials,
  IRPCCredentialsFactory,
  IRPCData,
  IRPCInputs,
  IRPCOutput,
  IRPCPayload,
  IRPCSpec,
  TransportConfig,
} from './types.js';

export type IRPCPackageMap = Map<string, IRPCPackageVersionMap>;
export type IRPCPackageVersionMap = Map<string, IRPCPackage>;

/**
 * IRPCTransport is responsible for managing and dispatching RPC calls.
 * It handles queuing, debouncing, and timeout management for RPC requests.
 */
export class IRPCTransport {
  #credentialFactory?: IRPCCredentialsFactory;

  /** A set of packages registered with the transport. */
  public registry: IRPCPackageMap = new Map();
  public packages = new Set<IRPCPackage>();

  /**
   * A set of pending RPC calls that are queued for execution.
   */
  public queue = new Set<IRPCCall>();

  public get credentials(): IRPCCredentials {
    if (typeof this.#credentialFactory === 'function') {
      const cred = this.#credentialFactory();
      if (cred === null || Array.isArray(cred) || typeof cred !== 'object') return [];
      return Object.entries(cred);
    }

    return Object.entries(this.#credentialFactory ?? {});
  }

  /**
   * Creates a new IRPCTransport instance.
   * @param config - Optional transport configuration including timeout and debounce settings.
   */
  constructor(public config?: TransportConfig) {}

  /**
   * Initiates an RPC call with the given specification and arguments.
   * @param reader - The reader instance to attach to the RPC call.
   * @param spec - The RPC specification defining the method to call.
   * @param args - An array of arguments to pass to the RPC method.
   * @param config - Optional call configuration, including timeout, retry settings, and more.
   * @returns A promise that resolves with the RPC response data or rejects with an error.
   */
  public call(
    spec: IRPCSpec<IRPCInputs, IRPCOutput>,
    args: IRPCData[],
    config?: IRPCCallConfig,
    reader: IRPCReader<IRPCData> = new IRPCReader(uuid())
  ) {
    const payload: IRPCPayload = { name: spec.name, args, package: spec.package };
    const { timeout, maxRetries, retryMode, retryDelay } = { ...this.config, ...config };

    const call = new IRPCCall(this, payload, { timeout, maxRetries, retryMode, retryDelay }, reader, spec);
    const childCalls = new Set<IRPCCall>();

    reader.bindAsk(async (type, askArgs) => {
      const askPayload: IRPCPayload = {
        name: spec.name,
        args: [type, ...askArgs],
        package: spec.package,
        type: IRPC_PACKET_TYPE.ASK,
        callId: call.id,
      };
      const askCall = new IRPCCall(this, askPayload, { timeout, maxRetries, retryMode, retryDelay }, undefined, spec);
      childCalls.add(askCall);
      this.schedule(askCall);

      try {
        return await askCall.reader;
      } finally {
        childCalls.delete(askCall);
      }
    });

    reader.bindReply((queryId, data, error) => {
      const replyReader = new IRPCReader<IRPCData>(queryId);
      const replyPayload: IRPCPayload = {
        name: spec.name,
        args: [data, error as unknown as IRPCData],
        package: spec.package,
        type: IRPC_PACKET_TYPE.REPLY,
        callId: call.id,
      };
      const replyCall = new IRPCCall(
        this,
        replyPayload,
        { timeout, maxRetries, retryMode, retryDelay },
        replyReader,
        spec
      );
      childCalls.add(replyCall);
      this.schedule(replyCall);
      replyReader.finally(() => {
        childCalls.delete(replyCall);
      });
    });

    const cleanupChildren = () => {
      if (!childCalls.size) return;
      for (const child of Array.from(childCalls)) {
        this.queue.delete(child);
        child.reader.close();
      }
      childCalls.clear();
    };

    const prevOnClose = reader.onClose;
    reader.onClose = () => {
      cleanupChildren();
      prevOnClose?.();
    };
    reader.finally(cleanupChildren).catch(() => {});

    if (spec.stream || spec.standalone) {
      this.dispatch([call], spec.standalone)
        /* istanbul ignore next */
        .finally(() => {})
        .catch((err) => IRPC_STORE.error(err, [{ id: call.id, name: call.payload.name }]));
      return call.reader;
    } else {
      this.schedule(call);
    }

    onCleanup(() => this.close(call));

    return call.reader;
  }

  /**
   * Schedules an RPC call for execution, implementing debouncing logic.
   * Queued calls will be dispatched after the configured debounce delay.
   * @param call - The RPC call to schedule.
   */
  public schedule(call: IRPCCall) {
    const { debounce } = (this.config ?? {}) as TransportConfig;

    if (debounce === false) {
      this.dispatch([call])
        /* istanbul ignore next */
        .finally(() => {})
        .catch((err) => IRPC_STORE.error(err, [{ id: call.id, name: call.payload.name }]));
      return;
    }

    const timeout = typeof debounce === 'number' && !Number.isNaN(debounce) ? debounce : 0;

    const dispatch = () => {
      const pending = Array.from(this.queue);
      this.dispatch(pending);
      this.queue.clear();
    };

    if (!this.queue.size) {
      if (timeout === 0) {
        queueMicrotask(dispatch);
      } else {
        setTimeout(dispatch, timeout);
      }
    }

    this.queue.add(call);
  }

  /**
   * Signs an RPC call with credentials.
   * @param cred - The credentials to sign the call with.
   */
  public sign(cred: IRPCCredentialsFactory) {
    if (cred === null || Array.isArray(cred) || (typeof cred !== 'object' && typeof cred !== 'function')) return;
    this.#credentialFactory = cred;
  }

  /**
   * Closes an RPC call. This base implementation does nothing.
   * Subclasses should override this method to provide closing logic.
   * @param call - The RPC call to cancel.
   */
  public close(call: IRPCCall) {
    console.log('[irpc] Closing call', call);
  }

  /**
   * Registers an RPC package with the transport.
   * @param pkg - The package to register.
   * @returns The transport instance.
   */
  public register(pkg: IRPCPackage): this {
    if (!this.registry.has(pkg.config.name)) {
      this.registry.set(pkg.config.name, new Map());
    }

    const pkgMap = this.registry.get(pkg.config.name)!;
    pkgMap.set(pkg.config.version, pkg);
    this.packages.add(pkg);

    return this;
  }

  /**
   * Unregisters an RPC package from the transport.
   * @param pkg - The package to unregister.
   * @returns The transport instance.
   */
  public unregister(pkg: IRPCPackage): this {
    this.packages.delete(pkg);
    const pkgMap = this.registry.get(pkg.config.name);
    if (!pkgMap) return this;

    pkgMap.delete(pkg.config.version);
    if (!pkgMap.size) this.registry.delete(pkg.config.name);

    return this;
  }

  /**
   * Dispatches RPC calls over the transport. Subclasses must override this
   * to provide the actual transport mechanism (HTTP, WebSocket, etc.).
   *
   * When `standalone` is true, the call requires its own dedicated HTTP
   * round-trip with full response lifecycle (cookies, headers). This is
   * used for operations like authentication where `Set-Cookie` headers
   * must flow back to the client. Only one call is dispatched at a time
   * in standalone mode.
   *
   * When `standalone` is false or undefined, calls may be batched and
   * streamed together in a single request.
   *
   * @param calls - An array of RPC calls to dispatch.
   * @param standalone - When true, dispatch as a dedicated request with full HTTP lifecycle.
   * @returns A promise that resolves when all calls have been processed.
   */
  public async dispatch(calls: IRPCCall[], standalone?: boolean): Promise<void> {
    calls.forEach((call) => {
      call.enqueue({
        id: call.id,
        name: call.payload.name,
        type: IRPC_PACKET_TYPE.CLOSE,
        status: IRPC_STATUS.ERROR,
        error: TransportError.notImplemented().json(),
        createdAt: Date.now(),
      });
    });
  }
}
