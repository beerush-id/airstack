import {
  aria,
  type DragEdge,
  type DragSnapMode,
  handleRovingKey,
  type WindowAria,
  type WindowRect,
  windowCtx,
} from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import {
  $bind,
  $static,
  $use,
  type AnyType,
  type Bindable,
  createContext,
  effect,
  mutable,
  Show,
  Slot,
  setup,
  template,
} from '@airlib/react';
import type { ComponentType, FocusEvent, HTMLAttributes, KeyboardEvent, PointerEvent, ReactNode, UIEvent } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import {
  CloseIcon,
  MaximizeIcon,
  MinimizeIcon,
  RestoreIcon,
  SplitBottomIcon,
  SplitFillIcon,
  SplitHorizontalIcon,
  SplitLeftIcon,
  SplitQuartersIcon,
  SplitRightIcon,
  SplitTopIcon,
  SplitVerticalIcon,
} from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';
import type { WindowHostScope } from './window/registry.js';
import { windowHostCtx, windowInstanceCtx } from './window/store.js';
import { Button } from '../widgets/Button.js';
import { Splitter } from '../widgets/Splitter.js';
import type { OverlayTriggerMode } from '../composites/overlay.js';
import { Popover } from '../composites/Popover.js';

export type WindowSlots = {
  /** A full-height column beside the body — navigation, folders, conversations; usually a `WindowSidebar`. */
  sidebar: () => ReactNode;
  /** Replaces the whole body — toolbar, content panel, and all; build it from `WindowBody` and the parts. */
  body: () => ReactNode;
  /** What the toolbar shows before its buttons (an icon plus title, a tab strip, a search field). */
  title: () => ReactNode;
  /** Extra buttons in the toolbar, before the window buttons. */
  actions: () => ReactNode;
};

/** `glass` is the frosted sheet menus and popovers sit on; `solid` is opaque. */
export type WindowVariant = 'glass' | 'solid';

export type WindowProps = Omit<ComponentStyles, 'variant'> & {
  /** The window's surface. Defaults to `glass`. */
  variant?: WindowVariant;
  id?: string;
  /** Whether the window is showing. */
  open?: Bindable<boolean>;
  /** Left edge in pixels, from the desktop (or the viewport). */
  x?: Bindable<number>;
  /** Top edge in pixels, from the desktop (or the viewport). */
  y?: Bindable<number>;
  width?: Bindable<number>;
  height?: Bindable<number>;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  minimized?: Bindable<boolean>;
  maximized?: Bindable<boolean>;
  /** Whether people may move the window. Defaults to true. */
  movable?: boolean;
  /** Whether people may resize the window. Defaults to true. */
  resizable?: boolean;
  disabled?: boolean;
  /** Snap step in pixels while moving and resizing: one number, or per axis. */
  grid?: number | { x?: number; y?: number };
  /** Where the window must stay: a selector, `'viewport'`, or `'none'`. Defaults to the desktop, else the viewport. */
  bounds?: string | 'viewport' | 'none';
  /** Selectors of elements the window's edges snap to, e.g. `'.aui-window'` to snap to other windows. */
  snap?: string | string[];
  /** What attracts: edges, centers, or both. Defaults to edges. */
  snapMode?: DragSnapMode;
  /** How near, in pixels, before it snaps. Defaults to 8. */
  snapThreshold?: number;
  /** Space left where the window meets something face to face: another window, the dock, the other half of a split. Defaults to its desktop's, else 1. */
  snapGap?: number;
  /** Pixels per arrow key when there is no grid. Defaults to 16. */
  keyStep?: number;
  /** Whether maximizing and the half layouts stop short of the dock instead of reaching beneath it. Defaults to true. */
  dockAware?: boolean;
  /** Text drawn in the title bar; it also names the window. Most app windows draw none and use `label`. */
  title?: string;
  /** Names a window that draws no title, for screen readers. */
  label?: string;
  /** Names the close button; without it, no close button is drawn. */
  closeLabel?: string;
  /** Names the minimize button; without it, no minimize button is drawn. */
  minimizeLabel?: string;
  /** Names the maximize button; without it, no maximize button is drawn. */
  maximizeLabel?: string;
  /** Names the maximize button while maximized. Falls back to `maximizeLabel`. */
  restoreLabel?: string;
  /** Adds the layout popup to the maximize button: halves, and sharing with the window behind. */
  layouts?: WindowLayoutLabels;
  /** The sidebar's width in pixels; dragging its resizer writes it. Without it, the theme's width. */
  sidebarWidth?: Bindable<number>;
  /** The narrowest the sidebar resizes to, in pixels. Defaults to 160. */
  sidebarMinWidth?: number;
  /** The widest the sidebar resizes to, in pixels. Defaults to 400; it never takes more than half the window. */
  sidebarMaxWidth?: number;
  /** Names the sidebar's resizer, e.g. "Resize sidebar"; without it, the sidebar keeps its width. */
  sidebarResizeLabel?: string;
  children?: ReactNode;
  onmove?: (event: CustomEvent<WindowRect>) => void;
  onresize?: (event: CustomEvent<WindowRect>) => void;
  onclose?: (event: CustomEvent<void>) => void;
  onminimize?: (event: CustomEvent<void>) => void;
  onmaximize?: (event: CustomEvent<boolean>) => void;
  onrestore?: (event: CustomEvent<void>) => void;
  onraise?: (event: CustomEvent<void>) => void;
  /** Called when the window stops being active because its desktop was pressed. */
  onrelease?: (event: CustomEvent<void>) => void;
  /** Called with the sidebar's new width when a resize of it ends. */
  onsidebarresize?: (event: CustomEvent<number>) => void;
};

