import type { WindowProps as WindowAriaProps } from '@airlib/aria';
import { type AnyType, anchor, proxyProps, setup } from '@airlib/react';
import type { ComponentType, ReactNode } from 'react';
import { activateWindow, deactivateWindow, system } from '../system/system.js';
import type { AUITools } from '../system/types.js';
import type { WindowLayoutLabels, WindowProps, WindowVariant } from '../Window.js';
import { openWindows, stackOrder, windowApps, windowInstanceCtx } from './store.js';

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
  /** The sidebar's width in pixels; undefined until set or first resized, while the theme's width shows. */
  sidebarWidth?: number;
};

/**
 * How every copy of a window behaves: size limits, grid, snapping, dock
 * awareness, the sidebar's resize range. Its geometry and state live on each
 * copy instead.
 */
export type WindowBehavior = Pick<WindowProps, 'sidebarMinWidth' | 'sidebarMaxWidth'> & Omit<
  WindowAriaProps,
  | 'id'
  | 'label'
  | keyof WindowState
  | 'onmove'
  | 'onresize'
  | 'onclose'
  | 'onminimize'
  | 'onmaximize'
  | 'onrestore'
  | 'onraise'
  | 'onrelease'
>;

/**
 * One open copy of a defined window — the window itself. Its `state` is the
 * one source of truth the window's `<Window>` binds to: moving, resizing,
 * closing, or maximizing writes it, and writing it moves the window.
 */
export type WindowInstance<D = AnyType> = {
  /** Unique id; also the window element's id. */
  readonly id: string;
  /** The definition this copy was opened from. */
  readonly app: WindowApp<D>;
  /** The data it was opened with. */
  readonly data: D;
  /** Its title, from the definition and the data; names the window and its taskbar entry. */
  readonly title: string;
  /** Live geometry and state. */
  readonly state: WindowState;
  /** What the dock shows above its prompt while this window is in front; from the definition. */
  readonly dockExtensions?: ComponentType<WindowRenderProps<D>>;
  /** What it was opened with to call: its view's buttons and the agent reach the same functions here. */
  readonly tools: AUITools;
  /** Brings it to the front (restoring it if minimized) and focuses it. */
  focus(): void;
  close(): void;
  minimize(): void;
  toggleMaximized(): void;
};

/**
 * What a window's render function receives.
 */
export type WindowRenderProps<D = AnyType> = {
  instance: WindowInstance<D>;
};

/**
 * How a window draws itself: a setup function that runs once per open copy
 * — its local state lives here — and returns what to render, usually a
 * `<Window>` holding the content.
 */
export type WindowRender<D = AnyType> = (props: WindowRenderProps<D>) => () => ReactNode;

/**
 * A window you define once and open as often as you need.
 */
export type WindowDefinition<D = AnyType> = {
  /** Stable name; keys remembered geometry. */
  name: string;
  /** The window's title, in the taskbar and for screen readers; a function to derive it from the open data. */
  title: string | ((data: D) => string);
  /** The app's name in launchers like the dock. Defaults to `title` when it is text, else `name`. */
  label?: string;
  /** The app's picture in launchers like the dock. If it fails or is missing, `icon` or the label's initials show. */
  image?: string;
  /** The app's glyph in launchers like the dock, shown when there is no picture. Without it, the label's initials show. */
  icon?: ReactNode;
  /** Allow several copies at once. With false, opening again focuses the open one. */
  multiple?: boolean;
  /** Starting size (and position, and sidebar width) for a fresh window. */
  rect?: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height' | 'sidebarWidth'>>;
  /** Keep position, size, sidebar width, and maximized state between visits, in this browser. */
  remember?: boolean;
  /** How every copy behaves: size limits, grid, snapping. */
  window?: WindowBehavior;
  /**
   * Controls the dock shows above its prompt while a copy of this window is in front — what the
   * prompt should be sent with: a model, a size, a count. Drawn with the copy it serves, so it
   * reads and binds that copy's data; small controls only, in one row that wraps.
   */
  dockExtensions?: ComponentType<WindowRenderProps<D>>;
};

/**
 * A defined window: draw it, open copies of it, find them, and put them away.
 */
export type WindowApp<D = AnyType> = WindowDefinition<D> & {
  /** Open copies, oldest first. */
  readonly instances: WindowInstance<D>[];
  /** The component that draws each copy, once `render` has set it; it draws the copy it is placed in. */
  readonly view?: ComponentType;
  /** Sets how each copy draws itself. */
  render(render: WindowRender<D>): WindowApp<D>;
  /** Opens a copy with data and tools, or focuses the open one when `multiple` is off. */
  open(data?: D, tools?: AUITools): WindowInstance<D>;
  /** Closes every copy. */
  closeAll(): void;
};

