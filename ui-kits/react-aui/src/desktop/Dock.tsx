import { aria, dialogCtx, handleRovingKey } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { $bind, $use, type AnyType, type Bindable, For, Show, Slot, setup, shadowPortal } from '@airlib/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { AppsIcon, MicIcon, SendIcon, StopIcon } from '../icons/index.js';
import { AppIcon, AppIconTile } from '../widgets/AppIcon.js';
import { Button } from '../widgets/Button.js';
import { Spinner } from '../widgets/Spinner.js';
import { Toggle } from '../widgets/Toggle.js';
import { Dialog, DialogTrigger } from '../composites/Dialog.js';
import { createAppCtx } from './system/context.js';
import { system } from './system/system.js';
import { appLabel, focusApp, isFrontWindow, type WindowApp, type WindowInstance } from './window/registry.js';
import { openWindows, windowApps } from './window/store.js';

export type DockSlots = {
  /** Replaces the launcher. */
  start: () => ReactNode;
  /** Replaces the running-apps strip. */
  tasks: () => ReactNode;
};

export type DockProps = ComponentStyles & {
  /** Names the dock for screen readers, e.g. "Dock". */
  label?: string;
  /** Apps the launcher lists and the dock shows when running. Defaults to every defined window. */
  apps?: WindowApp[];
  /** Names the start button and the launcher; without it, neither is drawn. */
  startLabel?: string;
  /** A picture for the start button, drawn as an app tile in place of the apps glyph. */
  startImage?: string;
  /** Names the prompt field for screen readers. */
  promptLabel?: string;
  /** Hint in the empty prompt. */
  placeholder?: string;
  /** Names the voice toggle; without it, no voice toggle is drawn. */
  voiceLabel?: string;
  /** Names the send button; without it, Enter is the only way to send. */
  submitLabel?: string;
  /** The prompt's text. */
  value?: Bindable<string>;
  /** Whether voice input is on. The dock only shows the state; your app does the listening. */
  listening?: Bindable<boolean>;
  /**
   * Whether a sent request is still being worked on. The prompt shows a spinner; what's sent
   * meanwhile still reaches `onsubmit`, for your app to treat as a follow-up.
   */
  busy?: boolean;
  /** Names the spinner while busy, e.g. "Thinking". */
  busyLabel?: string;
  /** Names the stop button the send button turns into while busy; without it, there is none. */
  stopLabel?: string;
  /** Whether the assistant's voice is playing. The voice button pulses; your app does the speaking. */
  speaking?: boolean;
  /** Announced once when speaking starts, e.g. "The assistant is speaking". */
  speakingLabel?: string;
  /**
   * Called with the prompt's text when it is sent, and the window that was active then — what the
   * prompt is about. The prompt clears afterwards.
   */
  onsubmit?: (event: DockSubmitEvent) => void;
  /** Called when the person stops the running request: the stop button, or Escape in the prompt. */
  onstop?: (event: CustomEvent<void>) => void;
  /** Your own dock parts, when you compose instead of using the props above. */
  children?: ReactNode;
};

export type DockPromptProps = ComponentStyles & {
  /** Names the field for screen readers. */
  label?: string;
  placeholder?: string;
  voiceLabel?: string;
  submitLabel?: string;
  value?: Bindable<string>;
  listening?: Bindable<boolean>;
  busy?: boolean;
  busyLabel?: string;
  stopLabel?: string;
  speaking?: boolean;
  speakingLabel?: string;
  onsubmit?: (event: DockSubmitEvent) => void;
  onstop?: (event: CustomEvent<void>) => void;
};

/**
 * A prompt sent from the dock: its text in `detail`, and the window that was active when it was
 * sent, so the request can be about what the person is looking at.
 */
export type DockSubmitEvent = CustomEvent<string> & {
  /** The window in front when the prompt was sent; undefined when none was. */
  readonly activeWindow?: WindowInstance;
};

export type DockLauncherProps = ComponentStyles & {
  /** Names the start button and the launcher. */
  'aria-label'?: string;
  /** A picture for the start button, drawn as an app tile in place of the apps glyph. */
  image?: string;
  /** Apps in the launcher until the system is booted with its installed apps. Defaults to every defined window. */
  apps?: WindowApp[];
};

/** One app in the launcher's grid, whichever list it came from. */
type LauncherTile = { label: string; image?: string; icon?: ReactNode; launch: () => unknown };

