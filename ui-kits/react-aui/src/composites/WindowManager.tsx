import { $bind, type AnyType, For, mutable, Show, Snippet, setup } from '@airlib/react';
import { superList } from '@airlib/react/common';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import type { ComponentType, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import { Window, type WindowProps, type WindowVariant } from './Window.js';

/**
 * Geometry and state of one open window. Every field is live: write to it to
 * move, resize, minimize, or maximize the window.
 */
export type WindowState = {
  open: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
};

/**
 * One open copy of a defined window.
 */
export type WindowInstance<D = AnyType> = {
  /** Unique id; also the window element's id. */
  readonly id: string;
  /** The definition this copy was opened from. */
  readonly app: WindowApp<D>;
  /** The data it was opened with. */
  readonly data: D;
  /** Live geometry and state. */
  readonly state: WindowState;
  /** Brings it to the front (restoring it if minimized) and focuses it. */
  focus(): void;
  close(): void;
  minimize(): void;
  toggleMaximized(): void;
};

/**
 * What a window's content receives.
 */
export type WindowContentProps<D = AnyType> = {
  instance: WindowInstance<D>;
};

/**
 * A window you define once and open as often as you need.
 */
export type WindowDefinition<D = AnyType> = {
  /** Stable name; keys remembered geometry. */
  name: string;
  /** Title bar text; a function to derive it from the open data. */
  title: string | ((data: D) => string);
  /** The app's name in launchers like the dock. Defaults to `title` when it is text, else `name`. */
  label?: string;
  /** The app's icon in launchers like the dock. Without it, the first letter of its label shows. */
  icon?: ReactNode;
  /** The window's content. */
  content: ComponentType<WindowContentProps<D>>;
  /** Allow several copies at once. With false, opening again focuses the open one. */
  multiple?: boolean;
  /** Starting size (and position) for a fresh window. */
  rect?: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>;
  /** Keep position, size, and maximized state between visits, in this browser. */
  remember?: boolean;
  /** Window behavior and look passed through to every copy: limits, grid, snap, size, color… */
  window?: Omit<
    WindowProps,
    'title' | 'children' | 'open' | 'x' | 'y' | 'width' | 'height' | 'minimized' | 'maximized'
  >;
};

/**
 * A defined window: open copies of it, find them, and put them away.
 */
export type WindowApp<D = AnyType> = WindowDefinition<D> & {
  /** Open copies, oldest first. */
  readonly instances: WindowInstance<D>[];
  /** Opens a copy with data, or focuses the open one when `multiple` is off. */
  open(data?: D): WindowInstance<D>;
  /** Closes every copy. */
  closeAll(): void;
};

/**
 * How `arrange` lays windows out.
 */
export type ArrangeMode = 'cascade' | 'tile' | 'stack';

const DEFAULT_SIZE = { width: 480, height: 320 };
const CASCADE = 32;

let counter = 0;

/**
 * Every open window, across all definitions, oldest first.
 */
export const openWindows: WindowInstance[] = mutable<WindowInstance[]>([]);

/** Managed window ids back to front, mirroring the desktop stack through each window's raise event. */
const stackOrder: string[] = mutable<string[]>([]);

/** True after the desktop was pressed: no managed window is in front until one is raised again. */
const focusState = mutable({ released: false });

/**
 * Render slots reserved up front. More open windows still work — the list
 * grows — but growing rebuilds every slot once, so the pool covers what a
 * busy desktop keeps open.
 */
const MAX_WINDOWS = 64;

/**
 * Fixed render slots for `WindowHost`. Each window keeps its own slot, so
 * opening or closing one never re-renders or re-mounts the others.
 */
const windowSlots = superList<WindowInstance>([], { size: MAX_WINDOWS });

/**
 * Defines a window once so any part of the app can open it with data. Open
 * copies render wherever a `WindowHost` is mounted.
 *
 * @param definition - Name, title, content, and behavior of the window.
 * @returns The window app, used to open and close copies.
 */
export function defineWindow<D = AnyType>(definition: WindowDefinition<D>): WindowApp<D> {
  const app = createApp(definition);
  windowApps.push(app as WindowApp);
  return app;
}

/**
 * Every defined window app, in definition order — what launchers list.
 */
export const windowApps: WindowApp[] = [];

/**
 * The name an app goes by in launchers.
 *
 * @param app - The window app.
 * @returns Its `label`, else its title when that is text, else its `name`.
 */
export function appLabel(app: WindowApp): string {
  return app.label ?? (typeof app.title === 'string' ? app.title : app.name);
}

/**
 * Whether a window is the active one on its desktop.
 *
 * @param instance - The window to check.
 * @returns True when it is in front, showing, and the desktop has not released it.
 */
export function isFrontWindow(instance: WindowInstance): boolean {
  return isFront(instance);
}

/**
 * Brings an app forward the way a dock icon does: opens it when nothing is
 * open, brings back its latest window when another app is in front, puts its
 * window away when it is already in front, and cycles through its windows
 * when it has several.
 *
 * @param app - The app whose icon was pressed.
 */
export function focusApp(app: WindowApp): void {
  const windows = app.instances;
  if (!windows.length) {
    app.open();
    return;
  }

  const front = windows.find(isFront);
  if (front) {
    if (windows.length === 1) front.minimize();
    else windows[(windows.indexOf(front) + 1) % windows.length].focus();
    return;
  }

  for (let i = stackOrder.length - 1; i >= 0; i--) {
    const latest = windows.find((instance) => instance.id === stackOrder[i]);
    if (latest) {
      latest.focus();
      return;
    }
  }
  windows[windows.length - 1].focus();
}

function createApp<D>(definition: WindowDefinition<D>): WindowApp<D> {
  const app = {
    ...definition,
    get instances() {
      return openWindows.filter((instance) => instance.app.name === definition.name) as WindowInstance<D>[];
    },
    open(data?: D) {
      const existing = app.instances[0];
      if (!definition.multiple && existing) {
        existing.focus();
        return existing;
      }
      return spawn(app as WindowApp<D>, data as D);
    },
    closeAll() {
      for (const instance of app.instances) instance.close();
    },
  } as WindowApp<D>;

  return app;
}

/**
 * Lays out the open, non-minimized windows inside an area.
 *
 * @param mode - `cascade` offsets each window from the last, `tile` splits the area into a grid, `stack` piles them in the center.
 * @param area - The element windows are laid out in (usually the `Desktop`). Defaults to the viewport.
 * @param windows - Which windows to arrange. Defaults to every open one.
 */
export function arrangeWindows(mode: ArrangeMode = 'cascade', area?: HTMLElement | null, windows = openWindows): void {
  const list = windows.filter((instance) => instance.state.open && !instance.state.minimized);
  if (!list.length) return;

  const areaWidth = area?.clientWidth ?? window.innerWidth;
  const areaHeight = area?.clientHeight ?? window.innerHeight;

  list.forEach((instance, index) => {
    const state = instance.state;
    state.maximized = false;

    if (mode === 'tile') {
      const cols = Math.ceil(Math.sqrt(list.length));
      const rows = Math.ceil(list.length / cols);
      const width = Math.floor(areaWidth / cols);
      const height = Math.floor(areaHeight / rows);
      Object.assign(state, { x: (index % cols) * width, y: Math.floor(index / cols) * height, width, height });
    } else if (mode === 'stack') {
      Object.assign(state, {
        x: Math.max(0, (areaWidth - state.width) / 2 + index * 4),
        y: Math.max(0, (areaHeight - state.height) / 2 + index * 4),
      });
    } else {
      Object.assign(state, {
        x: Math.min(index * CASCADE, Math.max(0, areaWidth - state.width)),
        y: Math.min(index * CASCADE, Math.max(0, areaHeight - state.height)),
      });
    }

    instance.focus();
  });
}

export type WindowHostProps = Omit<ComponentStyles, 'variant'> & {
  /** Surface for every window this host renders, unless its definition sets one. */
  variant?: WindowVariant;
  /** Names the close button of every window. Without it, windows have no close button. */
  closeLabel?: string;
  /** Names the minimize button of every window. */
  minimizeLabel?: string;
  /** Names the maximize button of every window. */
  maximizeLabel?: string;
  /** Names the maximize button while a window is maximized. */
  restoreLabel?: string;
  /** Which definitions this host renders. Defaults to all. */
  apps?: WindowApp[];
};

/**
 * Renders every open window. Mount it once, usually inside a `Desktop`.
 * Window buttons appear for each label you give.
 *
 * Each window lives in its own fixed slot, so opening or closing one window
 * re-renders that slot alone — the windows already open are never touched.
 */
export const WindowHost = setup<WindowHostProps>((props) => {
  const shown = (row: { value?: WindowInstance; visible: boolean }) =>
    row.visible && row.value && hosts(props.apps, row.value) ? row.value : undefined;

  return () => (
    <For each={() => windowSlots.values}>
      {(row) => <Show when={() => shown(row)}>{(instance) => renderWindow(instance, props)}</Show>}
    </For>
  );
}, 'WindowHost');

function renderWindow(instance: WindowInstance, host: WindowHostProps): ReactNode {
  const { app, state } = instance;
  const Content = app.content;
  const title = typeof app.title === 'function' ? app.title(instance.data) : app.title;

  // Keyed by instance: a reused slot mounts a fresh window instead of rebinding the old one.
  return (
    <Window
      key={instance.id}
      {...app.window}
      id={instance.id}
      title={title}
      size={app.window?.size ?? host.size}
      color={app.window?.color ?? host.color}
      variant={app.window?.variant ?? host.variant}
      closeLabel={host.closeLabel}
      minimizeLabel={host.minimizeLabel}
      maximizeLabel={host.maximizeLabel}
      restoreLabel={host.restoreLabel}
      open={$bind(state, 'open')}
      x={$bind(state, 'x')}
      y={$bind(state, 'y')}
      width={$bind(state, 'width')}
      height={$bind(state, 'height')}
      minimized={$bind(state, 'minimized')}
      maximized={$bind(state, 'maximized')}
      onraise={() => toFront(instance.id)}
      onrelease={() => (focusState.released = true)}
      onclose={() => release(instance)}
      onmove={() => remember(instance)}
      onresize={() => remember(instance)}
      onmaximize={() => remember(instance)}
    >
      <Content instance={instance} />
    </Window>
  );
}

export type WindowTaskbarProps = ComponentStyles & {
  /** Names the taskbar for screen readers, e.g. "Open windows". */
  label?: string;
  /** Which definitions to list. Defaults to all. */
  apps?: WindowApp[];
  /** Replaces each entry's content (an icon plus title). */
  children?: (instance: WindowInstance) => ReactNode;
};

register('windowTaskbar', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/**
 * One button per open window. Pressing a window's button brings it to the
 * front, puts it away when it is already in front, and brings it back when
 * it is minimized. The pressed state marks the window in front.
 */
export const WindowTaskbar = setup<WindowTaskbarProps>((props) => {
  const visible = () =>
    props.apps ? openWindows.filter((instance) => hosts(props.apps, instance)) : openWindows;
  const className = () =>
    $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], props, auiConfig.windowTaskbar);

  return () => (
    <div role="group" aria-label={props.label} className="aui-window-taskbar">
      <For each={visible}>
        {(instance) => (
          <Snippet>
            {() => (
              <button
                type="button"
                className={className()}
                aria-pressed={isFront(instance) ? 'true' : 'false'}
                data-minimized={instance.state.minimized ? 'true' : undefined}
                onClick={() => (isFront(instance) ? instance.minimize() : instance.focus())}
              >
                {props.children
                  ? props.children(instance)
                  : typeof instance.app.title === 'function'
                    ? instance.app.title(instance.data)
                    : instance.app.title}
              </button>
            )}
          </Snippet>
        )}
      </For>
    </div>
  );
}, 'WindowTaskbar');

