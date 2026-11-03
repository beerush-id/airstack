import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { openDragSession } from '../../utils/pointer.js';
import { TIME_PART, timePickerCtx } from './picker.js';

/** How long typed digits keep building one token. */
const TYPEAHEAD_TIMEOUT = 1000;
/** Pixels of vertical drag per token. */
const DRAG_STEP = 16;
/** Wheel distance per token, so a trackpad's small deltas add up to steps. */
const WHEEL_STEP = 40;
/** What an unset part shows, on a native host. */
const PLACEHOLDER = '--';

/**
 * Reactive input properties for TimeSegmentAria.
 */
export interface TimeSegmentProps extends AriaProps {
  /**
   * The part this segment edits: 0 the hour, 1 the minute, 2 the period.
   */
  index?: number;

  /**
   * Accessible name for the segment; without it, its part's name from the picker's `labels`.
   */
  label?: string;
}

/**
 * Behavioral configuration options for TimeSegmentAria.
 */
export interface TimeSegmentOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a time segment.
 *
 * @template E - Target Element type
 */
export interface TimeSegmentAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'spinbutton';
  tabindex?: number;
  value?: string;
  placeholder?: string;
  inputmode?: 'numeric' | 'text';
  autocomplete?: 'off';
  'aria-label'?: string;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless spinbutton for one part of the enclosing TimePicker's time. It reads only
 * the token at its index and writes through the picker's `setPart`: arrows and the
 * wheel step through the part's token list with wrap, a vertical drag scrubs it, and
 * typing sets it — digits build any hour or minute the part can hold, off the step
 * too, and move on once another digit could only overflow it; letters pick a period.
 * On a native `<input>` it shows the part as the input's value, and typing reaches it
 * from any keyboard, on-screen ones included, without ever editing the text itself.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class TimeSegmentAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  TimeSegmentProps,
  TimeSegmentAttributes<E>,
  TimeSegmentOptions