export type DockTasksProps = ComponentStyles & {
  /** Names the strip of running apps, e.g. "Running apps". */
  label?: string;
  apps?: WindowApp[];
};

const DOCK = 'aui-dock';
const CLASS = {
  PROMPT: `${DOCK}-prompt`,
  INPUT: `${DOCK}-input`,
  STOP: `${DOCK}-stop`,
  EXTENSIONS: `${DOCK}-extensions`,
  FLOAT: `${DOCK}-float`,
  FLOAT_FRAME: `${DOCK}-float-frame`,
  STATUS: `${DOCK}-status`,
  START: `${DOCK}-start`,
  LAUNCH: `${DOCK}-launch`,
  LAUNCHER: 'aui-launcher',
  LAUNCHER_APPS: 'aui-launcher-apps',
  APP_ICON: 'aui-app-icon',
  TASKS: `${DOCK}-tasks`,
  TASK: `${DOCK}-task`,
};

const DOCK_OMIT = [
  ...OMIT_KEYS,
  'apps',
  'startLabel',
  'startImage',
  'promptLabel',
  'placeholder',
  'voiceLabel',
  'submitLabel',
  'value',
  'listening',
  'busy',
  'busyLabel',
  'stopLabel',
  'speaking',
  'speakingLabel',
  'onsubmit',
  'onstop',
];

/** The variable the floating options publish their height in, on the desktop, for the answers to keep clear of. */
const FLOAT_BLOCK_SIZE = '--aui-dock-float-block-size';

register('dock', { size: SIZES.MD, color: COLORS.PRIMARY });
register('dockButton', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/**
 * The desktop's one input surface, centered at the bottom: a launcher that
 * opens apps, a prompt that takes typed or spoken requests, and the running
 * apps. Every part appears when you name it.
 */
export const Dock = setup<DockProps, DockSlots>((props, slots) => {
  const dock = aria('dock', props as AnyType, { trackPointer: true });
  const className = () =>
    `${$families(DOCK, { size: props.size, color: props.color, className: props.className }, auiConfig.dock)} ${AUI_CLASS.GLINT}`;

  return () => (
    <>
      <div ref={dock.ref} {...dock.restProps(DOCK_OMIT as never)} className={className()}>
        <Show
          when={() => props.children}
          fallback={() => (
            <>
              <Slot for={() => slots.start?.()}>
                <Show when={() => props.startLabel}>
                  {(label) => (
                    <DockLauncher
                      aria-label={label}
                      image={props.startImage}
                      apps={props.apps}
                      size={props.size}
                      color={props.color}
                    />
                  )}
                </Show>
              </Slot>
              <DockPrompt
                label={props.promptLabel}
                placeholder={props.placeholder}
                voiceLabel={props.voiceLabel}
                submitLabel={props.submitLabel}
                value={$bind(props, 'value')}
                listening={$bind(props, 'listening')}
                busy={$use(() => props.busy)}
                busyLabel={props.busyLabel}
                stopLabel={props.stopLabel}
                speaking={$use(() => props.speaking)}
                speakingLabel={props.speakingLabel}
                onsubmit={props.onsubmit}
                onstop={props.onstop}
                size={props.size}
                color={props.color}
              />
              <Slot for={() => slots.tasks?.()}>
                <DockTasks apps={props.apps} />
              </Slot>
            </>
          )}
        >
          {() => props.children}
        </Show>
      </div>
      {/*
       * The front window's options float above the dock on their own glass, beside it rather than in
       * it. After the dock, since an anchored element can only follow its anchor.
       */}
      <DockExtensions />
    </>
  );
}, 'Dock');

/**
 * The prompt: a field that grows with its text, an optional voice toggle,
 * and an optional send button. Enter sends; Shift+Enter adds a line. While
 * `busy`, a spinner leads the field, the send button becomes a stop button
 * when it's named, and Escape stops too; what's typed and sent meanwhile is a
 * follow-up for your app. While `speaking`, the voice button pulses, and
 * turning voice on then is how someone speaks over the assistant.
 */
export const DockPrompt = setup<DockPromptProps>((props) => {
  const input = aria('text-input', props as AnyType);

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    props.onsubmit?.(Object.assign(new CustomEvent('submit', { detail: text }), { activeWindow: system.activeWindow }));
    input.value = '';
    const element = input.current as HTMLTextAreaElement | null;
    if (element) element.value = '';
  };

  const stop = () => {
    if (!props.busy) return;
    props.onstop?.(new CustomEvent('stop'));
  };

  // Enter sends like a chat field, Escape stops a running request; the part has no keymap of its own for either.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && props.busy && props.onstop) {
      event.preventDefault();
      stop();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return () => (
    <div className={CLASS.PROMPT}>
      <Show when={() => props.busy}>
        {() => <Spinner label={props.busyLabel as string} size={props.size} color={props.color} />}
      </Show>
      <textarea
        ref={input.ref as AnyType}
        {...input.restProps([
          ...OMIT_KEYS,
          'value',
          'voiceLabel',
          'submitLabel',
          'listening',
          'busy',
          'busyLabel',
          'stopLabel',
          'speaking',
          'speakingLabel',
          'onsubmit',
          'onstop',
        ] as never)}
        placeholder={props.placeholder}
        rows={1}
        className={CLASS.INPUT}
        onKeyDown={handleKeyDown}
      />
      <Show when={() => props.voiceLabel}>
        {(label) => (
          <Toggle
            aria-label={label}
            pressed={$bind(props, 'listening')}
            data-speaking={$use(() => (props.speaking ? 'true' : undefined))}
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
          >
            <MicIcon />
          </Toggle>
        )}
      </Show>
      <Show when={() => props.busy && props.stopLabel}>
        {(label) => (
          <Button
            aria-label={label as string}
            size={props.size}
            color={props.color}
            className={`${CLASS.STOP} ${AUI_CLASS.CONTROL_ICON}`}
            onClick={stop}
          >
            <StopIcon />
          </Button>
        )}
      </Show>
      <Show when={() => !(props.busy && props.stopLabel) && props.submitLabel}>
        {(label) => (
          <Button
            aria-label={label as string}
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
            onClick={submit}
          >
            <SendIcon />
          </Button>
        )}
      </Show>
      {/* Says once that the assistant has started talking; the pulse alone isn't seen by everyone. */}
      <span className={CLASS.STATUS} role="status">
        <Show when={() => props.speaking && props.speakingLabel}>{(label) => label as string}</Show>
      </span>
    </div>
  );
}, 'DockPrompt');