export type WindowPartProps = ComponentStyles & {
  children?: ReactNode;
};

export type WindowPanelProps = WindowPartProps &
  Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'color' | 'children'> & {
    /** Frosted glass (`glass`, the default), or a solid surface for what's read or judged on it. */
    surface?: 'glass' | 'solid';
  };

export type WindowButtonProps = ComponentStyles & {
  disabled?: boolean;
  'aria-label'?: string;
  children?: ReactNode;
};

export type WindowMaximizeProps = WindowButtonProps & {
  /** Names the button while the window is maximized. */
  restoreLabel?: string;
  /** Names the layout popup and each layout in it; the popup appears when given, and each layout when named. */
  layouts?: WindowLayoutLabels;
};

/**
 * Names for the layout popup on the maximize button: hovering the button, or
 * pressing the down arrow on it, offers these layouts besides maximizing.
 */
export type WindowLayoutLabels = {
  /** Names the popup, e.g. "Snap layouts". */
  label: string;
  /** Heads the halves the window fills on its own, e.g. "Move & Resize". */
  move?: string;
  /** Heads the layouts that fill the desktop or share it with the windows behind, e.g. "Fill & Arrange". */
  arrange?: string;
  /** Fill the left half. */
  left?: string;
  /** Fill the right half. */
  right?: string;
  /** Fill the top half. */
  top?: string;
  /** Fill the bottom half. */
  bottom?: string;
  /** Side by side with the window behind: this one on the side it mostly sits on. */
  vertical?: string;
  /** One above the other with the window behind: this one on the half it mostly sits in. */
  horizontal?: string;
  /** Fill the whole desktop at the window's own size, without maximizing. */
  fill?: string;
  /** Tile the desktop in four with up to three windows behind: this one in the quarter it mostly sits in. */
  quarters?: string;
};

export type WindowControlsProps = Pick<
  WindowHostScope,
  'closeLabel' | 'minimizeLabel' | 'maximizeLabel' | 'restoreLabel' | 'layouts'
> & {
  /** Buttons of your own, before the window buttons. */
  children?: ReactNode;
};

export type WindowResizeProps = {
  edge: DragEdge;
  className?: string;
};

/**
 * A desktop wallpaper: one image for both color schemes, or a light and a dark one.
 * Each is an image URL.
 */
export type DesktopWallpaper = string | { light: string; dark?: string };

