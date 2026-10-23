import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES, VARIANTS } from '@airlib/aui/utils';
import { $bind, type AnyType, type Bindable, For, Show, Slot, Snippet, setup } from '@airlib/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { AppsIcon, MicIcon, SendIcon } from '../icons/index.js';
import { Button } from '../widgets/Button.js';
import { Toggle } from '../widgets/Toggle.js';
import { Menu, MenuButton, MenuItem, MenuPanel } from './Menu.js';
import { appLabel, focusApp, isFrontWindow, openWindows, type WindowApp, windowApps } from './WindowManager.js';

export type DockSlots = {
  /** Replaces the start menu. */
  start: () => ReactNode;
  /** Replaces the running-apps strip. */
  tasks: () => ReactNode;
};

export type DockProps = ComponentStyles & {
  /** Names the dock for screen readers, e.g. "Dock". */
  label?: string;
  /** Apps the start menu lists and the dock shows when running. Defaults to every defined window. */
  apps?: WindowApp[];
  /** Names the start button; without it, no start menu is drawn. */
  startLabel?: string;
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
  /** Called with the prompt's text when it is sent. The prompt clears afterwards. */
  onsubmit?: (event: CustomEvent<string>) => void;
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
  onsubmit?: (event: CustomEvent<string>) => void;
};

export type DockStartProps = ComponentStyles & {
  /** Names the start button. */
  'aria-label'?: string;
  apps?: WindowApp[];
};

export type DockTasksProps = ComponentStyles & {
  apps?: WindowApp[];
};

const DOCK = 'aui-dock';
const CLASS = {
  PROMPT: `${DOCK}-prompt`,
  INPUT: `${DOCK}-input`,
  START: `${DOCK}-start`,
  APP: `${DOCK}-app`,
  APP_ICON: `${DOCK}-app-icon`,
  TASKS: `${DOCK}-tasks`,
  TASK: `${DOCK}-task`,
  GLYPH: `${DOCK}-glyph`,
};

const DOCK_OMIT = [
  ...OMIT_KEYS,
  'apps',
  'startLabel',
  'promptLabel',
  'voiceLabel',
  'submitLabel',
  'value',
  'listening',
  'onsubmit',
];

register('dock', { size: SIZES.MD, color: COLORS.PRIMARY });
register('dockButton', { size: SIZES.MD, color: COLORS.PRIMARY, variant: VARIANTS.TEXT });

/**
 * The desktop's one input surface, centered at the bottom: a start menu that
 * opens apps, a prompt that takes typed or spoken requests, and the running
 * apps. Every part appears when you name it.
 */
export const Dock = setup<DockProps, DockSlots>((props, slots) => {
  const className = () => $families(DOCK, { size: props.size, color: props.color, className: props.className }, auiConfig.dock);

  return () => (
    <div role="group" aria-label={props.label} className={className()}>
      <Show
        when={() => props.children}
        fallback={() => (
          <>
            <Slot for={() => slots.start?.()}>
              <Show when={() => props.startLabel}>
                {(label) => <DockStart aria-label={label} apps={props.apps} size={props.size} color={props.color} />}
              </Show>
            </Slot>
            <DockPrompt
              label={props.promptLabel}
              placeholder={props.placeholder}
              voiceLabel={props.voiceLabel}
              submitLabel={props.submitLabel}
              value={$bind(props, 'value')}
              listening={$bind(props, 'listening')}
              onsubmit={props.onsubmit}
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
  );
}, 'Dock');

/**
 * The prompt: a field that grows with its text, an optional voice toggle,
 * and an optional send button. Enter sends; Shift+Enter adds a line.
 */
export const DockPrompt = setup<DockPromptProps>((props) => {
  const input = aria('text-input', props as AnyType);

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    props.onsubmit?.(new CustomEvent('submit', { detail: text }));
    input.value = '';
    const element = input.current as HTMLTextAreaElement | null;
    if (element) element.value = '';
  };

  // Enter sends like a chat field; the part has no keymap of its own for it.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return () => (
    <div className={CLASS.PROMPT}>
      <textarea
        ref={input.ref as AnyType}
        {...input.restProps([...OMIT_KEYS, 'value', 'voiceLabel', 'submitLabel', 'listening', 'onsubmit'] as never)}
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
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
          >
            <MicIcon />
          </Toggle>
        )}
      </Show>
      <Show when={() => props.submitLabel}>
        {(label) => (
          <Button
            aria-label={label}
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
            onClick={submit}
          >
            <SendIcon />
          </Button>
        )}
      </Show>
    </div>
  );
}, 'DockPrompt');

/**
 * The start menu: a button that lists every app and opens the one picked.
 * Name the button with `aria-label`.
 */
export const DockStart = setup<DockStartProps>((props) => {
  const apps = () => props.apps ?? windowApps;
  const launch = (event: CustomEvent<string>) => apps().find((app) => app.name === event.detail)?.open();

  return () => (
    <Menu oncommand={launch} size={props.size} color={props.color} variant={VARIANTS.TEXT}>
      <MenuButton aria-label={props['aria-label']} className={`${CLASS.START} ${AUI_CLASS.CONTROL_ICON}`}>
        <AppsIcon />
      </MenuButton>
      <MenuPanel>
        <For each={apps}>
          {(app) => (
            <MenuItem name={app.name}>
              <span className={CLASS.APP_ICON} aria-hidden="true">
                {app.icon ?? appLabel(app).slice(0, 1)}
              </span>
              {appLabel(app)}
            </MenuItem>
          )}
        </For>
      </MenuPanel>
    </Menu>
  );
}, 'DockStart');

/**
 * Running apps, one icon each, mac-style: pressing an icon brings the app
 * forward, puts its window away when it is already in front, and cycles
 * through its windows when it has several. A dot marks the app in front.
 */
export const DockTasks = setup<DockTasksProps>((props) => {
  const running = () =>
    (props.apps ?? windowApps).filter((app) => openWindows.some((instance) => instance.app.name === app.name));

  return () => (
    <div className={CLASS.TASKS}>
      <For each={running}>
        {(app) => (
          <Snippet>
            {() => (
              <button
                type="button"
                className={CLASS.TASK}
                aria-label={appLabel(app)}
                aria-pressed={app.instances.some(isFrontWindow) ? 'true' : 'false'}
                onClick={() => focusApp(app)}
              >
                {app.icon ?? <span className={CLASS.GLYPH}>{appLabel(app).slice(0, 1)}</span>}
              </button>
            )}
          </Snippet>
        )}
      </For>
    </div>
  );
}, 'DockTasks');
