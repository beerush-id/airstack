import { aria, type DragEdge, type DragSnapMode, type WindowRect, windowCtx } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { type AnyType, type Bindable, Show, Slot, setup, template } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { CloseIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';

export type WindowSlots = {
  /** Replaces the title text in the title bar (an icon plus title, a tab strip). */
  title: () => ReactNode;
  /** Extra buttons in the title bar, before the window buttons. */
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
  /** Pixels per arrow key when there is no grid. Defaults to 16. */
  keyStep?: number;
  /** Renders the title bar, body, and resize grips for you. */
  title?: string;
  /** Names the close button; without it, no close button is drawn. */
  closeLabel?: string;
  /** Names the minimize button; without it, no minimize button is drawn. */
  minimizeLabel?: string;
  /** Names the maximize button; without it, no maximize button is drawn. */
  maximizeLabel?: string;
  /** Names the maximize button while maximized. Falls back to `maximizeLabel`. */
  restoreLabel?: string;
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
};

export type WindowPartProps = ComponentStyles & {
  children?: ReactNode;
};

export type WindowButtonProps = ComponentStyles & {
  disabled?: boolean;
  'aria-label'?: string;
  children?: ReactNode;
};

export type WindowMaximizeProps = WindowButtonProps & {
  /** Names the button while the window is maximized. */
  restoreLabel?: string;
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
  children?: ReactNode;
};

const WINDOW = 'aui-window';
const CLASS = {
  DESKTOP: 'aui-desktop',
  TITLE_BAR: `${WINDOW}-title-bar`,
  TITLE: `${WINDOW}-title`,
  CONTROLS: `${WINDOW}-controls`,
  BUTTON: `${WINDOW}-button`,
  BODY: `${WINDOW}-body`,
  RESIZE: `${WINDOW}-resize`,
};

const EDGES: DragEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const WINDOW_OMIT = [
  ...OMIT_KEYS,
  'title',
  'closeLabel',
  'minimizeLabel',
  'maximizeLabel',
  'restoreLabel',
];

register('desktop', {});
register('window', { size: SIZES.MD, color: COLORS.PRIMARY });
register('windowButton', { size: SIZES.SM, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/** Lets title-bar buttons follow the window's size and color. */
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
      {...desktop.restProps([...OMIT_KEYS, 'wallpaper'] as never)}
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
 * With `title` it renders the title bar, the body, and the resize grips; the
 * window buttons appear for each label you give. Without `title`, compose the
 * parts yourself.
 */
export const Window = setup<WindowProps, WindowSlots>((props, slots) => {
  const win = aria('window', props as AnyType);
  // The surface is not part of the shared control vocabulary, so the window names its own class for it.
  const className = () => {
    const variant = props.variant ?? (auiConfig.window?.variant as WindowVariant | undefined) ?? 'glass';
    return `${$families(WINDOW, { size: props.size, color: props.color, className: props.className }, auiConfig.window)} ${WINDOW}-${variant}`;
  };

  // Buttons follow the window's size and color; its surface variant is not theirs.
  windowScope.provide({
    get size() {
      return props.size;
    },
    get color() {
      return props.color;
    },
  });

  return () => (
    <div ref={win.ref} {...win.restProps(WINDOW_OMIT)} className={className()}>
      <Show when={() => props.title !== undefined} fallback={() => props.children}>
        {() => (
          <>
            <WindowTitleBar>
              <Slot for={() => slots.title?.()}>
                <WindowTitle>{props.title}</WindowTitle>
              </Slot>
              <div className={CLASS.CONTROLS}>
                <Slot for={() => slots.actions?.()} />
                <Show when={() => props.minimizeLabel}>
                  {(label) => <WindowMinimize aria-label={label} />}
                </Show>
                <Show when={() => props.maximizeLabel}>
                  {(label) => <WindowMaximize aria-label={label} restoreLabel={props.restoreLabel} />}
                </Show>
                <Show when={() => props.closeLabel}>{(label) => <WindowClose aria-label={label} />}</Show>
              </div>
            </WindowTitleBar>
            <WindowBody>{props.children}</WindowBody>
            <WindowResizeGrips />
          </>
        )}
      </Show>
    </div>
  );
}, 'Window');

/**
 * The strip that moves the window. Drag it to move; double-click it to
 * maximize or restore. Buttons inside it keep working as buttons.
 */
export const WindowTitleBar = setup<WindowPartProps>((props) => {
  const drag = aria('window-drag', props as AnyType);

  return () => (
    <div ref={drag.ref} {...drag.restProps(OMIT_KEYS)} className={$families(CLASS.TITLE_BAR, props)}>
      {props.children}
    </div>
  );
}, 'WindowTitleBar');

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
 * The window's content area. It scrolls when the content is taller than the window.
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
 * `restoreLabel`, its name follow the window's state.
 */
export const WindowMaximize = setup<WindowMaximizeProps>((props) => {
  const styles = windowScope.inherit(props);
  const maximize = aria('window-maximize', props as AnyType);
  const win = windowCtx.get();

  return () => (
    <button
      ref={maximize.ref}
      {...maximize.restProps([...OMIT_KEYS, 'restoreLabel', 'aria-label'] as never)}
      aria-label={win?.maximized ? (props.restoreLabel ?? props['aria-label']) : props['aria-label']}
      className={buttonClass(styles, props.children)}
    >
      {props.children ?? (win?.maximized ? <RestoreIcon /> : <MaximizeIcon />)}
    </button>
  );
}, 'WindowMaximize');

function buttonClass(styles: ComponentStyles, children?: ReactNode): string {
  const families = $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON, CLASS.BUTTON], styles, auiConfig.windowButton);
  return children ? families : `${families} ${AUI_CLASS.CONTROL_ICON}`;
}