export type DesktopProps = ComponentStyles & {
  id?: string;
  /** Image behind the windows; give `{ light, dark }` to switch with the color scheme. */
  wallpaper?: DesktopWallpaper;
  /** Space its windows leave where they meet each other, the dock, or the other half of a split. A window's own `snapGap` wins. Defaults to 1. */
  snapGap?: number;
  children?: ReactNode;
};

const WINDOW = 'aui-window';
const CLASS = {
  DESKTOP: 'aui-desktop',
  TOOLBAR: `${WINDOW}-toolbar`,
  TITLE: `${WINDOW}-title`,
  CONTROLS: `${WINDOW}-controls`,
  BUTTON: `${WINDOW}-button`,
  BODY: `${WINDOW}-body`,
  SCROLL: `${WINDOW}-scroll`,
  SIDEBAR: `${WINDOW}-sidebar`,
  SIDEBAR_PANEL: `${WINDOW}-sidebar-panel`,
  SIDEBAR_LABEL: `${WINDOW}-sidebar-label`,
  SIDEBAR_TRACK: `${WINDOW}-sidebar-track`,
  SIDEBAR_RESIZER: `${WINDOW}-sidebar-resizer`,
  CONTENT: `${WINDOW}-content`,
  PANEL: `${WINDOW}-panel`,
  LAYOUTS: `${WINDOW}-layouts`,
  LAYOUT_GROUP: `${WINDOW}-layouts-group`,
  LAYOUT_LABEL: `${WINDOW}-layouts-label`,
  LAYOUT_GRID: `${WINDOW}-layouts-grid`,
  RESIZE: `${WINDOW}-resize`,
};

const EDGES: DragEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** What a window lends everything inside it, from its own props or its host. */
const LENT_KEYS: Array<keyof WindowHostScope> = [
  'size',
  'color',
  'variant',
  'closeLabel',
  'minimizeLabel',
  'maximizeLabel',
  'restoreLabel',
  'layouts',
  'sidebarResizeLabel',
];

const WINDOW_OMIT = [
  ...OMIT_KEYS,
  'title',
  'label',
  'closeLabel',
  'minimizeLabel',
  'maximizeLabel',
  'restoreLabel',
  'layouts',
  'sidebarWidth',
  'sidebarMinWidth',
  'sidebarMaxWidth',
  'sidebarResizeLabel',
  'onsidebarresize',
];

/** The sidebar's resize range and arrow-key step, in pixels, when the window sets none. */
const SIDEBAR = { MIN: 160, MAX: 400, STEP: 16 };

/** The state the window draws — its instance's, or its own props standalone — for parts inside it. */
const windowStateCtx = createContext<WindowProps>();

