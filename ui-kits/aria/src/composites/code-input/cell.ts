import { $static } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { maintainCursor } from '../../utils/input.js';
import { type CodeInputAria, codeInputCtx } from './host.js';

const ROLE_TEXTBOX = 'textbox';
/**
 * Reactive input properties for CodeInputCellAria.
 */
export interface CodeInputCellProps extends AriaProps {
  /**
   * Zero-based character position index within the code input.
   */
  index: number;
}

/**
 * Behavioral configuration options for CodeInputCellAria.
 */
export interface CodeInputCellOptions extends AriaOptions {
  /**
   * Whether bound to a native `<input>` element.
   *
   * @default true
   */
  native?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for an individual CodeInput cell.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 */
export interface CodeInputCellAttributes<E extends BaseElement = HTMLInputElement> extends AriaAttributes<E> {
  type?: 'text';
  role?: 'textbox';
  value?: string;
  inputmode: 'numeric' | 'text';
  autocomplete?: 'one-time-code';
  tabindex: number;
  disabled?: boolean;
  readonly?: boolean;
  contenteditable?: 'true' | 'false';
  'aria-label'?: string;
  'aria-disabled'?: 'true' | 'false';
  'aria-readonly'?: 'true' | 'false';
}
/**
 * Headless controller for an individual character cell inside a CodeInput group.
 *
 * @template E - Target Element type (defaults to HTMLInputElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 * @template O - Controller options type
 */
export class CodeInputCellAria<
  E extends BaseElement = HTMLInputElement,
  T extends CodeInputCellProps = CodeInputCellProps,
  A extends CodeInputCellAttributes<E> = CodeInputCellAttributes<E>,
  O extends CodeInputCellOptions = CodeInputCellOptions,
> extends Aria<E, T, A, O> {
  protected codeInput = codeInputCtx.get();

  /**
   * Zero-based position index of this cell.
   */
  public get index(): number {
    return this.properties.index!;
  }

  /**
   * Single character currently occupying this cell, or `''` when unfilled.
   */
  public get value(): string {
    return this.codeInput?.value[this.index] ?? '';
  }

  /**
   * Whether this cell is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.codeInput?.disabled;
  }

  public constructor(props: Partial<T> = {}, options: O = { native: true } as O) {
    super(props, { native: true, ...options, clickable: true });

    $static(() => {
      if (this.properties.index == null) this.properties.index = 0;
    });

    this.omittedAttrs.push('index');

    this.on('focus', this.handleFocus);
    this.on('blur', this.handleBlur as never);
    this.on('input', this.handleInput);
    this.on('keydown', this.handleKeyDown as never);
    this.on('paste', this.handlePaste as never);

    this.update();
  }

  protected override applyAttributes(): void {
    super.applyAttributes();
    if (!this.isNative && this.element) {
      const char = this.value;
      if (this.element.textContent !== char) {
        maintainCursor(() => {
          this.element!.textContent = char;
        });
      }
    }
  }

  protected syncElementValue(): void {
    /* istanbul ignore if */
    if (!this.element) return;
    if (this.isNative) {
      (this.element as unknown as HTMLInputElement).value = this.value;
    } else {
      this.element.textContent = this.value;
    }
  }

  protected handleFocus = (): void => {
    this.codeInput?.handleCellFocus(this.index);
  };

  protected handleBlur = (event: FocusEvent): void => {
    this.codeInput?.handleCellBlur(event);
  };

  protected handleInput = (event: Event): void => {
    event.stopPropagation();
    const group = this.codeInput;
    if (!group || group.disabled || group.readonly) {
      this.syncElementValue();
      return;
    }

    const data = (event as InputEvent).data;
    const raw =
      typeof data === 'string' && data.length > 0
        ? data
        : this.isNative
          ? (this.element as unknown as HTMLInputElement).value
          : this.element!.textContent!;

    group.distribute(this.index, raw);
    this.syncElementValue();
  };

  protected handlePaste = (event: ClipboardEvent): void => {
    const group = this.codeInput;
    if (!group || group.disabled || group.readonly || event.defaultPrevented) return;

    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || event.clipboardData?.getData('text') || '';
    group.distribute(this.index, text);
    this.syncElementValue();
  };

  protected handleKeyDown = (event: KeyboardEvent): void => {
    const group = this.codeInput;
    if (!group || group.disabled || group.readonly || event.defaultPrevented) return;

    const { key } = event;
    const currentVal = group.value;

    if (key === 'Backspace') {
      event.preventDefault();
      if (this.value !== '') {
        group.removeAt(this.index);
      } else if (this.index === currentVal.length && this.index > 0) {
        group.removeAt(this.index - 1);
        group.focusCell(this.index - 1);
      }
      this.syncElementValue();
      return;
    }

    if (key === 'Delete') {
      event.preventDefault();
      if (this.value !== '') {
        group.removeAt(this.index);
        this.syncElementValue();
      }
    }
  };

  protected override createAttributes(): A {
    const group = this.codeInput;
    const char = this.value;
    const isDisabled = !!group?.disabled;
    const isReadonly = !!group?.readonly;
    const isTabStop = !isDisabled && (group ? group.activeIndex === this.index : this.index === 0);
    const label = group?.properties.label
      ? `${group.properties.label}, character ${this.index + 1} of ${group.length}`
      : undefined;
    const inputmode = group?.kind === 'alphanumeric' ? 'text' : 'numeric';
    const autocomplete = this.index === 0 ? 'one-time-code' : undefined;

    if (this.isNative) {
      return {
        type: 'text',
        value: char,
        inputmode,
        autocomplete,
        tabindex: isTabStop ? 0 : -1,
        disabled: isDisabled,
        readonly: isReadonly,
        'aria-label': label,
      } as A;
    }

    return {
      role: ROLE_TEXTBOX,
      inputmode,
      autocomplete,
      tabindex: isTabStop ? 0 : -1,
      contenteditable: isDisabled || isReadonly ? 'false' : 'true',
      'aria-label': label,
      'aria-disabled': ariaBoolean(isDisabled),
      'aria-readonly': ariaBoolean(isReadonly),
    } as A;
  }
}
