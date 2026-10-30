import { replay, type StateChange, uuid } from '@airlib/core';
import { IRPC_PACKET_TYPE, IRPC_STATUS } from './enum.js';
import { IRPCError } from './error.js';
import { RemoteState } from './state.js';
import type {
  IRPCData,
  IRPCPacketAnswer,
  IRPCPacketAsk,
  IRPCPacketClose,
  IRPCPacketError,
  IRPCPacketEvent,
  IRPCPacketReply,
  IRPCPacketStream,
  IRPCPacketType,
  IRPCQueryMap,
  IRPCStatus,
} from './types.js';

export type PacketListener<T extends IRPCData> = (packet: IRPCPacketStream<T>) => void;
export type IRPCReplyBridge = (queryId: string, data?: IRPCData, error?: IRPCPacketError) => void;

/**
 * A client-side consumer that hydrates `RemoteState` instances from network stream packets.
 *
 * @template T - The type of data yielded by the stream.
 * @template Q - The duplex query map type for bi-directional ask/answer operations.
 */
export class IRPCReader<T extends IRPCData, Q extends IRPCQueryMap = IRPCQueryMap> extends RemoteState<T, Q> {
  #packetListeners = new Set<PacketListener<T>>();
  #replyBridge?: IRPCReplyBridge;

  public onClose?: () => void;

  /**
   * Initializes a new RemoteState with an optional initial payload.
   *
   * @param id - The unique identifier for this state instance.
   * @param init - An optional starting value for the data payload.
   * @param status - The initial status of the state (PENDING, SUCCESS, ERROR).
   * @param resumable - Whether the state should be resumable after being closed.
   * @param controlled - Whether its owner closes it, rather than the lifecycle it's made in.
   */
  constructor(
    public id: string,
    init?: T,
    status: IRPCStatus = IRPC_STATUS.PENDING,
    resumable?: boolean,
    controlled?: boolean
  ) {
    super(init, status, resumable, controlled);
  }

  /**
   * Binds a callback to transmit duplex reply packets back to the server.
   *
   * @param bridge - The reply transmitter callback.
   */
  public bindReply(bridge: IRPCReplyBridge) {
    this.#replyBridge = bridge;
  }

  /**
   * Pushes incoming network packets into this reader, evaluating payload data
   * and subsequently updating the core state values locally.
   *
   * @param packet - The incoming unified Stream Packet structure (`ANSWER`, `EVENT`, `ASK`, `REPLY`, or `CLOSE`).
   */
  public push(packet: IRPCPacketStream<T>) {
    packet.arrivedAt = Date.now();

    if (packet.type === IRPC_PACKET_TYPE.ASK) {
      const askPacket = packet as IRPCPacketAsk;
      const { queryId, data } = askPacket;

      this.dispatchAnswer(data.type, data.args)
        .then((res) => {
          this.#replyBridge?.(queryId, res as IRPCData);
        })
        .catch((err) => {
          const serialized = IRPCError.from(err).json();
          this.#replyBridge?.(queryId, undefined, serialized);
        });
    } else if (packet.type === IRPC_PACKET_TYPE.ANSWER || packet.type === IRPC_PACKET_TYPE.REPLY) {
      if (packet.status === IRPC_STATUS.ERROR) {
        this.error = IRPCError.from((packet as IRPCPacketAnswer<T>).error!);
      } else {
        this.data = (packet as IRPCPacketAnswer<T>).data as T;
      }
    } else if (packet.type === IRPC_PACKET_TYPE.EVENT) {
      replay(this.state, (packet as IRPCPacketEvent).data as StateChange);
    } else if (packet.type === IRPC_PACKET_TYPE.CLOSE) {
      if ((packet as IRPCPacketClose).error) {
        this.error = IRPCError.from((packet as IRPCPacketClose).error!);
      }
    }

    this.status = packet.status;

    for (const listener of this.#packetListeners) {
      if (typeof listener === 'function') {
        listener(packet);
      }
    }
  }

  /**
   * Subscribe to incoming packets.
   *
   * @param handler - The handler function to be called when a packet is received.
   * @returns A function to unsubscribe from packet updates.
   */
  public packetSubscribe(handler: PacketListener<T>) {
    this.#packetListeners.add(handler);

    return () => {
      this.#packetListeners.delete(handler);
    };
  }

  /**
   * Checks if the packet is of a specific type.
   *
   * @param packet - The packet to check.
   * @param type - The type to check against.
   * @returns True if the packet is of the specified type, false otherwise.
   */
  public is<E>(packet: IRPCPacketStream<T>, type: E): packet is IRPCPacketAnswer<T>;
  public is<E>(packet: IRPCPacketStream<T>, type: E): packet is IRPCPacketEvent;
  public is<E>(packet: IRPCPacketStream<T>, type: E): packet is IRPCPacketClose;
  public is<E>(packet: IRPCPacketStream<T>, type: E): packet is IRPCPacketAsk;
  public is<E>(packet: IRPCPacketStream<T>, type: E): packet is IRPCPacketReply<T>;
  public is(packet: IRPCPacketStream<T>, type: IRPCPacketType) {
    return packet.type === type;
  }

  public resume() {
    this.id = uuid();
    super.resume();
  }

  public close() {
    this.status = IRPC_STATUS.SUCCESS;
    super.close();
    this.#packetListeners.clear();
    this.onClose?.();
  }

  /**
   * Ensures that chained Promise operations return standard Promises
   * rather than instantiating new RemoteState subclasses.
   */
  static get [Symbol.species]() {
    return Promise;
  }
}
