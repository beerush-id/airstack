import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { $bind, $use, type AnyType, type Bindable, For, Show, setup, teleport } from '@airlib/react';
import { $families, auiConfig, type ComponentStyles } from '../config.js';
import { MicIcon, SendIcon, StopIcon } from '../icons/index.js';
import { Button } from '../widgets/Button.js';
import { Spinner } from '../widgets/Spinner.js';
import { Toggle } from '../widgets/Toggle.js';
import {
  DockPromptEditor,
  type DockReference,
  type DockSuggestionFilters,
  ICON_CLASS,
  promptCtx,
} from './dock/prompt.js';
import type { WindowInstance } from './window/registry.js';

export type {
  DockReference,
  DockSuggestion,
  DockSuggestionFilter,
  DockSuggestionFilters,
  DockSuggestionScope,
} from './dock/prompt.js';

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
  /**
   * What each trigger character offers for the word it starts, e.g. `{ '/': commands, '@': files }`.
   * A pick goes into the prompt as a token, and reaches `onsubmit` in `references`.
   */
  filters?: DockSuggestionFilters;
  /** Names the suggestions for screen readers, e.g. "Suggestions". */
  suggestionsLabel?: string;
  /** The keys that bring the prompt into focus, shown at the empty field's end while it's elsewhere, e.g. "⌘K"; your app handles the keys. */
  shortcut?: string;
  onsubmit?: (event: DockSubmitEvent) => void;
  onstop?: (event: CustomEvent<void>) => void;
};

/**
 * A prompt sent from the dock: its text in `detail`, the window that was active when it was
 * sent, so the request can be about what the person is looking at, and what was picked into it.
 */
export type DockSubmitEvent = CustomEvent<string> & {
  /** The window in front when the prompt was sent; undefined when none was. */
  readonly activeWindow?: WindowInstance;
  /** The suggestions picked into the prompt and still in its text, in order. */
  readonly references: DockReference[];
};

const DOCK = 'aui-dock';
const CLASS = {
  PROMPT: `${DOCK}-prompt`,
  INPUT: `${DOCK}-input`,
  STOP: `${DOCK}-stop`,
  STATUS: `${DOCK}-status`,
  SUGGESTIONS: `${DOCK}-suggestions`,
  SUGGESTION: `${DOCK}-suggestion`,
  SUGGESTION_HINT: `${DOCK}-suggestion-hint`,
  SUGGESTION_ICON: ICON_CLASS,
};

register('dockSuggestions', { size: SIZES.MD, color: COLORS.PRIMARY });
register('dockSuggestion', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * The prompt: a field that grows with its text, an optional voice toggle,
 * and an optional send button. Enter sends; Shift+Enter adds a line. While
 * `busy`, a spinner leads the field, the send button becomes a stop button
 * when it's named, and Escape stops too; what's typed and sent meanwhile is a
 * follow-up for your app. While `speaking`, the voice button pulses, and
 * turning voice on then is how someone speaks over the assistant. With
 * `filters`, a word starting with a trigger character offers suggestions above
 * the prompt.
 */
export const DockPrompt = setup<DockPromptProps>((props) => {
  const prompt = new DockPromptEditor(props);
  promptCtx.set(prompt);

  return () => (
    <div className={CLASS.PROMPT}>
      <Show when={() => prompt.working}>
        {() => <Spinner label={props.busyLabel as string} size={props.size} color={props.color} />}
      </Show>
      <DockPromptField />
      <DockSuggestions />
      <Show when={() => props.voiceLabel}>
        {(label) => (
          <Toggle
            aria-label={label}
            pressed={$bind(props as AnyType, 'listening')}
            data-speaking={$use(() => (props.speaking ? 'true' : undefined))}
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
          >
            <MicIcon />
          </Toggle>
        )}
      </Show>
      <Show when={() => prompt.working && props.stopLabel}>
        {(label) => (
          <Button
            aria-label={label as string}
            size={props.size}
            color={props.color}
            className={`${CLASS.STOP} ${AUI_CLASS.CONTROL_ICON}`}
            onClick={() => prompt.stop()}
          >
            <StopIcon />
          </Button>
        )}
      </Show>
      <Show when={() => !(prompt.working && props.stopLabel) && props.submitLabel}>
        {(label) => (
          <Button
            aria-label={label as string}
            size={props.size}
            color={props.color}
            className={AUI_CLASS.CONTROL_ICON}
            onClick={() => void prompt.submit()}
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
 * Where the prompt is written. Its content is the person's, edited in place, with picked
 * suggestions as tokens inside it; nothing renders into it.
 */
const DockPromptField = setup(() => {
  const prompt = promptCtx.get() as DockPromptEditor;

  return () => (
    <div
      ref={prompt.ref}
      role="textbox"
      aria-multiline="true"
      aria-label={prompt.props.label}
      aria-placeholder={prompt.props.placeholder}
      data-shortcut={prompt.props.shortcut}
      contentEditable="plaintext-only"
      data-empty=""
      className={CLASS.INPUT}
    />
  );
}, 'DockPromptField');

/**
 * The suggestions for the word being typed, above the prompt while there are any. The caret
 * stays in the field: the keys there move through them, and pressing one picks it.
 */
const DockSuggestions = setup(() => {
  const prompt = promptCtx.get() as DockPromptEditor;
  const styles = () => ({ size: prompt.props.size, color: prompt.props.color });
  const listClass = () => $families([AUI_CLASS.PANEL, CLASS.SUGGESTIONS], styles(), auiConfig.dockSuggestions);
  const itemClass = () => $families([AUI_CLASS.ITEM, CLASS.SUGGESTION], styles(), auiConfig.dockSuggestion);

  // Teleported to the page, like every popup, so the dock's own glass can't stop it blurring what's behind.
  return () => (
    <Show when={() => prompt.state.items.length > 0}>
      {() =>
        teleport(
          <div
            id={prompt.id}
            role="listbox"
            aria-label={prompt.props.suggestionsLabel}
            className={listClass()}
            // Pressing keeps the caret in the field, so the pick goes where the word is.
            onMouseDown={(event) => event.preventDefault()}
          >
            <For each={() => prompt.state.items}>
              {(item) => (
                <div
                  id={prompt.optionId(prompt.state.items.indexOf(item))}
                  role="option"
                  aria-selected={prompt.state.active === item.value}
                  data-group-start={prompt.startsGroup(item) ? '' : undefined}
                  className={itemClass()}
                  onClick={() => prompt.pick(item.value)}
                >
                  {item.icon && (
                    <span className={CLASS.SUGGESTION_ICON} aria-hidden="true">
                      {typeof item.icon === 'string' ? <img src={item.icon} alt="" /> : item.icon}
                    </span>
                  )}
                  <span>
                    {prompt.state.char}
                    {item.label}
                  </span>
                  {item.hint && <span className={CLASS.SUGGESTION_HINT}>{item.hint}</span>}
                </div>
              )}
            </For>
          </div>
        )
      }
    </Show>
  );
}, 'DockSuggestions');