function spawn<D>(app: WindowApp<D>, data: D): WindowInstance<D> {
  const id = `window-${app.name}-${++counter}`;
  const saved = app.remember ? load(app.name) : undefined;
  const offset = (openWindows.length % 8) * CASCADE + CASCADE;

  const state = mutable<WindowState>({
    open: true,
    x: saved?.x ?? app.rect?.x ?? offset,
    y: saved?.y ?? app.rect?.y ?? offset,
    width: saved?.width ?? app.rect?.width ?? DEFAULT_SIZE.width,
    height: saved?.height ?? app.rect?.height ?? DEFAULT_SIZE.height,
    minimized: false,
    maximized: saved?.maximized ?? false,
  });

  const element = () => document.getElementById(id);

  const instance: WindowInstance<D> = {
    id,
    app,
    data,
    state,
    focus() {
      state.minimized = false;
      // Focusing the window raises it to the front of its desktop. A window
      // opened a moment ago may not be mounted yet, so wait a few frames for it.
      const attempt = (frames: number) => {
        const target = element();
        if (target) target.focus();
        else if (frames > 0) requestAnimationFrame(() => attempt(frames - 1));
      };
      requestAnimationFrame(() => attempt(10));
    },
    close() {
      state.open = false;
      release(instance as WindowInstance);
    },
    minimize() {
      state.minimized = true;
    },
    toggleMaximized() {
      state.maximized = !state.maximized;
      remember(instance as WindowInstance);
    },
  };

  openWindows.push(instance as WindowInstance);
  occupySlot(instance as WindowInstance);
  toFront(id);
  instance.focus();
  return instance;
}

