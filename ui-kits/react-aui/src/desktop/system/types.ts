import type { AnyType } from '@airlib/react';
import type { arrangeWindows, WindowApp, WindowInstance } from '../window/registry.js';

/**
 * Functions a window makes reachable: what its view's buttons call, what the agent runs at
 * `activeWindow.tools.*`, and what the agent's widgets bind their actions to — one function each.
 */
export type AUITools = Record<string, (...args: AnyType[]) => unknown>;

/**
 * What an app hands the system along with a view: the data the window shows and the tools it makes
 * reachable. Both stay reachable as the window lives, at `window[id]` and `activeWindow`.
 */
export interface AUIOpenOptions<D = AnyType, T extends AUITools = AUITools> {
  data?: D;
  tools?: T;
}

/**
 * An open window as the system holds it: the copy on the desktop, its data, and its tools.
 */
export interface AUIWindow<D = AnyType, T extends AUITools = AUITools> extends WindowInstance<D> {
  readonly tools: T;
}

/**
 * The system's side of an app: what the app asks the system for. Given to the app when it boots.
 */
export interface AUIAppContext {
  /**
   * Asks the system to open a view on the desktop with this data, and to make these tools reachable.
   *
   * @param view - The view to open.
   * @param options - The data it shows and the tools it makes reachable.
   * @returns The open window.
   */
  open<D, T extends AUITools>(view: WindowApp<D>, options?: AUIOpenOptions<D, T>): AUIWindow<D, T>;
}

/**
 * What an app says about itself, shipped with its package: who it is, how launchers show it, and
 * what it asks to reach.
 */
export interface AUIManifest {
  /** Stable name; keys the app's windows and what they remember. */
  name: string;
  /** The app's name in launchers. */
  label: string;
  version: string;
  description?: string;
  /** The app's picture in launchers. */
  icon?: string;
  /** Where its entry is, for an app whose code is fetched on launch. */
  main?: string;
  /** What the app asks to reach; granted on install. */
  permissions?: string[];
}

/**
 * An installed app as launchers see it: its manifest, and its entry to boot it with — imported
 * up front for an app on the desktop, or fetched on first launch for one from elsewhere.
 */
export interface AUIAppEntry {
  manifest: AUIManifest;
  main: AUIBoot;
}

/**
 * What an app gives back once it has booted, for the system to end it with.
 */
export interface AUIHandle {
  /** Releases what the app holds; the system calls it before closing the app's window. */
  dispose?(): void | Promise<void>;
}

/**
 * A running app, owned by the system. With a window it shows in the taskbar; without one it runs in
 * the background.
 */
export interface AUIProcess {
  /** Unique per run. */
  readonly id: string;
  /** The app it runs, by its manifest's name. */
  readonly name: string;
  /** What the app gave back when it booted, if anything. */
  readonly handle?: AUIHandle;
  /** Its window while one is open. */
  readonly window?: AUIWindow;
  /** Ends the run: disposes the app, then closes its window. */
  kill(): Promise<void>;
}

/**
 * Starts an app: an app's entry, called by the system when the app launches.
 *
 * @param context - The system's side of the app.
 * @param env - Values the system hands this run.
 * @returns The handle the system ends the app with, now or once booted; nothing when the app has nothing to release.
 */
export type AUIBoot = (
  context: AUIAppContext,
  env?: Record<string, string>
) => Promise<AUIHandle | void> | AUIHandle | void;

/**
 * Everything the user, the system, and the agent read and act on, as one tree addressed by path.
 */
export interface AUISystemState {
  /** Every system object: the installed apps, settings, the dock, the desktop. */
  readonly system: { apps?: AUIAppEntry[] } & Record<string, AnyType>;
  /** What the system does with windows. */
  readonly window: {
    arrangeWindows: typeof arrangeWindows;
  };
  /** The window the user is looking at: set when a window is focused, cleared when the desktop is pressed. */
  activeWindow?: WindowInstance;
  /** Every tool on the system to call by name — the system's and each app's isomorphic stubs. */
  readonly tools: AUITools;
  /**
   * Reads the value at a path through this tree, never throwing.
   *
   * @param path - Dot and bracket steps, e.g. `activeWindow.state.width`.
   * @returns The value, or undefined when the path doesn't reach one.
   */
  get(path: string): unknown;
}

/**
 * What the system starts with: top-level keys of its state, each replacing the system's own.
 */
export type AUISystemSeed = Partial<Omit<AUISystemState, 'get'>> & {
  /**
   * Lets later boots reseed the running system and get it back, as reloading code during
   * development does. Read from the first seed only; never on in production.
   */
  devMode?: boolean;
};

/**
 * One thing the agent does to the system: read or write a path, run a function at a path, or call
 * a tool by name.
 *
 * @example { type: 'set', key: 'system.settings.theme', value: 'dark' }
 * @example { type: 'run', key: 'activeWindow.tools.generate', args: [] }
 * @example { type: 'call', name: 'com.example.photos:generate', args: [] }
 */
export type AUIAction =
  | { type: 'get'; key: string }
  | { type: 'set'; key: string; value: unknown }
  | { type: 'run'; key: string; args?: unknown[] }
  | { type: 'call'; name: string; args?: unknown[] };