/**
 * What a `WindowHost` lends every window it draws: the window buttons' names,
 * the layout popup, and the look. A window's own props win.
 */
export type WindowHostScope = {
  size?: string;
  color?: string;
  variant?: WindowVariant;
  closeLabel?: string;
  minimizeLabel?: string;
  maximizeLabel?: string;
  restoreLabel?: string;
  layouts?: WindowLayoutLabels;
  sidebarResizeLabel?: string;
};

/**
 * The open window the calling component is drawn inside, for parts deep in a
 * window that act on it — close it, rename it, read its data.
 *
 * @returns The window, or undefined outside any defined window.
 */
export function currentWindow<D = AnyType>(): WindowInstance<D> | undefined {
  return windowInstanceCtx.get() as WindowInstance<D> | undefined;
}

/**
 * How `arrangeWindows` lays windows out.
 */
export type ArrangeMode = 'cascade' | 'tile' | 'stack';

const DEFAULT_SIZE = { width: 480, height: 320 };
const CASCADE = 32;

let counter = 0;

/**
 * Defines a window once so any part of the app can open it with data. Give
 * it a `render` to say how each copy draws itself; open copies render
 * wherever a `WindowHost` is mounted.
 *
 * @param definition - Name, title, and behavior of the window.
 * @returns The window app, used to draw it and to open and close copies.
 */
export function defineWindow<D = AnyType>(definition: WindowDefinition<D>): WindowApp<D> {
  const app = createApp(definition);
  windowApps.push(app as WindowApp);
  return app;
}

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
 * Whether a window is the active one on its desktop: the last one focused, until the desktop itself
 * is pressed or the window goes away.
 *
 * @param instance - The window to check.
 * @returns True when it is the active window.
 */
