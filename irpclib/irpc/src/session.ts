import { getContext } from './context.js';
import { IRPC_STORE } from './store.js';

/** Receives what was broadcast to the session. */
export type SessionListener<T = unknown> = (payload: T) => void;

/** A live call's place in its session: it hears broadcasts, and broadcasts to everyone else. */
export interface SessionMember<T = unknown> {
  /** Sends the payload to every other member of the session. */
  broadcast(payload: T): void;
  /** Leaves the session; the session is dropped with its last member. */
  leave(): void;
}

/**
 * Where the live calls of a session hear about each other. A realtime call joins its session for as
 * long as it is open; anything that changes what those calls show broadcasts to it. One store serves
 * every session, each kept apart by its ID, which every call reads from its own context, so calls of
 * one session reach each other whichever tab, device or transport they come from.
 */
export class SessionStore {
  #key: string | symbol | undefined;
  #sessions = new Map<string, Set<{ listener: SessionListener }>>();

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
   * Joins the current call's session until `leave`.
   *
   * @param listener - Receives what others broadcast to the session; never its own broadcasts.
   * @returns The membership: broadcast to the others, or leave.
   */
  public join<T = unknown>(listener: SessionListener<T>): SessionMember<T> {
    const id = this.#id();
    const members = this.#sessions.get(id) ?? new Set();
    this.#sessions.set(id, members);
    // One entry per join, so a listener joined twice is two members, each leaving on its own.
    const member = { listener: listener as SessionListener };
    members.add(member);

    return {
      broadcast: (payload) => this.#send(id, payload, member),
      leave: () => {
        members.delete(member);
        if (!members.size && this.#sessions.get(id) === members) this.#sessions.delete(id);
      },
    };
  }

  /**
   * Sends a payload to every member of the current call's session, for a change made outside its
   * live calls.
   *
   * @param payload - What changed.
   */
  public broadcast<T = unknown>(payload: T): void {
    this.#send(this.#id(), payload);
  }

  /** The current call's session ID; a call outside a session can neither join nor broadcast. */
  #id(): string {
    if (this.#key === undefined) throw new Error('Session store has no key: call SESSION_STORE.key() first');
    const id = getContext<string>(this.#key);
    if (!id) throw new Error('No session in the current context');
    return id;
  }

  /** Delivers to every member but the sender; a failing listener is reported and never stops the rest. */
  #send(id: string, payload: unknown, sender?: { listener: SessionListener }) {
    for (const member of [...(this.#sessions.get(id) ?? [])]) {
      if (member === sender) continue;
      try {
        member.listener(payload);
      } catch (error) {
        IRPC_STORE.error(error as Error, [{ session: id }]);
      }
    }
  }
}

/** The one store every session's live calls join. */
export const SESSION_STORE = new SessionStore();
