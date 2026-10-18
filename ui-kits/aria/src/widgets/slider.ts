import { $static, createContext } from '@airlib/core';
import { Aria } from '../core.js';
import type {
  AriaAttributes,
  AriaEvent,
  AriaEventHandler,
  AriaOptions,
  AriaProps,
  BaseElement,
  DetachFn,
  Orientation,
} from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { openDragSession } from '../utils/pointer.js';
import { axisRatio, clampRange } from '../utils/range.js';

/**
 * Ambient instance context for the enclosing Slider coordinator.
 */
export const sliderCtx = createContext<SliderAria>();

/**
 * Controller-dispatched slider event carrying the committed value or
 * low/high tuple in `detail`.
 */
export type SliderEvent = AriaEvent<number | [number, number]>;

/**
 * Behavioral configuration options for SliderAria.
 */
export interface SliderOptions extends AriaOptions {}

/**
 * Reactive input properties for SliderAria.
 */
export interface SliderProps extends AriaProps {
  /**
   * Current numeric value or dual-thumb low/high tuple.
   */
  value?: number | [number, number];

  /**
   * Stepping axis and announced orientation.
   */
  orientation?: Orientation;

  /**
   * Inclusive lower bound.
   */
  min?: number;

  /**
   * Inclusive upper bound.
   */
  max?: number;

  /**
   * Arrow-key increment snapped from the lower bound.
   */
  step?: number;

  /**
   * Page-key increment in value units.
   */
  page?: number;

  /**
   * Readable value text, static or derived per endpoint.
   */
  valuetext?: string | ((val: number) => string);

  /**
   * Whether the slider is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Called after each committed step or drag move with the live value.
   */
  oninput?: AriaEventHandler<SliderEvent>;

  /**
   * Called when the interaction ends with a committed value.
   */
  onchange?: AriaEventHandler<SliderEvent>;
}