register('desktop', {});
register('window', { size: SIZES.MD, color: COLORS.PRIMARY });
register('windowButton', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/** Lets toolbar buttons follow the window's size and color. */
const windowScope = createStyleScope();

/**
 * The area windows live in. Windows inside it share one front-to-back order,
 * stay inside it, and snap to its edges. Without a desktop, windows share the
 * page and stay inside the viewport.
 */
export const Desktop = setup<DesktopProps>((props) => {
  const desktop = aria('window-desktop', props as AnyType);
  const className = () => $families(CLASS.DESKTOP, { className: props.className }, auiConfig.desktop);

  return () => (
    <div
      ref={desktop.ref}
      {...desktop.restProps([...OMIT_KEYS, 'wallpaper', 'snapGap'] as never)}
      style={wallpaperStyle(props.wallpaper)}
      className={className()}
    >
      {props.children}
    </div>
  );
}, 'Desktop');

/** Writes a wallpaper into the desktop's wallpaper tokens; without one, the theme's tokens apply. */
function wallpaperStyle(wallpaper?: DesktopWallpaper): Record<string, string> | undefined {
  if (!wallpaper) return undefined;
  const light = typeof wallpaper === 'string' ? wallpaper : wallpaper.light;
  const dark = typeof wallpaper === 'string' ? undefined : wallpaper.dark;
  return {
    '--aui-desktop-wallpaper': `url("${light}")`,
    '--aui-desktop-wallpaper-dark': dark ? `url("${dark}")` : 'none',
  };
}

/**
 * A movable, resizable window that comes to the front when pressed or focused.
 * It always draws its frame: an optional full-height sidebar, then a body
 * holding your content on a panel with a toolbar floating over its top, and
 * the resize grips. Any bare glass moves it — the toolbar, the sidebar's
 * background — while content and controls keep the pointer. The toolbar
 * shows `title` when you give one and a window button for each label you
 * give; the `sidebar`, `title`, and `actions` slots fill parts of it, and
 * `body` replaces the body whole.
 *
 * Inside a window's `render`, it draws that open window: its geometry and
 * state are the instance's, and its button names, layouts, and look come
 * from the `WindowHost` unless you set them here.
 */
export const Window = setup<WindowProps, WindowSlots>((props, slots) => {
  // Opened through `defineWindow`, the window is its instance: the part binds to the instance's
  // state, the one source of truth. Standalone, its own props are its state.
  const instance = windowInstanceCtx.get();
  const host = windowHostCtx.get();
  const state = (instance?.state ?? props) as WindowProps;
  const win = aria('window', state as AnyType, { trackPointer: true });
  windowStateCtx.set(state);

  // Own prop, then what the host lends, then `configure()`.
  const lent = <K extends keyof WindowHostScope>(key: K) => (props[key as keyof WindowProps] ?? host?.[key]) as WindowHostScope[K];

  // The surface is not part of the shared control vocabulary, so the window names its own class for it.
  const className = () => {
    const variant = lent('variant') ?? (auiConfig.window?.variant as WindowVariant | undefined) ?? 'glass';
    return `${$families(WINDOW, { size: lent('size'), color: lent('color'), className: props.className }, auiConfig.window)} ${WINDOW}-${variant} ${AUI_CLASS.GLINT}`;
  };

  // Buttons follow the window's size and color; its surface variant is not theirs.
  windowScope.provide({
    get size() {
      return lent('size');
    },
    get color() {
      return lent('color');
    },
  });

  // Everything inside — a toolbar built in a slot or in the content — sees what this window lends.
  windowHostCtx.set(
    Object.defineProperties(
      {},
      Object.fromEntries(LENT_KEYS.map((key) => [key, { get: () => lent(key), enumerable: true }]))
    ) as WindowHostScope
  );

  return () => (
    <div ref={win.ref} {...win.restProps(WINDOW_OMIT)} className={className()}>
      <Slot for={() => slots.sidebar?.()} />
      <Slot for={() => slots.body?.()}>
        <WindowBody>
          <WindowToolbar>
            <Slot for={() => slots.title?.()}>
              <Show when={() => props.title}>{(title) => <WindowTitle>{title}</WindowTitle>}</Show>
            </Slot>
            <WindowControls>
              <Slot for={() => slots.actions?.()} />
            </WindowControls>
          </WindowToolbar>
          <WindowContent>{props.children}</WindowContent>
        </WindowBody>
      </Slot>
      <WindowResizeGrips />
    </div>
  );
}, 'Window');

/**
 * The window buttons — minimize, maximize or restore, close — each drawn
 * when it is named, after anything you put first. Names and the layout popup
 * come from its own props, else from the window or host around it, so a
 * toolbar you build yourself gets the same buttons.
 */
export const WindowControls = setup<WindowControlsProps>((props) => {
  const scope = windowHostCtx.get();
  const lent = <K extends keyof WindowControlsProps>(key: K) =>
    (props[key] ?? scope?.[key as keyof WindowHostScope]) as WindowControlsProps[K];

  return () => (
    <div className={CLASS.CONTROLS}>
      {props.children}
      <Show when={() => lent('minimizeLabel')}>{(label) => <WindowMinimize aria-label={label} />}</Show>
      <Show when={() => lent('maximizeLabel')}>
        {(label) => <WindowMaximize aria-label={label} restoreLabel={lent('restoreLabel')} layouts={lent('layouts')} />}
      </Show>
      <Show when={() => lent('closeLabel')}>{(label) => <WindowClose aria-label={label} />}</Show>
    </div>
  );
}, 'WindowControls');

/**
 * The strip across the top of the body that moves the window, holding the
 * title, actions, and window buttons. Double-click it to maximize or restore.
 * Controls inside it keep working as controls. Placed inside a surface, it
 * still moves the window.
 */
export const WindowToolbar = setup<WindowPartProps>((props) => {
  const drag = aria('window-drag', props as AnyType);

  return () => (
    <div ref={drag.ref} {...drag.restProps(OMIT_KEYS)} className={$families(CLASS.TOOLBAR, props)}>
      {props.children}
    </div>
  );
}, 'WindowToolbar');

/**
 * The window's heading. The window is named by it.
 */
export const WindowTitle = setup<WindowPartProps>((props) => {
  const title = aria('window-title', props as AnyType);

  return () => (
    <div ref={title.ref} {...title.restProps(OMIT_KEYS)} className={$families(CLASS.TITLE, props)}>
      {props.children}
    </div>
  );
}, 'WindowTitle');

/**
 * The column beside the sidebar that the window draws for you: a content
 * panel filling it, one inset from the edges, with the toolbar floating over
 * the panel's top. Build your own in the window's `body` slot.
 */
export const WindowBody = template<WindowPartProps>(
  (props) => (
    <div {...props.$omit(['className', 'children'])} className={$families(CLASS.BODY, props)}>
      {props.children}
    </div>
  ),
  'WindowBody'
);

/**
 * A full-height column on the window's glass beside the body — navigation,
 * folders, conversations. It keeps the window's `sidebarWidth` as the window
 * resizes, and its bare glass moves the window. With a `sidebarResizeLabel`
 * on the window or its host, a resizer on its edge lets people drag or step
 * that width. Put it in the window's `sidebar` slot.
 */
export const WindowSidebar = setup<WindowPartProps>((props) => {
  const state = windowStateCtx.get();
  const width = sidebarWidthVar(state);

  return () => (
    <>
      <div
        ref={width.ref}
        {...props.$omit(['className', 'children'])}
        style={sidebarLimitVars(state)}
        className={$families(CLASS.SIDEBAR, props)}
      >
        {props.children}
      </div>
      <WindowSidebarResizer />
    </>
  );
}, 'WindowSidebar');

/**
 * The sidebar's resizer: a splitter on the seam between the sidebar and the
 * body that writes the window's `sidebarWidth`, within its min and max. It
 * moves along a track spanning that range, so its value is the width itself.
 * Drawn only when named.
 */
const WindowSidebarResizer = setup(() => {
  const state = windowStateCtx.get() as WindowProps;
  const scope = windowHostCtx.get();
  const width = sidebarWidthVar(state);
  // The widest it may go depends on the window's width, which CSS holds; it is read when a resize
  // starts, so resizing the window never re-renders the resizer.
  const range = mutable({ max: $static(() => sidebarLimits(state).max) });

  // Without a width of its own the sidebar shows the theme's; once it is laid out, that becomes the value.
  const mount = (track: HTMLDivElement | null) => {
    width.ref(track);
    if (!track || state.sidebarWidth !== undefined) return;
    const sidebar = track.previousElementSibling as HTMLElement | null;
    if (sidebar) state.sidebarWidth = Math.round(sidebar.getBoundingClientRect().width);
  };

  // The track spans the range the window allows right now, so its far end is the current widest.
  const measure = (event: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    const { min } = sidebarLimits(state);
    range.max = Math.round(min + event.currentTarget.getBoundingClientRect().width);
  };

  return () => (
    <Show when={() => state && scope?.sidebarResizeLabel}>
      {(label) => (
        <div
          ref={mount}
          className={CLASS.SIDEBAR_TRACK}
          style={sidebarLimitVars(state)}
          onPointerDownCapture={measure}
          onFocusCapture={measure}
        >
          <Splitter
            value={$bind(state, 'sidebarWidth') as AnyType}
            min={sidebarLimits(state).min}
            max={$use(() => range.max)}
            step={SIDEBAR.STEP}
            orientation="vertical"
            label={label}
            className={CLASS.SIDEBAR_RESIZER}
            onchange={(event) => state?.onsidebarresize?.(event)}
          />
        </div>
      )}
    </Show>
  );
}, 'WindowSidebarResizer');

/**
 * The sidebar on a solid panel instead of the window's glass, inset with
 * corners that follow the window's. It is a surface, so pressing it never
 * moves the window.
 */
export const WindowSidebarPanel = template<WindowPartProps>(
  (props) => (
    <div
      {...props.$omit(['className', 'children'])}
      data-window-surface="true"
      className={$families(CLASS.SIDEBAR_PANEL, props)}
    >
      {props.children}
    </div>
  ),
  'WindowSidebarPanel'
);

/**
 * The name over a group of sidebar items, such as "Notes" or "Favorites".
 */
export const WindowSidebarLabel = template<WindowPartProps>(
  (props) => (
    <div {...props.$omit(['className', 'children'])} className={$families(CLASS.SIDEBAR_LABEL, props)}>
      {props.children}
    </div>
  ),
  'WindowSidebarLabel'
);

/**
 * A panel of your own on the window's glass, for a body you lay out yourself — a list beside a
 * view, a picture above a timeline: frosted (`glass`, the default) or solid, with the corners of
 * the window's panels. It is a surface, so pressing it never moves the window. Size and place it
 * in your layout; it scrolls what overflows it. It is a tab stop, so the keyboard reaches and
 * scrolls it; give it a `tabIndex` of your own to change that.
 */
export const WindowPanel = template<WindowPanelProps>(
  (props) => (
    <div
      {...props.$omit(['className', 'children', 'surface'])}
      tabIndex={props.tabIndex ?? 0}
      data-window-surface="true"
      className={`${$families(CLASS.PANEL, props)} ${props.surface === 'solid' ? AUI_CLASS.GLASS_SURFACE : AUI_CLASS.GLASS_PANEL}`}
    >
      {props.children}
    </div>
  ),
  'WindowPanel'
);

/**
 * The window's main content on a solid panel, inset from the window's edges
 * with corners that follow the window's. Your content scrolls inside it, and
 * under a toolbar floating over it, fading as it goes. It is a surface, so
 * pressing it never moves the window.
 */
export const WindowContent = template<WindowPartProps>(
  (props) => (
    <div
      {...props.$omit(['className', 'children'])}
      data-window-surface="true"
      className={$families(CLASS.CONTENT, props)}
    >
      <div ref={settle} className={CLASS.SCROLL} onScroll={lift}>
        {props.children}
      </div>
    </div>
  ),
  'WindowContent'
);

/**
 * One resize grip on an edge or corner. Hidden while the window can't be resized.
 */
export const WindowResize = setup<WindowResizeProps>((props) => {
  const grip = aria('window-resize', props as AnyType);

  return () => (
    <div ref={grip.ref} {...grip.restProps(['edge'] as never)} className={$families(CLASS.RESIZE, props)} />
  );
}, 'WindowResize');

/**
 * All eight resize grips — four edges and four corners.
 */
export const WindowResizeGrips = template(
  () => (
    <>
      {EDGES.map((edge) => (
        <WindowResize key={edge} edge={edge} />
      ))}
    </>
  ),
  'WindowResizeGrips'
);

/**
 * Button that closes its window. Shows a close glyph unless given children;
 * name it with `aria-label`.
 */
export const WindowClose = setup<WindowButtonProps>((props) => {
  const styles = windowScope.inherit(props);
  const close = aria('window-close', props as AnyType);

  return () => (
    <button ref={close.ref} {...close.restProps(OMIT_KEYS)} className={buttonClass(styles, props.children)}>
      {props.children ?? <CloseIcon />}
    </button>
  );
}, 'WindowClose');

/**
 * Button that minimizes its window. Shows a minimize glyph unless given
 * children; name it with `aria-label`.
 */
export const WindowMinimize = setup<WindowButtonProps>((props) => {
  const styles = windowScope.inherit(props);
  const minimize = aria('window-minimize', props as AnyType);

  return () => (
    <button ref={minimize.ref} {...minimize.restProps(OMIT_KEYS)} className={buttonClass(styles, props.children)}>
      {props.children ?? <MinimizeIcon />}
    </button>
  );
}, 'WindowMinimize');

/**
 * Button that maximizes its window or restores it. Its glyph and, with
 * `restoreLabel`, its name follow the window's state. With `layouts`,
 * hovering it — or pressing the down arrow on it — offers more layouts.
 */
export const WindowMaximize = setup<WindowMaximizeProps>((props) => {
  const styles = windowScope.inherit(props);
  const maximize = aria('window-maximize', props as AnyType);
  const win = windowCtx.get();

  return () => (
    <>
      <button
        ref={maximize.ref}
        {...maximize.restProps([...OMIT_KEYS, 'restoreLabel', 'aria-label', 'layouts'] as never)}
        aria-label={win?.maximized ? (props.restoreLabel ?? props['aria-label']) : props['aria-label']}
        className={buttonClass(styles, props.children)}
      >
        {props.children ?? (win?.maximized ? <RestoreIcon /> : <MaximizeIcon />)}
      </button>
      <Show when={() => props.layouts}>{(labels) => <WindowLayouts labels={labels} trigger={maximize} />}</Show>
    </>
  );
}, 'WindowMaximize');

const LAYOUT_MODES: OverlayTriggerMode[] = ['hover', 'rove'];

type WindowLayout = {
  name: Exclude<keyof WindowLayoutLabels, 'label' | 'move' | 'arrange'>;
  Icon: ComponentType;
  apply: (win: WindowAria) => void;
};

// The halves a window fills on its own, then the layouts it shares with the window behind.
const LAYOUT_GROUPS: Array<{ name: 'move' | 'arrange'; layouts: WindowLayout[] }> = [
  {
    name: 'move',
    layouts: [
      { name: 'left', Icon: SplitLeftIcon, apply: (win) => win.snapTo('left') },
      { name: 'right', Icon: SplitRightIcon, apply: (win) => win.snapTo('right') },
      { name: 'top', Icon: SplitTopIcon, apply: (win) => win.snapTo('top') },
      { name: 'bottom', Icon: SplitBottomIcon, apply: (win) => win.snapTo('bottom') },
    ],
  },
  {
    name: 'arrange',
    layouts: [
      { name: 'fill', Icon: SplitFillIcon, apply: (win) => win.fill() },
      { name: 'vertical', Icon: SplitVerticalIcon, apply: (win) => win.pairWith('vertical') },
      { name: 'horizontal', Icon: SplitHorizontalIcon, apply: (win) => win.pairWith('horizontal') },
      { name: 'quarters', Icon: SplitQuartersIcon, apply: (win) => win.tileQuarters() },
    ],
  },
];

/**
 * The maximize button's layout popup: the layouts beside the button, in a group each for the
 * halves and the shared layouts, each headed when it's named. It opens on hover or the down arrow,
 * travels by arrow keys across both groups, and closes when a layout is picked or the pointer
 * leaves it.
 */
const WindowLayouts = setup<{ labels: WindowLayoutLabels; trigger: { current: unknown } }>((props) => {
  const win = windowCtx.get();
  const view = mutable({ open: false });

  const pick = (apply: (win: WindowAria) => void) => {
    view.open = false;
    if (win) apply(win);
    (props.trigger.current as HTMLElement | null)?.focus();
  };

  // Moving back onto the maximize button keeps it open; leaving anywhere else closes it.
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    if ((props.trigger.current as Node | null)?.contains(event.relatedTarget as Node)) return;
    view.open = false;
  };

  const rove = (event: KeyboardEvent<HTMLDivElement>) => {
    handleRovingKey(event.currentTarget, event.nativeEvent, { selector: 'button', flow: true, manual: true });
  };

  return () => (
    <Popover
      open={$bind(view, 'open')}
      mode={LAYOUT_MODES}
      delay={400}
      autofocus={false}
      className={CLASS.LAYOUTS}
      {...({ 'aria-label': props.labels.label, 'data-window-surface': 'true', onPointerLeave: leave } as AnyType)}
    >
      <div onKeyDown={rove}>
        {LAYOUT_GROUPS.map((group) => (
          <Show key={group.name} when={() => group.layouts.some((layout) => props.labels[layout.name])}>
            <div role="group" aria-label={props.labels[group.name]} className={CLASS.LAYOUT_GROUP}>
              <Show when={() => props.labels[group.name]}>
                {(heading) => (
                  <div aria-hidden="true" className={CLASS.LAYOUT_LABEL}>
                    {heading}
                  </div>
                )}
              </Show>
              <div className={CLASS.LAYOUT_GRID}>
                {group.layouts.map((layout) => (
                  <Show key={layout.name} when={() => props.labels[layout.name]}>
                    {(label) => (
                      <Button
                        aria-label={label}
                        variant={VARIANTS.TEXT}
                        className={AUI_CLASS.CONTROL_ICON}
                        onClick={() => pick(layout.apply)}
                      >
                        <layout.Icon />
                      </Button>
                    )}
                  </Show>
                ))}
              </div>
            </div>
          </Show>
        ))}
      </div>
    </Popover>
  );
}, 'WindowLayouts');