function release(instance: WindowInstance): void {
  remember(instance);
  // Matched by id: the reactive list holds wrapped copies, so identity checks against a raw instance miss.
  const index = openWindows.findIndex((entry) => entry.id === instance.id);
  if (index > -1) openWindows.splice(index, 1);
  const depth = stackOrder.indexOf(instance.id);
  if (depth > -1) stackOrder.splice(depth, 1);
  const slot = windowSlots.values.findIndex((row) => row.value?.id === instance.id);
  if (slot > -1) windowSlots.delete(slot);
}

function occupySlot(instance: WindowInstance): void {
  windowSlots.add([instance]);
}

/** Whether a host limited to `apps` renders this window; matched by name, since stored copies are wrapped. */
function hosts(apps: WindowApp[] | undefined, instance: WindowInstance): boolean {
  return !apps || apps.some((app) => app.name === instance.app.name);
}

function toFront(id: string): void {
  focusState.released = false;
  const depth = stackOrder.indexOf(id);
  if (depth > -1) stackOrder.splice(depth, 1);
  stackOrder.push(id);
}

/** Whether the window is the front-most one still showing — the same rule the desktop uses. */
function isFront(instance: WindowInstance): boolean {
  if (focusState.released) return false;
  for (let i = stackOrder.length - 1; i >= 0; i--) {
    const candidate = openWindows.find((entry) => entry.id === stackOrder[i]);
    if (candidate?.state.open && !candidate.state.minimized) return candidate.id === instance.id;
  }
  return false;
}

type Saved = Pick<WindowState, 'x' | 'y' | 'width' | 'height' | 'maximized'>;

function remember(instance: WindowInstance): void {
  if (!instance.app.remember) return;
  const { x, y, width, height, maximized } = instance.state;
  try {
    localStorage.setItem(storageKey(instance.app.name), JSON.stringify({ x, y, width, height, maximized }));
  } catch {
    // Storage can be blocked (private mode); the window just won't remember.
  }
}

function load(name: string): Saved | undefined {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? (JSON.parse(raw) as Saved) : undefined;
  } catch {
    return undefined;
  }
}

function storageKey(name: string): string {
  return `aui-window:${name}`;
}