/**
 * Compiled HTML and ARIA attributes for slider track and native range elements.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SliderAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'group' | 'slider';
  type?: 'range';
  min?: number;
  max?: number;
  step?: number;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-orientation'?: Orientation;
}

/**
 * Compiled HTML and ARIA attributes for slider thumb elements.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface SliderThumbAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'slider';
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-orientation'?: Orientation;
}

/**
 * Headless bounded numeric entry coordinator owning clamping, stepping, and
 * endpoint state for single and dual-thumb configurations.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class SliderAria<
  E extends BaseElement = HTMLElement,
  T extends SliderProps = SliderProps,
  A extends SliderAttributes<E> = SliderAttributes<E>,
  O extends SliderOptions = SliderOptions,
> extends Aria<E, T, A, O> {
  private thumbCount = 0;

  private dirty = false;

  private dragIndex = 0;

  private closeDrag: () => void = () => {};

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: false,
      ...options,
      clickable: true,
    });
    sliderCtx.set(this as unknown as SliderAria);

    this.omittedAttrs.push('value', 'min', 'max', 'step', 'page', 'valuetext', 'orientation', 'oninput', 'onchange');
    this.update();
  }

  /**
   * Whether the slider coordinates a low/high thumb tuple.
   */
  public get isDual(): boolean {
    return Array.isArray(this.properties.value);
  }

  /**
   * Inclusive lower bound.
   */
  public get min(): number {
    return this.properties.min ?? 0;
  }

  /**
   * Inclusive upper bound.
   */
  public get max(): number {
    return this.properties.max ?? 100;
  }

  /**
   * Arrow-key increment.
   */
  public get step(): number {
    const step = this.properties.step;
    return typeof step === 'number' && step > 0 ? step : 1;
  }

  /**
   * Page-key increment in value units.
   */
  public get page(): number {
    return this.properties.page ?? 10;
  }

  /**
   * Stepping axis.
   */
  public get orientation(): Orientation {
    return this.properties.orientation ?? 'horizontal';
  }

  /**
   * Whether the slider is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Current value with bounds applied.
   */
  public get value(): number | [number, number] {
    const raw = this.properties.value ?? this.min;
    if (!Array.isArray(raw)) return this.clamp(raw);
    const low = this.clamp(raw[0]);
    const high = this.clamp(raw[1]);
    return low <= high ? [low, high] : [high, low];
  }

  public set value(next: number | [number, number]) {
    if (Array.isArray(next)) {
      const low = this.snap(this.clamp(next[0]));
      const high = this.snap(this.clamp(next[1]));
      const ordered: [number, number] = low <= high ? [low, high] : [high, low];
      const stored = this.properties.value;
      if (Array.isArray(stored)) {
        stored[0] = ordered[0];
        stored[1] = ordered[1];
        return;
      }
      this.properties.value = ordered;
      return;
    }
    this.properties.value = this.snap(this.clamp(next));
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the slider track.
   *
   * @returns Slider attributes dictionary
   */
  protected override createAttributes(): A {
    if (this.isNative) {
      const current = this.value;
      return Object.assign(super.createAttributes(), {
        type: 'range',
        min: this.min,
        max: this.max,
        step: this.step,
        disabled: this.disabled,
        value: Array.isArray(current) ? current[0] : current,
        oninput: this.handleInput,
      }) as A;
    }

    if (!this.isDual) {
      const current = this.value as number;
      const text = this.properties.valuetext;
      return Object.assign(super.createAttributes(), {
        role: 'slider' as const,
        tabindex: this.disabled ? -1 : 0,
        'aria-disabled': ariaBoolean(this.disabled),
        'aria-valuenow': current,
        'aria-valuemin': this.min,
        'aria-valuemax': this.max,
        'aria-valuetext': typeof text === 'function' ? text(current) : text,
        'aria-orientation': this.orientation,
        onkeydown: this.handleTrackKeyDown,
        onkeyup: this.handleTrackKeyUp,
        onblur: this.handleTrackBlur,
        onpointerdown: this.handleTrackPointerDown,
      }) as A;
    }

    return Object.assign(super.createAttributes(), {
      role: 'group' as const,
      onpointerdown: this.handleTrackPointerDown,
    }) as A;
  }

  /**
   * Compiled attributes with the internal numeric value withheld from spreads.
   */
  public override get attributes(): Record<string, unknown> {
    if (!this.isNative) return super.attributes as Record<string, unknown>;
    const { value, ...rest } = super.attributes as Record<string, unknown>;
    return rest;
  }

  /**
   * Claims the next endpoint index for a thumb in creation order.
   *
   * @returns Endpoint index owned by the claiming thumb
   */
  public claimThumb(): number {
    return $static(() => {
      const index = Math.min(this.thumbCount, this.isDual ? 1 : 0);
      this.thumbCount += 1;
      return index;
    });
  }

  protected override attach(): DetachFn | void {
    return () => this.closeDrag();
  }

  /**
   * Commits a raw endpoint reading through snapping, bounds, and tuple order.
   *
   * @param index - Endpoint index being committed
   * @param raw - Uncommitted endpoint reading
   * @returns Whether the commit changed the value
   */
  public commitEndpoint(index: number, raw: number): boolean {
    const next = this.snap(this.clamp(raw));
    if (this.isDual) {
      const stored = this.properties.value as [number, number];
      const current = this.value as [number, number];
      const low = index === 0 ? Math.min(next, current[1]) : current[0];
      const high = index === 0 ? current[1] : Math.max(next, current[0]);
      if (low === current[0] && high === current[1]) return false;
      stored[0] = low;
      stored[1] = high;
      return true;
    }
    if (next === this.value) return false;
    this.properties.value = next;
    return true;
  }

  private clamp(raw: number): number {
    return clampRange(raw, this.min, this.max);
  }

  private nearestIndex(raw: number): number {
    const current = this.value;
    if (!Array.isArray(current)) return 0;
    return Math.abs(raw - current[0]) <= Math.abs(raw - current[1]) ? 0 : 1;
  }

  private readonly handleTrackPointerDown = (e: PointerEvent): void => {
    if (this.disabled || e.target !== e.currentTarget || e.defaultPrevented) return;
    const host = e.currentTarget as HTMLElement;
    const ratio = axisRatio(host.getBoundingClientRect(), this.orientation, e.clientX, e.clientY);
    if (ratio === null) return;
    const raw = this.min + ratio * (this.max - this.min);
    this.dragIndex = this.nearestIndex(raw);
    if (this.commitEndpoint(this.dragIndex, raw)) {
      this.dirty = true;
      this.notifyTrackInput();
    }
    this.closeDrag = openDragSession({
      onMove: this.handleTrackPointerMove,
      onUp: this.handleTrackPointerUp,
      onCancel: this.handleTrackPointerCancel,
    });
  };

  private readonly handleTrackPointerMove = (e: PointerEvent): void => {
    if (this.disabled || e.defaultPrevented || e.buttons === 0) return;
    const ratio = axisRatio(this.current!.getBoundingClientRect(), this.orientation, e.clientX, e.clientY);
    if (ratio === null) return;
    if (this.commitEndpoint(this.dragIndex, this.min + ratio * (this.max - this.min))) {
      this.dirty = true;
      this.notifyTrackInput();
    }
  };

  private readonly handleTrackKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled || e.defaultPrevented) return;
    const raw = keyStepRaw(e.key, this.value as number, this);
    if (raw === undefined) return;
    e.preventDefault();
    if (this.commitEndpoint(0, raw)) {
      this.dirty = true;
      this.notifyTrackInput();
    }
  };

  private readonly handleTrackKeyUp = (e: KeyboardEvent): void => {
    if (!HANDLED_KEYS.includes(e.key)) return;
    this.commitTrackChange();
  };

  private readonly handleTrackBlur = (): void => {
    this.commitTrackChange();
  };

  private readonly handleTrackPointerUp = (): void => {
    this.commitTrackChange();
  };

  private readonly handleTrackPointerCancel = (): void => {
    this.dirty = false;
  };

  private commitTrackChange(): void {
    if (!this.dirty) return;
    this.dirty = false;
    dispatchSlider(this.element!, 'change', this.value, this.properties.onchange);
  }

  private notifyTrackInput(): void {
    dispatchSlider(this.element!, 'input', this.value, this.properties.oninput);
  }

  private snap(raw: number): number {
    const step = this.step;
    const snapped = this.min + Math.round((raw - this.min) / step) * step;
    return Number(snapped.toFixed(10));
  }

  private readonly handleInput = (e: Event): void => {
    if (this.disabled) return;
    this.properties.value = this.clamp(Number((e.currentTarget as HTMLInputElement).value));
  };
}