/**
 * The widths a window's sidebar may take, as set on the window. CSS further
 * holds it to half the window, so the body always keeps the other half.
 *
 * @param state - The window's state, for its sidebar limits.
 * @returns The narrowest and widest sidebar width, in pixels.
 */
function sidebarLimits(state?: WindowProps): { min: number; max: number } {
  return { min: state?.sidebarMinWidth ?? SIDEBAR.MIN, max: state?.sidebarMaxWidth ?? SIDEBAR.MAX };
}

/**
 * The sidebar's limits as the CSS variables its width and resizer track are held to.
 *
 * @param state - The window's state, for its sidebar limits.
 * @returns A style object carrying the min and max widths.
 */
function sidebarLimitVars(state?: WindowProps): AnyType {
  const { min, max } = sidebarLimits(state);
  return { '--aui-window-sidebar-min': `${min}px`, '--aui-window-sidebar-max': `${max}px` };
}

/**
 * Keeps an element's `--aui-window-sidebar-width` on the window's sidebar width
 * by writing its style directly, so a resize never re-renders it. Until a width
 * is set, the theme's width applies.
 *
 * @param state - The window's state, for its sidebar width.
 * @returns A ref to attach to the element that carries the width.
 */
function sidebarWidthVar(state?: WindowProps): { ref: (element: HTMLElement | null) => void } {
  let target: HTMLElement | null = null;
  const apply = () => {
    const value = state?.sidebarWidth as number | undefined;
    if (value === undefined) target?.style.removeProperty('--aui-window-sidebar-width');
    else target?.style.setProperty('--aui-window-sidebar-width', `${value}px`);
  };

  effect(apply);

  return {
    ref(element) {
      target = element;
      apply();
    },
  };
}

