import { getContext } from './context.js';
import { IRPC_STORE } from './store.js';

/** What members of a session listen to: a name, or a symbol for a topic no one else can collide with. */
export type SessionTopic = string | symbol;

/** Receives what was broadcast to the session. */
export type SessionListener<T = unknown> = (payload: T) => void;

/** A live call's place in a topic of its session: it hears broadcasts, and broadcasts to everyone else. */
export interface SessionMember<T = unknown> {
  /** Sends the payload to every other member of the topic. */
  broadcast(payload: T): void;
  /** Leaves the topic; a topic is dropped with its last member, and a session with its last topic. */
  leave(): void;
}

/**
 * Where the live calls of a session hear about each other. A realtime call joins a topic of its
 * session, such as `fs.write`, for as long as it is open; anything that changes what those calls
 * show broadcasts to that topic. One store serves every session, each kept apart by its ID, which
 * every call reads from its own context, so calls of one session reach each other whichever tab,
 * device or transport they come from.
 */
export class SessionStore {
  #key: string | symbol | undefined;
  #sessions = new Map<string, Map<SessionTopic, Set<{ listener: SessionListener }>>>();

  /**
   * Sets the context key the session's ID is read from. Called once by the server entry, which
   * puts each call's session ID in its context under that key.
   *
   * @param contextKey - The context key holding the session ID.
   */
  public key(contextKey: string | symbol): void {
    this.#key = contextKey;
  }

  /**
   * Joins a topic of the current call's session until `leave`.
   *
   * @param topic - What the member listens to, e.g. `fs.write`.
   * @param listener - Receives what others broadcast to the topic; never its own broadcasts.
   * @returns The membership: broadcast to the topic's other members, or leave.
   */
  public join<T = unknown>(topic: SessionTopic, listener: SessionListener<T>): SessionMember<T> {
    const id = this.#id();
    const topics = this.#sessions.get(id) ?? new Map<SessionTopic, Set<{ listener: SessionListener }>>();
    const members = topics.get(topic) ?? new Set();
    this.#sessions.set(id, topics);
    topics.set(topic, members);
    // One entry per join, so a listener joined twice is two members, each leaving on its own.
    const member = { listener: listener as SessionListener };
    members.add(member);

    return {
      broadcast: (payload) => this.#send(id, topic, payload, member),
      leave: () => {
        members.delete(member);
        if (members.size || topics.get(topic) !== members) return;
        topics.delete(topic);
        if (!topics.size && this.#sessions.get(id) === topics) this.#sessions.delete(id);
      },
    };
  }

  /**
   * Sends a payload to every member of a topic in the current call's session, for a change made
   * outside its live calls.
   *
   * @param topic - What changed, e.g. `fs.write`.
   * @param payload - The change.
   */
  public broadcast<T = unknown>(topic: SessionTopic, payload: T): void {
    this.#send(this.#id(), topic, payload);
  }

  /** The current call's session ID; a call outside a session can neither join nor broadcast. */
  #id(): string {
    if (this.#key === undefined) throw new Error('Session store has no key: call SESSION_STORE.key() first');
    const id = getContext<string>(this.#key);
    if (!id) throw new Error('No session in the current context');
    return id;
  }

  /** Delivers to every member of the topic but the sender; a failing listener is reported and never stops the rest. */
  #send(id: string, topic: SessionTopic, payload: unknown, sender?: { listener: SessionListener }) {
    for (const member of [...(this.#sessions.get(id)?.get(topic) ?? [])]) {
      if (member === sender) continue;
      try {
        member.listener(payload);
      } catch (error) {
        IRPC_STORE.error(error as Error, [{ session: id, topic }]);
      }
    }
  }
}

/** The one store every session's live calls join. */
export const SESSION_STORE = new SessionStore();
