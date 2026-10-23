import { $static, createContext, mutable } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { CodeInputCellAria, type CodeInputCellOptions, type CodeInputCellProps } from './cell.js';

const ROLE_GROUP = 'group';
const CELL_SELECTOR = ':is(input:not(:disabled), [role="textbox"]:not([aria-disabled="true"]))';
const DEFAULT_LENGTH = 6;
const DEFAULT_KIND = 'numeric';
const NUMERIC_CHAR = /^[0-9]$/;
const ALPHANUMERIC_CHAR = /^[0-9a-zA-Z]$/;
/**
 * Character set accepted by a CodeInput coordinator.
 */
export type CodeInputKind = 'numeric' | 'alphanumeric';

/**
 * Controller-dispatched code-input event carrying the committed code string in `detail`.
 */
export type CodeInputEvent = AriaEvent<string>;

/**
 * Ambient instance context for the enclosing CodeInput coordinator.
 */
export const codeInputCtx = createContext<CodeInputAria>();

/**
 * Reactive input properties for CodeInputAria.
 */
export interface CodeInputProps extends AriaProps {
  /**
   * Current code string.
   */
  value?: string;

  /**
   * Number of character positions.
   *
   * @default 6
   */
  length?: number;

  /**
   * Allowed character set.
   *
   * @default 'numeric'
   */
  kind?: CodeInputKind;

  /**
   * Whether the code input group and all cells are disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Whether the code input is read-only (focusable and navigable, but blocks edits).
   */
  readonly?: boolean;

  /**
   * Whether the characters are hidden as they are entered, for secrets such as a PIN. Masked
   * cells are password fields and turn the one-time-code autofill off.
   */
  masked?: boolean;

  /**
   * Accessible label announced for the group and used to derive cell labels.
   */
  label?: string;

  /**
   * Called after an edit commits a different code string.
   */
  oninput?: AriaEventHandler<CodeInputEvent>;

  /**
   * Called when focus leaves the field and the code differs from focus-entry.
   */
  onchange?: AriaEventHandler<CodeInputEvent>;

  /**
   * Called after an edit yields a different code whose length equals `length`.
   */
  oncomplete?: AriaEventHandler<CodeInputEvent>;
}

