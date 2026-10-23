import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { $static, $use, type AnyType, classx, createContext, effect, For, Show, setup } from '@airlib/react';
import type { ComponentType } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { Toast, ToastClose } from '../composites/Toast.js';
import { MarkdownRenderer } from '../dynamic/MarkdownRenderer.js';
import { type WidgetNode, WidgetRenderer } from '../dynamic/WidgetRenderer.js';
import type { DockWidgetEntry, DockWidgetPart, DockWidgetParts, DockWidgetRender } from './dock/registry.js';
import { dockWidgetActivity, dockWidgetEntries } from './dock/store.js';

export type DockWidgetsProps = ComponentStyles & {
  /** Names the stack for screen readers, e.g. "Assistant"; with it the stack is a landmark. */
  label?: string;
  /** Names each widget's close button; without it, widgets have none. */
  closeLabel?: string;
  /** Milliseconds before a widget leaves on its own, the user's choice; off (`false`) by default, so nothing goes before it is read. */
  autoDismiss?: number | false;
  /** Caps how many widgets an open stack shows; older ones move out of view until newer ones are dismissed. Without it, an open stack shows every widget, scrolling once they outgrow the screen. */
  visible?: number;
  /** Over the windows, like the dock (default), or on the desktop beneath them. */
  layer?: 'above' | 'below';
};

export type DockWidgetProps = ComponentStyles & {
  /** The widget to draw. */
  widget: DockWidgetEntry;
};

const CLASS = {
  WIDGETS: 'aui-dock-widgets',
  LIST: 'aui-dock-widgets-list',
  WIDGET: 'aui-dock-widget',
  IMPORTANT: 'aui-dock-widget-important',
};

const WIDGETS_OMIT = [...OMIT_KEYS, 'closeLabel', 'autoDismiss', 'visible', 'layer'];

register('dockWidgets', {});

/** The stack's settings, for each widget it draws. */
const dockWidgetsCtx = createContext<DockWidgetsProps>();

/**
 * The stack of answers above the dock, newest nearest the prompt, over the
 * windows. Place it in the `Desktop` right after the `Dock`: it shares the
 * dock's `Tab` loop, so people move between the prompt and an answer's
 * buttons without leaving. After a quiet spell it fades away; a new or
 * changing answer, pointing at its area, or focus inside brings it back, and
 * an answer waiting on the user keeps it showing. Only the answers' area
 * takes the pointer; the space around it belongs to the windows behind.
 */
export const DockWidgets = setup<DockWidgetsProps>((props) => {
  const region = aria('dock-region', props as AnyType);
  dockWidgetsCtx.set(props);

  // Each change flips the stack's activity mark, which restarts its quiet countdown in CSS.
  effect(() => {
    const odd = dockWidgetActivity.count % 2 === 1;
    (region.current as HTMLElement | null)?.setAttribute('data-activity', odd ? 'odd' : 'even');
  });

  return () => (
    <div
      ref={region.ref}
      {...region.restProps(WIDGETS_OMIT as never)}
      data-layer={props.layer ?? 'above'}
      data-visible={props.visible}
      className={$families(CLASS.WIDGETS, props, auiConfig.dockWidgets)}
    >
      <div className={CLASS.LIST}>
        <For each={() => [...dockWidgetEntries.values()]}>
          {(widget) => <DockWidget key={widget.id} widget={widget} />}
        </For>
      </div>
    </div>
  );
}, 'DockWidgets');

/**
 * One widget on the dock's glass. It announces itself when it appears, and
 * leaves when dismissed: by its close button, by the code that added it, or
 * — when the user turned auto-dismiss on — after a while, pausing while it is
 * pointed at or focused. A widget waiting on the user never leaves on its own.
 */
export const DockWidget = setup<DockWidgetProps>((props) => {
  const host = dockWidgetsCtx.get();
  // The widget drawn is fixed for this component's life; so is its timer, set once when it appears.
  const { widget, important, critical, dismiss, render } = $static(() => {
    const { important, critical, dismiss, render } = props.widget;
    return { widget: props.widget, important, critical, dismiss, render: (render ?? renderParts) as DockWidgetRender };
  });
  // Its content is a component of its own, so data changes redraw the content and never the widget around it.
  const View = setup(() => render({ widget }), 'DockWidgetView') as ComponentType;
  const duration = $static(() => (important ? undefined : host?.autoDismiss || undefined));
  const className = classx(CLASS.WIDGET, AUI_CLASS.TOAST_FLOATING, important && CLASS.IMPORTANT);

  return () => (
    <Toast critical={critical} duration={duration} size={props.size} className={className} ondismiss={dismiss}>
      <div className={`${CLASS.WIDGET}-content`}>
        <View />
      </div>
      <Show when={() => host?.closeLabel}>{(label) => <ToastClose aria-label={label} />}</Show>
    </Toast>
  );
}, 'DockWidget');

/** Draws an answer's parts in order; adding one draws only that part. */
const renderParts: DockWidgetRender<DockWidgetParts> = ({ widget }) => () => (
  <For each={() => widget.data.children}>{(part) => <DockWidgetPartView part={part} />}</For>
);

/**
 * One part of an answer: markdown text redrawn as its words arrive, or a
 * widget drawn once from its data.
 */
const DockWidgetPartView = setup<{ part: DockWidgetPart }>((props) => {
  const part = $static(() => props.part);
  const kind = $static(() => props.part.type);
  // Text is markdown, redrawn block by block as its words arrive.
  if (kind === 'text') return () => <MarkdownRenderer text={$use(part as { text: string }, 'text')} />;
  return () => <WidgetRenderer node={part as WidgetNode} />;
}, 'DockWidgetPart');
