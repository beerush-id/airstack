import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../../types.js';

export const popupCtx = createContext<PopupAria>();

/**
 * Controller-dispatched open/close event.
 */
export type PopupOpenEvent = AriaEvent<true>;
export type PopupCloseEvent = AriaEvent<false>;

export interface PopupProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Filter query carried for combobox-style consumers; no select behavior reads it.
   */
  query?: string;

  /**
   * Popup visibility flag.
   */
  open?: boolean;

  /**
   * Whether user interaction is disabled across the entire select.
   */
  disabled?: boolean;

  /**
   * Enforces a selection constraint requiring a non-empty value.
   */
  required?: boolean;

  /**
   * Called after the popup opens.
   */
  onopen?: AriaEventHandler<PopupOpenEvent>;

  /**
   * Called after the popup closes, through every dismissal path.
   */
  onclose?: AriaEventHandler<PopupCloseEvent>;
}

/**
 * Reactive input properties for the Popup trigger.
 */
const POPUP_SYMBOL = $symbol('popup');

export interface PopupOptions extends AriaOptions {
  name?: string;
  symbol?: symbol;
  panelRole?: string;
  triggerRole?: string;
}

/**
 * Abstract orchestrator hosting popup visibility.
 * Compiles no role; publishes ambient context for trigger, panel, and options.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class PopupAria<
  E extends BaseElement = HTMLElement,
  P extends PopupProps = PopupProps,
  A extends AriaAttributes<E> = AriaAttributes<E>,
  O extends PopupOptions = PopupOptions,
> extends Aria<E, P, A, O> {
  /**
   * The unique DOM element identifier.
   */
  public get id() {
    return this.properties.id;
  }

  /**
   * Whether the popup is currently open.
   */
  public get open(): boolean {
    return !!this.properties.open;
  }

  /**
   * Set whether the popup is currently open.
   * @param {boolean} value
   */
  public set open(value: boolean) {
    this.properties.open = value;
  }

  /**
   * Whether user interaction is disabled across the entire select.
   */
  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  /**
   * Deterministic panel identifier shared with the trigger's aria-controls.
   */
  public get panelId(): string {
    return `${this.properties.id}-panel`;
  }

  /**
   * Deterministic trigger identifier shared with the panel's aria-controls.
   */
  public get triggerId(): string {
    return `${this.properties.id}-trigger`;
  }

  public options: O;

  /* istanbul ignore next */
  public constructor(props: PopupProps = {}, options?: PopupOptions) {
    super(props as P);

    this.options = { name: 'popup', symbol: POPUP_SYMBOL, ...options } as O;
    this.omittedAttrs.push('open', 'disabled', 'onopen', 'onclose', 'onchange');

    $static(() => {
      if (!this.properties.id) {
        this.properties.id = `${this.options.name}-${uIndex(this.options.symbol!, true)}`;
      }
    });
  }
}