export function isFrontWindow(instance: WindowInstance): boolean {
  return system.activeWindow?.id === instance.id;
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

  const front = windows.find(isFrontWindow);
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

/**
 * Lays out the open, non-minimized windows inside an area.
 *
 * @param mode - `cascade` offsets each window from the last, `tile` splits the area into a grid, `stack` piles them in the center.
 * @param area - The element windows are laid out in (usually the `Desktop`). Defaults to the viewport.
 * @param windows - Which windows to arrange. Defaults to every open one.
 */
export function arrangeWindows(
  mode: ArrangeMode = 'cascade',
  area?: HTMLElement | null,
  windows: Iterable<WindowInstance> = openWindows.values()
): void {
  const list = [...windows].filter((instance) => instance.state.open && !instance.state.minimized);
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

/**
 * Forgets a closed window: drops it from the open windows and the front
 * order, after saving its geometry when its app remembers.
 *
 * @param instance - The window that closed.
 */
function releaseWindow(instance: WindowInstance): void {
  deactivateWindow(instance);
  rememberWindow(instance);
  openWindows.delete(instance.id);
  const depth = stackOrder.indexOf(instance.id);
  if (depth > -1) stackOrder.splice(depth, 1);
}

/**
 * Saves a window's geometry when its app remembers, in this browser.
 *
 * @param instance - The window whose position, size, sidebar width, and maximized state to keep.
 */
function rememberWindow(instance: WindowInstance): void {
  if (!instance.app.remember) return;
  const { x, y, width, height, maximized, sidebarWidth } = instance.state;
  try {
    localStorage.setItem(
      storageKey(instance.app.name),
      JSON.stringify({ x, y, width, height, maximized, sidebarWidth })
    );
  } catch {
    // Storage can be blocked (private mode); the window just won't remember.
  }
}

function createApp<D>(definition: WindowDefinition<D>): WindowApp<D> {
  let view: ComponentType | undefined;

  const app = {
    remember: true,
    ...definition,
    get instances() {
      return [...openWindows.values()].filter((instance) => instance.app.name === definition.name) as WindowInstance<D>[];
    },
    get view() {
      return view;
    },
    render(render: WindowRender<D>) {
      // The copy is fixed for the view's life, so it comes from the window it draws, not from props.
      view = setup(
        () => render({ instance: windowInstanceCtx.get() as WindowInstance<D> }),
        definition.name
      ) as ComponentType;
      return app;
    },
    open(data?: D, tools: AUITools = {}) {
      const existing = app.instances[0];
      if (!definition.multiple && existing) {
        existing.focus();
        return existing;
      }
      return spawn(app as WindowApp<D>, data as D, tools);
    },
    closeAll() {
      for (const instance of app.instances) instance.close();
    },
  } as WindowApp<D>;

  return app;
}

function spawn<D>(app: WindowApp<D>, data: D, tools: AUITools): WindowInstance<D> {
  const id = `window-${app.name}-${++counter}`;
  const saved = app.remember ? fitToScreen(load(app.name)) : undefined;
  const offset = (openWindows.size % 8) * CASCADE + CASCADE;

  const title = typeof app.title === 'function' ? app.title(data) : app.title;

  // The state is what the window part binds to, as real component props: the definition's behavior,
  // then the copy's own geometry, then what the copy does when the window acts — so nothing outside
  // has to sync it. Shallow and without key traps, so spreading it never tracks the geometry.
  const stateRef = anchor<WindowState & WindowAriaProps & Pick<WindowProps, 'onsidebarresize'>>(
    {
      ...app.window,
      id,
      label: title,
      open: true,
      x: saved?.x ?? app.rect?.x ?? offset,
      y: saved?.y ?? app.rect?.y ?? offset,
      width: saved?.width ?? app.rect?.width ?? DEFAULT_SIZE.width,
      height: saved?.height ?? app.rect?.height ?? DEFAULT_SIZE.height,
      minimized: false,
      maximized: saved?.maximized ?? false,
      sidebarWidth: saved?.sidebarWidth ?? app.rect?.sidebarWidth,
      onraise: () => activateWindow(instance as WindowInstance),
      onrelease: () => deactivateWindow(),
      onminimize: () => deactivateWindow(instance as WindowInstance),
      // A window still on top of the stack raises without a raise event, so coming back claims it here.
      onrestore: () => activateWindow(instance as WindowInstance),
      onclose: () => releaseWindow(instance as WindowInstance),
      onmove: () => rememberWindow(instance as WindowInstance),
      onresize: () => rememberWindow(instance as WindowInstance),
      onmaximize: () => rememberWindow(instance as WindowInstance),
      onsidebarresize: () => rememberWindow(instance as WindowInstance),
    },
    { recursive: false, trapOwnKeys: false } as AnyType
  );
  const state = proxyProps(stateRef);

  const element = () => document.getElementById(id);

  const instance: WindowInstance<D> = {
    id,
    app,
    data,
    title,
    state,
    dockExtensions: app.dockExtensions,
    tools,
    focus() {
      state.minimized = false;
      activateWindow(instance as WindowInstance);
      // Focusing the window raises it to the front of its desktop. A window
      // opened a moment ago may not be mounted yet, so wait a few frames for it.
      const attempt = (frames: number) => {
        const target = element();
        // The desktop never scrolls: a window is placed, not scrolled to, so focusing one leaves the desktop still.
        if (target) target.focus({ preventScroll: true });
        else if (frames > 0) requestAnimationFrame(() => attempt(frames - 1));
      };
      requestAnimationFrame(() => attempt(10));
    },
    close() {
      state.open = false;
      releaseWindow(instance as WindowInstance);
    },
    minimize() {
      state.minimized = true;
      deactivateWindow(instance as WindowInstance);
    },
    toggleMaximized() {
      state.maximized = !state.maximized;
      rememberWindow(instance as WindowInstance);
    },
  };

  openWindows.set(id, instance as WindowInstance);
  instance.focus();
  return instance;
}

type Saved = Pick<WindowState, 'x' | 'y' | 'width' | 'height' | 'maximized' | 'sidebarWidth'>;

function load(name: string): Saved | undefined {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? (JSON.parse(raw) as Saved) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Keeps remembered geometry on the screen a window reopens on. One that still fits comes back where
 * it was; one saved on a larger screen comes back centered on this one and no bigger than it,
 * instead of somewhere past its edge.
 *
 * @param saved - The remembered geometry, if any.
 * @returns The geometry fitted to the current screen, or undefined when nothing was remembered.
 */
function fitToScreen(saved: Saved | undefined): Saved | undefined {
  if (!saved || typeof window === 'undefined') return saved;

  const { innerWidth, innerHeight } = window;
  const fits =
    saved.x >= 0 && saved.y >= 0 && saved.x + saved.width <= innerWidth && saved.y + saved.height <= innerHeight;
  if (fits) return saved;

  const width = Math.min(saved.width, innerWidth);
  const height = Math.min(saved.height, innerHeight);

  return {
    ...saved,
    width,
    height,
    x: Math.round((innerWidth - width) / 2),
    y: Math.round((innerHeight - height) / 2),
  };
}

function storageKey(name: string): string {
  return `aui-window:${name}`;
}
