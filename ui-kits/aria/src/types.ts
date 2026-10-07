import type { AnyType, ClassInput, Primitive, StyleInput } from '@airlib/core';

export type { Primitive };

/**
 * Visual and keyboard navigation layout axis.
 */
export type Orientation = 'horizontal' | 'vertical';

/**
 * WAI-ARIA validation error indicator token.
 */
export type AriaInvalid = boolean | 'grammar' | 'spelling';

/**
 * Controller-dispatched DOM event carrying a committed value in `detail`.
 * Per-role aliases (e.g. `SliderEvent`) fix the payload for the role.
 *
 * @template T - Committed value type carried in `detail`
 */
export type AriaEvent<T = unknown> = CustomEvent<T>;

/**
 * Consumer callback for a controller-dispatched event. The role invokes it with the
 * dispatched event, so `detail` is typed at the call site without a cast and browser
 * events of the same name never reach it.
 *
 * @template T - Controller-dispatched event type
 */
export type AriaEventHandler<T extends Event> = (event: T) => void;

/**
 * Base reactive input properties for Aria controllers.
 */
export interface AriaProps {
  [key: string]: AnyType;
}

/**
 * Root DOM Element type supported by AirLib ARIA controllers (HTML or SVG).
 */
export type BaseElement = Element;

/**
 * Cleanup function signature returned by lifecycle attachment.
 */
export type DetachFn = () => void;

/**
 * Refinement callback signature to append user attributes or custom handlers.
 *
 * @template T - Reactive state type
 * @template A - Attributes dictionary type
 * @param props - Live reactive props of the controller
 * @param attrs - Current compiled attributes dictionary
 * @returns Partial attributes dictionary to merge
 */
export type RefineFn<T, A> = (props: T, attrs: A) => Partial<A> | void;

/**
 * Pluggable attribute translation callback.
 */
export type TranslateFn = (attrs: Record<string, unknown>) => Record<string, unknown>;

/**
 * Controller configuration options for Aria instances.
 */
export interface AriaOptions {
  /**
   * Whether the target element is a native HTML element for this role.
   */
  native?: boolean;
}

/**
 * Generic DOM event handler signature with strongly typed currentTarget element.
 *
 * @template Ev - Native Event type
 * @template E - Target Element type
 */
export type EventHandler<Ev extends Event = Event, E extends BaseElement = HTMLElement> = (
  event: Ev & { currentTarget: E }
) => void;

export type MouseEventHandler<E extends BaseElement = HTMLElement> = EventHandler<MouseEvent, E>;
export type KeyboardEventHandler<E extends BaseElement = HTMLElement> = EventHandler<KeyboardEvent, E>;
export type FocusEventHandler<E extends BaseElement = HTMLElement> = EventHandler<FocusEvent, E>;
export type PointerEventHandler<E extends BaseElement = HTMLElement> = EventHandler<PointerEvent, E>;
export type TouchEventHandler<E extends BaseElement = HTMLElement> = EventHandler<TouchEvent, E>;
export type WheelEventHandler<E extends BaseElement = HTMLElement> = EventHandler<WheelEvent, E>;
export type SubmitEventHandler<E extends BaseElement = HTMLElement> = EventHandler<SubmitEvent, E>;

/**
 * Standard native DOM event handlers strongly typed to the element type E.
 *
 * @template E - The target Element type
 */
export interface DOMEvents<E extends BaseElement = HTMLElement> {
  onclick?: MouseEventHandler<E>;
  ondblclick?: MouseEventHandler<E>;
  onmousedown?: MouseEventHandler<E>;
  onmouseup?: MouseEventHandler<E>;
  onmousemove?: MouseEventHandler<E>;
  onmouseenter?: MouseEventHandler<E>;
  onmouseleave?: MouseEventHandler<E>;
  oncontextmenu?: MouseEventHandler<E>;

  onkeydown?: KeyboardEventHandler<E>;
  onkeyup?: KeyboardEventHandler<E>;
  onkeypress?: KeyboardEventHandler<E>;

  onfocus?: FocusEventHandler<E>;
  onblur?: FocusEventHandler<E>;
  onfocusin?: FocusEventHandler<E>;
  onfocusout?: FocusEventHandler<E>;

  onpointerdown?: PointerEventHandler<E>;
  onpointerup?: PointerEventHandler<E>;
  onpointermove?: PointerEventHandler<E>;
  onpointerenter?: PointerEventHandler<E>;
  onpointerleave?: PointerEventHandler<E>;
  onpointercancel?: PointerEventHandler<E>;

  ontouchstart?: TouchEventHandler<E>;
  ontouchend?: TouchEventHandler<E>;
  ontouchmove?: TouchEventHandler<E>;
  ontouchcancel?: TouchEventHandler<E>;

  oninput?: EventHandler<Event, E>;
  onchange?: EventHandler<Event, E>;
  onsubmit?: SubmitEventHandler<E>;
  onreset?: EventHandler<Event, E>;
  onscroll?: EventHandler<Event, E>;
  onwheel?: WheelEventHandler<E>;
}

/**
 * Standard global attributes supported by HTML and SVG elements.
 *
 * @template E - Target Element type
 */
export interface GlobalHTMLAttributes<E extends BaseElement = HTMLElement> extends DOMEvents<E> {
  id?: string;
  class?: ClassInput;
  className?: ClassInput;
  style?: StyleInput;
  title?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  hidden?: boolean;
  tabindex?: number;
  tabIndex?: number;
  autofocus?: boolean;
  autoFocus?: boolean;
  spellcheck?: boolean;
  spellCheck?: boolean;
  contenteditable?: boolean | 'true' | 'false' | 'inherit';
  contentEditable?: boolean | 'true' | 'false' | 'inherit';
  draggable?: boolean;
  accesskey?: string;
  accessKey?: string;
  [dataKey: `data-${string}`]: unknown;
}

/**
 * Common HTML, SVG, and ARIA attributes dictionary supporting fine-grained classes, styles, and events on E.
 *
 * @template E - Target Element type
 */
export interface AriaAttributes<E extends BaseElement = HTMLElement> extends GlobalHTMLAttributes<E> {
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-expanded'?: boolean | 'true' | 'false';
  'aria-selected'?: boolean | 'true' | 'false';
  'aria-checked'?: boolean | 'mixed' | 'true' | 'false';
  'aria-pressed'?: boolean | 'mixed' | 'true' | 'false';
  'aria-disabled'?: boolean | 'true' | 'false';
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-modal'?: boolean | 'true' | 'false';
  'aria-readonly'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  'aria-multiline'?: boolean | 'true' | 'false';
  'aria-multiselectable'?: boolean | 'true' | 'false';
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuetext'?: string;
  'aria-orientation'?: Orientation;
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both';
  'aria-activedescendant'?: string;
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
  'aria-rowindex'?: number;
  'aria-colindex'?: number;
  'aria-rowcount'?: number;
  'aria-colcount'?: number;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean | 'true' | 'false';
  'aria-busy'?: boolean | 'true' | 'false';
  'aria-relevant'?: string;
  'aria-posinset'?: number;
  'aria-setsize'?: number;
}

/**
 * Fully normalized HTML, SVG, and ARIA attributes dictionary with resolved class strings and style objects.
 *
 * @template E - Target Element type
 */
export type NormalizedAttrs<E extends BaseElement = HTMLElement> = Omit<
  AriaAttributes<E>,
  'class' | 'className' | 'style'
> & {
  class?: string;
  className?: string;
  style?: Record<string, string | number>;
};
