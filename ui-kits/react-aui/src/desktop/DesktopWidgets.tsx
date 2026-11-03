import { aria } from '@airlib/aria';
import { AUI_CLASS } from '@airlib/aui/utils';
import {
  $bind,
  $static,
  type AnyType,
  type Bindable,
  classx,
  mutable,
  onMount,
  setup,
  Show,
  Snippet,
} from '@airlib/react';
import type { ReactNode } from 'react';
import { OMIT_KEYS } from '../config.js';

/** How many grid cells a widget takes, across by down, up to three each way. */
export type DesktopWidgetSpan = `${1 | 2 | 3}x${1 | 2 | 3}`;

export type DesktopWidgetsProps = {
  /** Names the widgets for screen readers, e.g. "Widgets"; with it they are a landmark. */
  label?: string;
  className?: string;
  children?: ReactNode;
};

export type DesktopWidgetProps = {
  id?: string;
  /** Names the widget: shown at its top, and its accessible name. */
  title?: string;
  /** The grid cells it takes, across by down. Defaults to `1x1`. */
  span?: DesktopWidgetSpan;
  /** The grid column its left edge sits in, from 1; without it, the middle column. Moving the widget writes it. */
  column?: Bindable<number>;
  /** The grid row its top sits in, from 1; without it, the next free row. Moving the widget writes it. */
  row?: Bindable<number>;
  /** Whether people may move it, by dragging its glass or title or with the arrow keys. Defaults to true. */
  movable?: boolean;
  /** Sits straight on the desktop, with no glass pane: for something that reads on its own. */
  bare?: boolean;
  className?: string;
  children?: ReactNode;
};

export type DesktopClockProps = Omit<DesktopWidgetProps, 'children'> & {
  /** Languages for the time and date, e.g. `['en-GB']`. Read once. */
  locales?: string | string[];
  /** `h12` for a 12-hour clock, `h23` for 24-hour; by default, the locale's. Read once. */
  hourCycle?: 'h12' | 'h23';
};

export type DesktopNotesProps = Omit<DesktopWidgetProps, 'children'> & {
  /** The note's text. */
  value?: Bindable<string>;
  /** The hint while the note is empty. */
  placeholder?: string;
  /** Names the note's field for screen readers, e.g. "Notes". */
  label?: string;
};

const CLASS = {
  WIDGETS: 'aui-desktop-widgets',
  WIDGET: 'aui-desktop-widget',
  TITLE: 'aui-desktop-widget-title',
  CLOCK: 'aui-desktop-clock',
  CLOCK_TIME: 'aui-desktop-clock-time',
  CLOCK_DATE: 'aui-desktop-clock-date',
  NOTES_INPUT: 'aui-desktop-notes-input',
};

const MINUTE = 60_000;

/**
 * The widgets on the desktop: tiles on a grid beneath the windows, stacked
 * top to bottom in the middle of the desktop, a new column beside the first
 * once the height runs out. Place it in the `Desktop`. The desktop stays put; only
 * this layer scrolls once the widgets outgrow it, and its last row rests
 * above the dock. Pressing the empty desktop between widgets still releases
 * the windows.
 */
export const DesktopWidgets = setup<DesktopWidgetsProps>((props) => {
  const layer = aria('desktop-widgets', props as AnyType);

  return () => (
    <div
      ref={layer.ref}
      {...layer.restProps([...OMIT_KEYS, 'label'] as never)}
      className={classx(CLASS.WIDGETS, props.className)}
    >
      {props.children}
    </div>
  );
}, 'DesktopWidgets');

/**
 * One tile on the desktop's grid, on the windows' glass: a title, if any,
 * and whatever you put in it. `span` sets how many cells it takes, and
 * `column` and `row` where it sits; without them it stacks down the middle.
 * Drag its glass or title to move it, or focus it and use the arrow keys:
 * the new place is written back to `column` and `row`. Its title names it,
 * and light catches its glass where the pointer is, as on a window.
 */
export const DesktopWidget = setup<DesktopWidgetProps>((props) => {
  // A bare widget has no glass to catch light, so it tracks no pointer.
  const bare = $static(() => !!props.bare);
  const widget = aria('desktop-widget', props as AnyType, { trackPointer: !bare });
  const className = () => classx(CLASS.WIDGET, !bare && AUI_CLASS.GLINT, props.className);

  return () => (
    <div
      ref={widget.ref}
      {...widget.restProps([...OMIT_KEYS, 'title', 'bare'] as never)}
      data-bare={bare ? 'true' : undefined}
      className={className()}
    >
      <Show when={() => props.title}>
        {(title) => (
          <div id={widget.titleId} className={CLASS.TITLE}>
            {title}
          </div>
        )}
      </Show>
      {props.children}
    </div>
  );
}, 'DesktopWidget');

/**
 * The time, large, and the date below it, in your users' language, straight
 * on the desktop (`bare={false}` puts it on glass). It turns over on the
 * minute, with the system clock. It shows nothing until it runs in the
 * browser, so a server render never shows the server's time.
 */
export const DesktopClock = setup<DesktopClockProps>((props) => {
  const now = mutable<{ time?: number }>({});
  const format = $static(() => ({
    time: new Intl.DateTimeFormat(props.locales, { hour: 'numeric', minute: '2-digit', hourCycle: props.hourCycle }),
    date: new Intl.DateTimeFormat(props.locales, { weekday: 'long', month: 'long', day: 'numeric' }),
  }));

  // Each tick waits for the next whole minute, so the time never lags the system clock.
  onMount(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      now.time = Date.now();
      timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE));
    };
    tick();
    return () => clearTimeout(timer);
  });

  return () => (
    <DesktopWidget
      title={props.title}
      span={props.span ?? '3x1'}
      column={$bind(props as AnyType, 'column')}
      row={$bind(props as AnyType, 'row')}
      movable={props.movable}
      bare={props.bare ?? true}
      className={props.className}
    >
      <div className={CLASS.CLOCK}>
        <Snippet>
          {() => (
            <time className={CLASS.CLOCK_TIME} dateTime={now.time ? new Date(now.time).toISOString() : undefined}>
              {now.time ? format.time.format(now.time) : ' '}
            </time>
          )}
        </Snippet>
        <Snippet>
          {() => <span className={CLASS.CLOCK_DATE}>{now.time ? format.date.format(now.time) : ' '}</span>}
        </Snippet>
      </div>
    </DesktopWidget>
  );
}, 'DesktopClock');

/**
 * A note on the desktop: the tile is the field, and the text lives in your
 * `value`. Name it with `label`.
 */
export const DesktopNotes = setup<DesktopNotesProps>((props) => {
  const input = aria('text-input', props as AnyType);

  return () => (
    <DesktopWidget
      title={props.title}
      span={props.span ?? '3x1'}
      column={$bind(props as AnyType, 'column')}
      row={$bind(props as AnyType, 'row')}
      movable={props.movable}
      className={props.className}
    >
      <textarea
        ref={input.ref as never}
        {...input.restProps([...OMIT_KEYS, 'title', 'span', 'column', 'row', 'movable', 'value', 'label'] as never)}
        className={CLASS.NOTES_INPUT}
      />
    </DesktopWidget>
  );
}, 'DesktopNotes');
