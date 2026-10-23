import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup, template } from '@airlib/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { Button } from '../widgets/Button.js';
import { Toolbar } from '../widgets/Toolbar.js';

export type ComposerProps = ComponentStyles & {
  id?: string;
  /** Names the prompt for screen readers, e.g. "Describe the video". */
  label?: string;
  placeholder?: string;
  /** The prompt's text. */
  value?: Bindable<string>;
  /** How many lines the prompt shows before it scrolls. Defaults to 2. */
  rows?: number;
  /** Names the options row for screen readers, e.g. "Video settings". */
  optionsLabel?: string;
  /** The send button's words, e.g. "Generate". */
  submitLabel: string;
  /** A second line under the send button's words: what it costs, how long it takes. */
  submitMeta?: ReactNode;
  disabled?: boolean;
  /** Whether a sent prompt is still being worked on; the send button waits until it ends. */
  busy?: boolean;
  /** The options under the prompt — selects, toggles, steppers, at a small size. */
  children?: ReactNode;
  /** Called with the prompt's text when it's sent. */
  onsubmit?: (event: CustomEvent<string>) => void;
};

const TEXT_INPUT_ROLE = 'text-input';

const CLASS = {
  MAIN: branded('composer-main'),
  INPUT: branded('composer-input'),
  OPTIONS: branded('composer-options'),
  SUBMIT: branded('composer-submit'),
  SUBMIT_LABEL: branded('composer-submit-label'),
  SUBMIT_META: branded('composer-submit-meta'),
  DIVIDER: branded('composer-divider'),
};

register('composer', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * Where a request for something to be made is written: a prompt that grows with its text, the
 * options that shape the result in a row under it — model, size, length, count — and a send
 * button that carries what sending costs. Enter sends and Shift+Enter adds a line; the options
 * row is a toolbar, so the arrows move between its controls.
 */
export const Composer = setup<ComposerProps>((props) => {
  const input = aria(TEXT_INPUT_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.SCALE, AUI_CLASS.COMPOSER], { size: props.size, color: props.color, className: props.className }, auiConfig.composer);

  const submit = () => {
    const text = input.value.trim();
    if (!text || props.busy || props.disabled) return;
    props.onsubmit?.(new CustomEvent('submit', { detail: text }));
  };

  // Enter sends like a chat field; the part has no keymap of its own for it.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return () => (
    <div className={className()} data-busy={props.busy ? 'true' : undefined}>
      <div className={CLASS.MAIN}>
        <textarea
          ref={input.ref as AnyType}
          {...input.restProps([...OMIT_KEYS, 'value', 'rows', 'optionsLabel', 'submitLabel', 'submitMeta', 'busy', 'onsubmit'] as never)}
          placeholder={props.placeholder}
          rows={props.rows ?? 2}
          className={CLASS.INPUT}
          onKeyDown={handleKeyDown}
        />
        {props.children && (
          <Toolbar label={props.optionsLabel} variant="text" className={`${AUI_CLASS.TOOLBAR_OPTIONS} ${CLASS.OPTIONS}`}>
            {props.children}
          </Toolbar>
        )}
      </div>
      <Button
        size={props.size}
        color={props.color}
        disabled={props.disabled || props.busy}
        className={CLASS.SUBMIT}
        onClick={submit}
      >
        <span className={CLASS.SUBMIT_LABEL}>{props.submitLabel}</span>
        {props.submitMeta && <span className={CLASS.SUBMIT_META}>{props.submitMeta}</span>}
      </Button>
    </div>
  );
}, 'Composer');

/**
 * A thin rule between groups of options in the composer's row: what you attach, apart from how
 * it's made.
 */
export const ComposerDivider = template<Record<string, never>>(
  () => <span className={CLASS.DIVIDER} aria-hidden="true" />,
  'ComposerDivider'
);