/**
 * Compiled HTML and ARIA attributes for the CodeInput group container.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface CodeInputAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: 'group';
  'aria-label'?: string;
  'aria-disabled': 'true' | 'false';
}
/**
 * Headless segmented code-entry coordinator that manages character distribution,
 * paste/autofill slicing, contiguous deletion, single-tab-stop roving focus,
 * and lifecycle events (`input`, `change`, `complete`) across child cells.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class CodeInputAria<
  E extends BaseElement = HTMLElement,
  T extends CodeInputProps = CodeInputProps,
  A extends CodeInputAttributes<E> = CodeInputAttributes<E>,
> extends Aria<E, T, A> {
  protected state = mutable<{ focusedIndex: number | null }>({ focusedIndex: null });
  protected entryValue?: string;

  /**
   * Current sanitized code string (contiguous valid prefix up to `length`).
   */
  public get value(): string {
    return this.sanitizePrefix(this.properties.value ?? '');
  }

  /**
   * Programmatically updates the code string.
   */
  public set value(next: string) {
    this.properties.value = this.sanitizePrefix(next);
  }

  /**
   * Number of character positions in the code.
   */
  public get length(): number {
    return this.properties.length!;
  }

  /**
   * Active character set constraint ('numeric' | 'alphanumeric').
   */
  public get kind(): CodeInputKind {
    return this.properties.kind!;
  }

  /**
   * Whether the code input is disabled from interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Whether the code input is read-only.
   */
  public get readonly(): boolean {
    return !!this.properties.readonly;
  }

  /**
   * Whether the characters are hidden as they are entered.
   */
  public get masked(): boolean {
    return !!this.properties.masked;
  }

  /**
   * Active tab-stop cell index: the currently focused cell, or before focus
   * the first unfilled cell (clamped to the last cell when full).
   */
  public get activeIndex(): number {
    const len = this.length;
    if (this.state.focusedIndex !== null && this.state.focusedIndex < len) {
      return this.state.focusedIndex;
    }
    return Math.min(this.value.length, Math.max(0, len - 1));
  }

  public constructor(props: Partial<T> = {}, options: AriaOptions = {}) {
    super(props, options);

    $static(() => {
      if (this.properties.length == null) this.properties.length = DEFAULT_LENGTH;
      if (this.properties.kind == null) this.properties.kind = DEFAULT_KIND;
      if (this.properties.value != null) {
        this.properties.value = this.sanitizePrefix(this.properties.value);
      }
    });

    codeInputCtx.set(this as never);
    this.omittedAttrs.push(
      'value',
      'length',
      'kind',
      'disabled',
      'readonly',
      'masked',
      'label',
      'oninput',
      'onchange',
      'oncomplete'
    );
    this.on('keydown', this.handleKeyDown);
    this.update();
  }

  /**
   * Spawns a child cell controller bound to this CodeInput coordinator.
   *
   * @param props - Cell index configuration
   * @param options - Native vs custom host options
   * @returns Configured CodeInputCellAria controller
   */
  public cell<CE extends BaseElement = HTMLInputElement>(
    props: CodeInputCellProps,
    options?: CodeInputCellOptions
  ): CodeInputCellAria<CE> {
    codeInputCtx.set(this as never);
    return new CodeInputCellAria<CE>(props, options);
  }

  /**
   * Moves DOM focus and the roving tab stop to the target cell index via live DOM query.
   *
   * @param index - Target zero-based cell index
   */
  public focusCell(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.length - 1));
    this.state.focusedIndex = clamped;
    const cells = this.element?.querySelectorAll<HTMLElement>(CELL_SELECTOR);
    cells?.[clamped]?.focus();
  }

  /**
   * Handles focus entering a cell, recording the initial field value when entering from outside.
   *
   * @param index - Focused cell index
   */
  public handleCellFocus(index: number): void {
    if (this.entryValue === undefined) {
      this.entryValue = this.value;
    }
    this.state.focusedIndex = index;
  }

  /**
   * Handles focus leaving a cell, firing `change` when focus leaves the group with a modified code.
   *
   * @param event - FocusEvent from the blurring cell
   */
  public handleCellBlur(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related && this.element?.contains(related)) {
      return;
    }

    this.state.focusedIndex = null;
    const current = this.value;
    if (this.entryValue !== undefined && current !== this.entryValue) {
      this.entryValue = current;
      this.notify('change', current);
    }
  }

  /**
   * Distributes a typed, pasted, or autofilled string starting at `index`.
   *
   * @param index - Receiving zero-based cell index
   * @param raw - Raw input string from the cell
   * @returns Whether the input accepted at least one valid character
   */
  public distribute(index: number, raw: string): boolean {
    const accepted = this.filterChars(raw);
    if (accepted.length === 0) return false;

    const current = this.value;
    const start = Math.min(index, current.length);
    const before = current.slice(0, start);
    const after = current.slice(start + accepted.length);
    const next = (before + accepted + after).slice(0, this.length);

    this.commitEdit(next);

    const nextFocus = Math.min(start + accepted.length, this.length - 1, next.length);
    this.focusCell(nextFocus);
    return true;
  }

  /**
   * Removes the character at `index` and shifts subsequent characters left.
   *
   * @param index - Zero-based position to remove
   */
  public removeAt(index: number): void {
    const current = this.value;
    if (index < 0 || index >= current.length) return;
    const next = current.slice(0, index) + current.slice(index + 1);
    this.commitEdit(next);
  }

  /**
   * Tests whether a single character satisfies the active `kind` constraint.
   *
   * @param char - Single character to validate
   * @returns True if valid for the current kind
   */
  public isValidChar(char: string): boolean {
    const pattern = this.kind === 'alphanumeric' ? ALPHANUMERIC_CHAR : NUMERIC_CHAR;
    return pattern.test(char);
  }

  protected handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented) return;
    const maxPos = Math.min(this.value.length, this.length - 1) + 1;
    handleRovingKey(this.element, event, {
      selector: `${CELL_SELECTOR}:nth-child(-n+${maxPos})`,
      orientation: 'horizontal',
      manual: true,
      loop: false,
    });
  };

  protected sanitizePrefix(raw: string): string {
    const max = this.length;
    let result = '';
    for (let i = 0; i < raw.length && result.length < max; i++) {
      const ch = raw[i];
      if (!this.isValidChar(ch)) break;
      result += ch;
    }
    return result;
  }

  protected filterChars(raw: string): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (this.isValidChar(ch)) {
        result += ch;
      }
    }
    return result;
  }

  protected commitEdit(next: string): void {
    const prev = this.value;
    this.properties.value = next;
    if (next !== prev) {
      this.notify('input', next);
      if (next.length === this.length) {
        this.notify('complete', next);
      }
    }
  }

  protected notify(type: 'input' | 'change' | 'complete', detail: string): void {
    const event = new CustomEvent<string>(type, { bubbles: true, cancelable: true, detail });
    this.element?.dispatchEvent(event);
    this.dispatch(event);
  }

  protected override capture(event: AriaEvent): void {
    super.capture(event);
    if (event.type === 'complete') {
      this.properties.oncomplete?.(event as CodeInputEvent);
    }
  }

  protected override createAttributes(): A {
    return {
      role: ROLE_GROUP,
      'aria-label': this.properties.label,
      'aria-disabled': ariaBoolean(this.disabled),
    } as A;
  }
}
