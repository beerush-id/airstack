import { $static, For, Snippet, setup } from '@airlib/react';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import type { WindowLayoutLabels, WindowVariant } from './Window.js';
import { isFrontWindow, type WindowApp, type WindowInstance } from './window/registry.js';
import { findWindow, hostsWindow, openWindows, windowHostCtx, windowInstanceCtx } from './window/store.js';

export type WindowHostProps = Omit<ComponentStyles, 'variant'> & {
  /** Surface for every window this host draws, unless the window sets its own. */
  variant?: WindowVariant;
  /** Names the close button of every window. Without it, windows have no close button. */
  closeLabel?: string;
  /** Names the minimize button of every window. */
  minimizeLabel?: string;
  /** Names the maximize button of every window. */
  maximizeLabel?: string;
  /** Names the maximize button while a window is maximized. */
  restoreLabel?: string;
  /** Adds the layout popup to every maximize button. */
  layouts?: WindowLayoutLabels;
  /** Names the sidebar resizer of every window. Without it, sidebars keep their width. */
  sidebarResizeLabel?: string;
  /** Which definitions this host renders. Defaults to all. */
  apps?: WindowApp[];
};

type WindowViewProps = {
  id: string;
};

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
 * Renders every open window. Mount it once, usually inside a `Desktop`. It
 * lends every window it draws its button names, layouts, and look; window
 * buttons appear for each label you give.
 *
 * Only opening or closing a window changes what it draws, and the windows
 * already open are skipped — a window moving never reaches it.
 */
export const WindowHost = setup<WindowHostProps>((props) => {
  windowHostCtx.set(props);

  const shown = () => [...openWindows.values()].filter((instance) => hostsWindow(props.apps, instance));

  return () => <For each={shown}>{(instance) => <WindowView key={instance.id} id={instance.id} />}</For>;
}, 'WindowHost');

/**
 * One button per open window. Pressing a window's button brings it to the
 * front, puts it away when it is already in front, and brings it back when
 * it is minimized. The pressed state marks the window in front.
 */
export const WindowTaskbar = setup<WindowTaskbarProps>((props) => {
  const visible = () => [...openWindows.values()].filter((instance) => hostsWindow(props.apps, instance));
  const className = () => $families([AUI_CLASS.CONTROL, AUI_CLASS.BUTTON], props, auiConfig.windowTaskbar);

  return () => (
    <div role="group" aria-label={props.label} className="aui-window-taskbar">
      <For each={visible}>
        {(instance) => (
          <Snippet>
            {() => (
              <button
                type="button"
                className={className()}
                aria-pressed={isFrontWindow(instance) ? 'true' : 'false'}
                data-minimized={instance.state.minimized ? 'true' : undefined}
                onClick={() => (isFrontWindow(instance) ? instance.minimize() : instance.focus())}
              >
                {props.children ? props.children(instance) : instance.title}
              </button>
            )}
          </Snippet>
        )}
      </For>
    </div>
  );
}, 'WindowTaskbar');

/**
 * Draws one open window: makes it the window everything inside belongs to,
 * then runs its app's `render`.
 */
const WindowView = setup<WindowViewProps>((props) => {
  // Keyed by id, a view draws one copy for its whole life.
  const instance = $static(() => findWindow(props.id));
  if (instance) windowInstanceCtx.set(instance);
  const View = instance?.app.view;

  return () => (View ? <View /> : null);
}, 'WindowView');
