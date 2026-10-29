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

// biome-ignore lint/suspicious/noExplicitAny: a room's commands take and return whatever their room defines
export type RoomCommands = Record<string, (...args: any[]) => unknown>;

/** What a room's `create` is given: `hold` keeps the room open until a task is done. */
export interface RoomSetup {
  /** Keeps the room open until the task settles, even after its last member left. */
  hold<T>(task: Promise<T>): Promise<T>;
}

/** What a room holds: its shared live data, the commands its members run, and what to do when it closes. */
export interface RoomInit<D, C extends RoomCommands> {
  data: D;
  commands?: C;
  /** Runs once the room closes: no member left and no task held. */
  close?: () => void;
}

/** A call's place in a room: the room's own data, its commands, and leaving. */
export interface RoomMember<D, C extends RoomCommands> {
  /** The room's data itself, the same object for every member: set it as a stream's data to share it. */
  data: D;
  /** Runs one of the room's commands. */
  ask<K extends keyof C>(name: K, ...args: Parameters<C[K]>): ReturnType<C[K]>;
  /** Leaves the room; the room closes with its last member, once no task is held. */
  leave(): void;
}

/** A room kept by the store, and who is in it. */
type Room = { init: RoomInit<unknown, RoomCommands>; members: number; tasks: Set<Promise<unknown>> };

/**
 * Where the live calls of a session hear about each other. A realtime call joins a topic of its
 * session, such as `fs.write`, for as long as it is open; anything that changes what those calls
 * show broadcasts to that topic. A room goes further: one live object a session shares, created by
 * whichever call comes first and served in one place for every call. One store serves every
 * session, each kept apart by its ID, which every call reads from its own context, so calls of one
 * session reach each other whichever tab, device or transport they come from.
 */
export class SessionStore {
  #key: string | symbol | undefined;
  #sessions = new Map<string, Map<SessionTopic, Set<{ listener: SessionListener }>>>();
  #rooms = new Map<string, Map<SessionTopic, Room>>();

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

  /**
   * Joins the current call's session's room for a topic, creating it first if there is none. Only
   * the first call creates it; every call, the first included, gets the same room: the same data
   * and the same commands, served in one place. The room stays open while it has members or holds
   * a task, so a task outlives the call that started it.
   *
   * @param topic - Which room, e.g. `desktop.chat`.
   * @param create - Builds the room: its data, commands and close; run only when there is no room.
   * @returns The membership: the room's data, its commands, and leaving.
   */
  public room<D, C extends RoomCommands = RoomCommands>(
    topic: SessionTopic,
    create: (setup: RoomSetup) => RoomInit<D, C>
  ): RoomMember<D, C> {
    const id = this.#id();
    const rooms = this.#rooms.get(id) ?? new Map<SessionTopic, Room>();
    let room = rooms.get(topic);

    if (!room) {
      // Created before it is kept, so a create that throws leaves no half-made room behind.
      const tasks = new Set<Promise<unknown>>();
      const created: Room = { init: undefined as never, members: 0, tasks };
      created.init = create({
        hold: (task) => {
          tasks.add(task);
          const release = () => {
            tasks.delete(task);
            this.#closeIfIdle(id, topic, created);
          };
          task.then(release, release);
          return task;
        },
      }) as RoomInit<unknown, RoomCommands>;
      room = created;
      rooms.set(topic, room);
      this.#rooms.set(id, rooms);
    }

    const joined = room;
    joined.members += 1;
    let left = false;

    return {
      data: joined.init.data as D,
      ask: (name, ...args) => {
        if (left) throw new Error('Not in the room any more');
        const command = joined.init.commands?.[name as string];
        if (!command) throw new Error(`The room has no command "${String(name)}"`);
        return command(...args) as never;
      },
      leave: () => {
        if (left) return;
        left = true;
        joined.members -= 1;
        this.#closeIfIdle(id, topic, joined);
      },
    };
  }

  /** Closes a room with no member left and no task held, so the next call creates it afresh. */
  #closeIfIdle(id: string, topic: SessionTopic, room: Room) {
    if (room.members > 0 || room.tasks.size > 0) return;
    const rooms = this.#rooms.get(id);
    if (rooms?.get(topic) !== room) return;
    rooms.delete(topic);
    if (!rooms.size) this.#rooms.delete(id);
    try {
      room.init.close?.();
    } catch (error) {
      IRPC_STORE.error(error as Error, [{ session: id, topic }]);
    }
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