/**
 * The front window's options, floating above the dock on a glass pane of their own with a solid
 * surface inside — for what's sent with the prompt: a model, a size, a reference. It sizes to its
 * content, shares the dock's `Tab` loop, and publishes its height so the answers above the dock
 * keep clear of it. The window's `dockExtensions` draws everything inside; nothing shows while
 * the front window has none, or no window is in front.
 */
export const DockExtensions = setup(
  () => () => (
    <Show when={() => system.activeWindow?.dockExtensions && system.activeWindow}>
      {(front) => <DockExtensionsPane front={front} />}
    </Show>
  ),
  'DockExtensions'
);

/**
 * The floating pane itself, mounted only while there's something to show, so it measures and
 * publishes its height only then.
 */
const DockExtensionsPane = setup<{ front: WindowInstance }>((props) => {
  const region = aria('dock-region', { publish: FLOAT_BLOCK_SIZE } as AnyType);

  return () => {
    const Extensions = props.front.dockExtensions!;

    return (
      <div ref={region.ref} {...region.restProps([...OMIT_KEYS] as never)} className={CLASS.FLOAT}>
        <div role="group" aria-label={`${appLabel(props.front.app)} options`} className={`${CLASS.FLOAT_FRAME} ${AUI_CLASS.GLASS_FRAME}`}>
          <div className={`${CLASS.EXTENSIONS} ${AUI_CLASS.GLASS_SURFACE}`}>
            <Extensions instance={props.front} />
          </div>
        </div>
      </div>
    );
  };
}, 'DockExtensionsPane');

/**
 * The launcher: a start button that opens a grid of every app above the
 * dock, at least as wide as the dock itself. Opening it moves focus to the
 * first app; picking an app opens it and closes the launcher, and `Escape`
 * or a press outside closes it too, returning focus to the start button.
 * Name it with `aria-label`.
 */