function buttonClass(styles: ComponentStyles, children?: ReactNode): string {
  const families = $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, CLASS.BUTTON], styles, auiConfig.windowButton);
  return children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
}

/**
 * Measures the scroller as it appears, so a view coming in at its top starts with the toolbar down.
 *
 * @param scroller - The content's scroller, once mounted.
 */
function settle(scroller: HTMLDivElement | null): void {
  if (scroller) liftBy(scroller);
}

/**
 * Follows the content's scroll with the toolbar's lift.
 *
 * @param event - The scroller's scroll.
 */
function lift(event: UIEvent<HTMLDivElement>): void {
  liftBy(event.currentTarget);
}

/**
 * Tells the window's body how far its content has scrolled beneath the floating toolbar, as
 * `--aui-window-lift`: 0 at the top, 1 once it has scrolled the toolbar's height, which the
 * toolbar's lift fades by. Read from the scroller itself, so content that stops scrolling — a
 * shorter view swapped in — lands the toolbar back down, which a scroll timeline doesn't do.
 *
 * @param scroller - The content's scroller.
 */
function liftBy(scroller: HTMLElement): void {
  const body = scroller.closest<HTMLElement>(`.${CLASS.BODY}`);
  const toolbar = body?.querySelector<HTMLElement>(`:scope > .${CLASS.TOOLBAR}`);
  if (!body || !toolbar) return;
  body.style.setProperty('--aui-window-lift', String(Math.min(scroller.scrollTop / toolbar.offsetHeight, 1)));
}