/**
 * Headless slider thumb controller discovering its coordinator from ambient
 * scope, owning keyboard stepping, pointer drag, and interaction events.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SliderThumbAria<E extends BaseElement = HTMLElement> extends Aria<
  E,
  AriaProps,
  SliderThumbAttributes<E>,
  AriaOptions
> {
  private readonly slider: SliderAria | null = sliderCtx.get() ?? null;

  private readonly index: number;

  private dirty = false;

  public constructor(props: Partial<AriaProps> = {}) {
    super(props, { native: false, clickable: true });
    this.index = this.slider ? this.slider.claimThumb() : 0;
    this.update();
  }

  /**
   * Whether the enclosing slider has locked this thumb out of interaction.
   */
  public get disabled(): boolean {
    return !!this.slider?.disabled;
  }

  /**
   * Current endpoint value read from the coordinator.
   */
  public get endpoint(): number | undefined {
    if (!this.slider) return undefined;
    const current = this.slider.value;
    return Array.isArray(current) ? current[this.index] : current;
  }

  /**
   * Endpoint position as a percentage along the declared range, matching the
   * numeric content of the published offset variable.
   */
  public get offset(): number {
    if (!this.slider) return 0;
    const span = this.slider.max - this.slider.min;
    if (span <= 0) return 0;
    return Number(((((this.endpoint as number) - this.slider.min) / span) * 100).toFixed(4));
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the thumb.
   *
   * @returns Thumb attributes dictionary
   */
  protected override createAttributes(): SliderThumbAttributes<E> {
    const slider = this.slider;
    if (slider && !slider.isDual) {
      const span = slider.max - slider.min;
      const ratio = span > 0 ? ((slider.value as number) - slider.min) / span : 0;
      return Object.assign(super.createAttributes(), {
        'aria-disabled': ariaBoolean(slider.disabled),
        style: { '--aria-slider-thumb-offset': `${Number((ratio * 100).toFixed(4))}%` },
        onpointerdown: this.handlePointerDown,
      }) as SliderThumbAttributes<E>;
    }

    const isDisabled = !!slider?.disabled;
    const attrs: Record<string, unknown> = {
      role: 'slider',
      tabindex: isDisabled ? -1 : 0,
      'aria-disabled': ariaBoolean(isDisabled),
    };

    if (slider) {
      const current = slider.value as [number, number];
      const endpoint = current[this.index];
      const tightMin = slider.isDual && this.index === 1 ? (current as [number, number])[0] : slider.min;
      const tightMax = slider.isDual && this.index === 0 ? (current as [number, number])[1] : slider.max;
      const text = slider.properties.valuetext;
      const span = slider.max - slider.min;
      const ratio = span > 0 ? (endpoint - slider.min) / span : 0;
      Object.assign(attrs, {
        'aria-valuenow': endpoint,
        'aria-valuemin': tightMin,
        'aria-valuemax': tightMax,
        'aria-valuetext': typeof text === 'function' ? text(endpoint) : text,
        'aria-orientation': slider.orientation,
        style: { '--aria-slider-thumb-offset': `${Number((ratio * 100).toFixed(4))}%` },
        onkeydown: this.handleKeyDown,
        onkeyup: this.handleKeyUp,
        onblur: this.handleBlur,
        onpointerdown: this.handlePointerDown,
      });
    }

    return Object.assign(super.createAttributes(), attrs) as SliderThumbAttributes<E>;
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const slider = this.slider;
    if (!slider || slider.disabled || e.defaultPrevented) return;
    const endpoint = this.endpoint!;

    const raw = keyStepRaw(e.key, endpoint, slider);
    if (raw === undefined) return;

    e.preventDefault();
    if (slider.commitEndpoint(this.index, raw)) {
      this.dirty = true;
      this.notifyInput();
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    if (!HANDLED_KEYS.includes(e.key)) return;
    this.commitChange();
  };

  private readonly handleBlur = (): void => {
    this.commitChange();
  };

  private closeDrag: () => void = () => {};

  protected override attach(): DetachFn | void {
    return () => this.closeDrag();
  }

  private readonly handlePointerDown = (e: PointerEvent): void => {
    const slider = this.slider;
    if (!slider || slider.disabled || e.defaultPrevented) return;
    (e.currentTarget as HTMLElement).focus?.();
    this.closeDrag = openDragSession({
      onMove: this.handlePointerMove,
      onUp: this.handlePointerUp,
      onCancel: this.handlePointerCancel,
    });
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    const slider = this.slider;
    if (!slider || slider.disabled || e.defaultPrevented || e.buttons === 0) return;
    const track = slider.current;
    if (!track) return;
    const ratio = axisRatio(track.getBoundingClientRect(), slider.orientation, e.clientX, e.clientY);
    if (ratio === null) return;
    if (slider.commitEndpoint(this.index, slider.min + ratio * (slider.max - slider.min))) {
      this.dirty = true;
      this.notifyInput();
    }
  };

  private readonly handlePointerUp = (): void => {
    this.commitChange();
  };

  private readonly handlePointerCancel = (): void => {
    this.dirty = false;
  };

  private commitChange(): void {
    if (!this.dirty) return;
    this.dirty = false;
    dispatchSlider(this.element!, 'change', this.slider!.value, this.slider!.properties.onchange);
  }

  private notifyInput(): void {
    dispatchSlider(this.element!, 'input', this.slider!.value, this.slider!.properties.oninput);
  }
}

/**
 * Dispatches a committed slider value on the given target and invokes the matching
 * consumer handler with it.
 *
 * @param target - Element carrying the dispatched event
 * @param type - Commit kind: live `input` or released `change`
 * @param value - Committed value or low/high tuple
 * @param handler - Consumer callback for this commit kind
 */
function dispatchSlider(
  target: Element,
  type: 'input' | 'change',
  value: number | [number, number],
  handler?: AriaEventHandler<SliderEvent>
): void {
  const event: SliderEvent = new CustomEvent(type, { bubbles: true, detail: value, cancelable: true });
  target.dispatchEvent(event);
  handler?.(event);
}

const HANDLED_KEYS = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

function keyStepRaw(
  key: string,
  endpoint: number,
  slider: Pick<SliderAria, 'step' | 'page' | 'min' | 'max'>
): number | undefined {
  if (key === 'ArrowRight' || key === 'ArrowUp') return endpoint + slider.step;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return endpoint - slider.step;
  if (key === 'PageUp') return endpoint + slider.page;
  if (key === 'PageDown') return endpoint - slider.page;
  if (key === 'Home') return slider.min;
  if (key === 'End') return slider.max;
  return undefined;
}