export const DockLauncher = setup<DockLauncherProps>((props) => {
  return () => (
    <Dialog className={CLASS.LAUNCH}>
      <Show
        when={() => props.image}
        fallback={() => (
          <DialogTrigger
            {...({ 'aria-label': props['aria-label'] } as AnyType)}
            size={props.size}
            color={props.color}
            variant={VARIANTS.TEXT}
            className={`${CLASS.START} ${AUI_CLASS.CONTROL_ICON}`}
          >
            <AppsIcon />
          </DialogTrigger>
        )}
      >
        {(src) => <DockLauncherTile aria-label={props['aria-label']} src={src} size={props.size} color={props.color} />}
      </Show>
      <DockLauncherPanel aria-label={props['aria-label']} apps={props.apps} />
    </Dialog>
  );
}, 'DockLauncher');

/**
 * The start button drawn from a picture: an app icon that opens the
 * launcher, so it hovers, presses, and shows focus like every other app
 * icon in the dock.
 */
const DockLauncherTile = setup<ComponentStyles & { 'aria-label'?: string; src: string }>((props) => {
  const trigger = aria('dialog-trigger', props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, CLASS.APP_ICON], props, auiConfig.appIcon);

  return () => (
    <button ref={trigger.ref} {...trigger.restProps([...OMIT_KEYS, 'src'] as never)} className={className()}>
      {/* The button's label names it, so the picture is decorative. */}
      <AppIconTile alt="" src={props.src} />
    </button>
  );
}, 'DockLauncherTile');

/**
 * The launcher's grid of apps, placed above the dock it belongs to. Arrow
 * keys travel the grid as it wraps: left and right in reading order, up and
 * down to the closest app in the next row.
 */
export const DockLauncherPanel = setup<DockLauncherProps>((props) => {
  const panel = aria('dialog-panel', props as AnyType, { trackPointer: true });
  const dialog = dialogCtx.get();
  const shadow = shadowPortal(() => panel.open);

  // The installed apps once the system is booted, booted on launch; until then, the defined windows.
  const tiles = (): LauncherTile[] => {
    const installed = system.system.apps;
    if (installed) {
      return installed.map((entry) => ({
        label: entry.manifest.label,
        image: entry.manifest.icon,
        launch: () => entry.main(createAppCtx()),
      }));
    }
    return (props.apps ?? windowApps).map((app) => ({
      label: appLabel(app),
      image: app.image,
      icon: app.icon,
      launch: () => app.open(),
    }));
  };

  const launch = (tile: LauncherTile) => {
    dialog?.close();
    tile.launch();
  };

  // The grid's rows come from layout, not markup, so the rover reads them from the tiles' positions.
  const rove = (event: KeyboardEvent<HTMLDivElement>) => {
    handleRovingKey(event.currentTarget, event.nativeEvent, { selector: `.${CLASS.APP_ICON}`, flow: true, manual: true });
  };

  return () =>
    shadow(
      <div
        ref={panel.ref}
        {...panel.restProps([...OMIT_KEYS, 'apps'] as never)}
        className={`${CLASS.LAUNCHER} ${AUI_CLASS.GLINT}`}
      >
        <div className={CLASS.LAUNCHER_APPS} onKeyDown={rove}>
          <For each={tiles}>
            {(tile) => (
              <AppIcon alt={tile.label} src={tile.image} icon={tile.icon} onClick={() => launch(tile)}>
                {tile.label}
              </AppIcon>
            )}
          </For>
        </div>
      </div>
    );
}, 'DockLauncherPanel');

/**
 * Running apps, one icon each: pressing an icon brings the app
 * forward, puts its window away when it is already in front, and cycles
 * through its windows when it has several. A dot marks the app in front;
 * arrow keys move between the icons.
 */
export const DockTasks = setup<DockTasksProps>((props) => {
  const strip = aria('toolbar', props as AnyType);
  const running = () =>
    (props.apps ?? windowApps).filter((app) => [...openWindows.values()].some((instance) => instance.app.name === app.name));

  return () => (
    <div ref={strip.ref} {...strip.restProps([...OMIT_KEYS, 'apps'] as never)} className={CLASS.TASKS}>
      <For each={running}>
        {(app) => (
          <AppIcon
            alt={appLabel(app)}
            src={app.image}
            icon={app.icon}
            aria-pressed={$use(() => (app.instances.some(isFrontWindow) ? 'true' : 'false'))}
            size={props.size}
            color={props.color}
            className={CLASS.TASK}
            onClick={() => focusApp(app)}
          />
        )}
      </For>
    </div>
  );
}, 'DockTasks');