> {
  private readonly host = timePickerCtx.get();
  private buffer = '';
  private typedAt = 0;
  private wheeled = 0;

  public constructor(props: Partial<TimeSegmentProps> = {}, options: TimeSegmentOptions = {}) {
    super(props, { native: false, ...options });

    this.omittedAttrs.push(
      'index',
      'label',
      'role',
      'tabindex',
      'value',
      'placeholder',
      'inputmode',
      'autocomplete',
      'aria-label',
      'aria-valuenow',
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuetext',
      'aria-disabled'
    );

    this.update();
  }

  /**
   * The part this segment edits.
   */
  public get index(): number {
    return this.properties.index ?? TIME_PART.HOUR;
  }

  /**
   * The tokens this part steps through, in order.
   */
  public get tokens(): string[] {
    return this.host?.tokens(this.index) ?? [];
  }

  /**
   * This part's token, or undefined while no time is set.
   */
  public get token(): string | undefined {
    return this.host?.parts[this.index];
  }

  /**
   * This segment's name: its own `label`, else its part's name from the picker.
   */
  public get label(): string | undefined {
    return this.properties.label ?? this.host?.partLabel(this.index);
  }

  /**
   * What this part reads as — a period's locale name, or the token — or an empty
   * string while no time is set.
   */
  public get text(): string {
    const token = this.token;
    return token === undefined ? '' : (this.host?.textOf(this.index, token) ?? token);
  }

  /**
   * Whether user interaction is disabled.
   */
  public get disabled(): boolean {
    return !!this.host?.disabled;
  }

  /**
   * Steps this part through its token list, wrapping at either end. An unset part
   * starts at the first token stepping up and the last stepping down; an off-list
   * token steps to its neighbour on the list.
   *
   * @param delta - Tokens to move; negative steps down.
   */
  public step(delta: number): void {
    const { tokens, token } = this;
    const count = tokens.length;
    if (!count || !delta) return;

    if (token === undefined) {
      this.write(tokens[delta > 0 ? 0 : count - 1]);
      return;
    }

    let position = tokens.indexOf(token);
    if (position < 0) {
      // The position just below the token, so a step up lands above it and a step down below it.
      position = tokens.filter((candidate) => candidate < token).length - (delta > 0 ? 1 : 0);
    }

    this.write(tokens[(((position + delta) % count) + count) % count]);
  }

  /**
   * Computes the spinbutton attributes and gestures for the segment.
   */
  protected override createAttributes(): TimeSegmentAttributes<E> {
    const { tokens, token, index } = this;
    const period = index === TIME_PART.PERIOD;
    const [min, max] = this.host?.bounds(index) ?? [0, 0];
    const attrs = Object.assign(super.createAttributes(), {
      role: 'spinbutton',
      'aria-label': this.label,
      'aria-valuenow': token === undefined ? undefined : period ? tokens.indexOf(token) : Number(token),
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuetext': token === undefined ? undefined : this.text,
      'aria-disabled': ariaBoolean(this.disabled),
      onkeydown: this.handleKey,
      onpointerdown: this.handlePointer,
    });

    if (this.isNative) {
      return Object.assign(attrs, {
        value: this.text,
        placeholder: PLACEHOLDER,
        inputmode: period ? 'text' : 'numeric',
        autocomplete: 'off',
        disabled: this.disabled,
        onbeforeinput: this.handleInput,
      }) as TimeSegmentAttributes<E>;
    }

    return Object.assign(attrs, { tabindex: this.disabled ? -1 : 0 }) as TimeSegmentAttributes<E>;
  }

  /**
   * Steps on the wheel while the segment has focus, so scrolling past it still scrolls the page.
   */
  protected override attach(): DetachFn {
    const element = this.element as unknown as HTMLElement;
    const wheel = (event: WheelEvent) => {
      if (this.disabled || element.ownerDocument.activeElement !== element) return;
      event.preventDefault();

      this.wheeled += event.deltaY;
      const steps = Math.trunc(this.wheeled / WHEEL_STEP);
      this.wheeled -= steps * WHEEL_STEP;
      this.step(-steps);
    };

    // Not passive, so the wheel steps the segment instead of scrolling.
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }

  private write(token: string): void {
    this.host?.setPart(this.index, token);
  }

  /**
   * Picks a token from a typed key.
   *
   * @param key - The key typed.
   * @returns Whether the key picked or built a token.
   */
  private type(key: string): boolean {
    const now = Date.now();
    if (now - this.typedAt > TYPEAHEAD_TIMEOUT) this.buffer = '';
    this.typedAt = now;

    const { tokens, index } = this;

    if (index === TIME_PART.PERIOD) {
      const typed = key.toLowerCase();
      const match = tokens.find(
        (token) => token.startsWith(typed) || this.host?.textOf(index, token).toLowerCase().startsWith(typed)
      );
      if (match) this.write(match);
      return !!match;
    }

    if (!/^\d$/.test(key)) return false;

    // Typing takes any number the part can hold, off the step too: the step is for stepping, and what people type is what they mean.
    const [min, max] = this.host?.bounds(index) ?? [0, 0];
    const holds = (value: number) => value >= min && value <= max;
    // A digit that can't extend what was typed starts a new number.
    const buffer = holds(Number(this.buffer + key)) ? this.buffer + key : key;
    const value = Number(buffer);
    if (holds(value)) this.write(String(value).padStart(2, '0'));

    // Done once another digit could only overflow the part.
    if (buffer.length >= 2 || value * 10 > max) {
      this.buffer = '';
      if (holds(value)) this.host?.focusPart(index + 1);
    } else {
      this.buffer = buffer;
    }

    return true;
  }

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;

    const { tokens, index } = this;
    // A page is a quarter of the list: 15 minutes, 6 hours of a day.
    const page = Math.max(1, Math.round(tokens.length / 4));

    switch (event.key) {
      case 'ArrowUp':
        this.step(1);
        break;
      case 'ArrowDown':
        this.step(-1);
        break;
      case 'PageUp':
        this.step(page);
        break;
      case 'PageDown':
        this.step(-page);
        break;
      case 'Home':
        this.write(tokens[0]);
        break;
      case 'End':
        this.write(tokens[tokens.length - 1]);
        break;
      case 'ArrowLeft':
        this.host?.focusPart(index - 1);
        break;
      case 'ArrowRight':
        this.host?.focusPart(index + 1);
        break;
      default:
        if (!this.type(event.key)) return;
    }

    event.preventDefault();
  };

  /**
   * Text a native host would take — from an on-screen keyboard, a paste, or a key the
   * keydown didn't claim — is typed into the part instead; the host's text only ever
   * shows the part.
   */
  private readonly handleInput = (event: InputEvent): void => {
    event.preventDefault();
    if (this.disabled || !event.data) return;

    for (const key of event.data) this.type(key);
  };

  private readonly handlePointer = (event: PointerEvent): void => {
    if (this.disabled || event.button !== 0) return;

    const element = this.element as unknown as HTMLElement;
    let origin = event.clientY;

    // The press is the segment's: a native host neither selects its text nor starts a selection drag, and takes focus here.
    event.preventDefault();
    element.focus();

    openDragSession({
      host: element,
      startY: origin,
      orientation: 'vertical',
      // Dragging up steps up, a token per DRAG_STEP pixels.
      onMove: (move) => {
        const steps = Math.trunc((origin - move.clientY) / DRAG_STEP);
        if (!steps) return;
        origin -= steps * DRAG_STEP;
        this.step(steps);
      },
      onUp: () => {},
      onCancel: () => {},
    });
  };
}
