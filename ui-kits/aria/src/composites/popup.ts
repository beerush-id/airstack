import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { type OverlayTriggerMode, PopoverAria, type PopoverRole } from '../widgets/popover.js';

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
export interface PopupTriggerProps extends AriaProps {
  /**
   * Whether this trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

export interface PopupTriggerOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a Popup combobox trigger.
 *
 * @template E - Target Element type
 */
export interface PopupTriggerAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: string;
  type?: string;
  disabled?: boolean;
  tabindex?: number;
  'aria-haspopup'?: string;
  'aria-expanded'?: 'true' | 'false';
  'aria-controls'?: string;
  'aria-disabled'?: 'true';
}

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

/**
 * Abstract popup trigger opening the popup panel. Compiles attributes only;
 * click and arrow-key activation come from the composed popover modes.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class PopupTriggerAria<
  E extends BaseElement = HTMLElement,
  P extends PopupTriggerProps = PopupTriggerProps,
  A extends PopupTriggerAttributes<E> = PopupTriggerAttributes<E>,
  O extends PopupTriggerOptions = PopupTriggerOptions,
> extends Aria<E, P, A, O> {
  protected host?: PopupAria;

  /**
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   */
  public constructor(props: Partial<PopupTriggerProps> = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);

    this.host = popupCtx.get();
    this.omittedAttrs.push(
      'id',
      'role',
      'type',
      'disabled',
      'tabindex',
      'aria-haspopup',
      'aria-expanded',
      'aria-controls',
      'aria-disabled'
    );

    this.markActionable();
  }

  /**
   * Whether this trigger is disabled, factoring in select-level disablement.
   */
  public get disabled(): boolean {
    return !!(this.properties.disabled ?? this.host?.disabled);
  }

  /**
   * Compile the trigger attributes.
   * @return {PopupTriggerAttributes<E>}
   */
  protected override createAttributes(): A {
    const host = this.host;
    const disabled = this.disabled;

    const attrs: PopupTriggerAttributes<E> = {
      id: host?.triggerId,
      role: host?.options.triggerRole ?? 'combobox',
      'aria-haspopup': host?.options?.panelRole ?? 'listbox',
      'aria-expanded': host?.open ? 'true' : 'false',
      'aria-controls': host?.panelId,
    };

    if (this.isNative) {
      attrs.type = 'button';
      if (disabled) {
        attrs.disabled = true;
      }
    } else {
      attrs.tabindex = disabled ? -1 : 0;
      if (disabled) {
        attrs['aria-disabled'] = 'true';
      }
    }

    return attrs as A;
  }
}

export abstract class PopupPanel extends Aria {
  abstract get id(): string;
  abstract host: PopupAria;
  abstract popup: PopoverAria;
}

export function bindPanel(panel: PopupPanel, mode: OverlayTriggerMode[] = ['click', 'rove']) {
  panel.actionable = panel.scope?.actionable;

  panel.popup = new PopoverAria(
    {
      mode,
      get xDir() {
        return panel.properties.xDir ?? 'left';
      },
      get yDir() {
        return panel.properties.yDir ?? 'below';
      },
      get id() {
        return panel.id;
      },
      get open() {
        return panel.properties.open;
      },
      set open(value: boolean) {
        panel.properties.open = value;
      },
      get onopen() {
        return panel.properties.onopen;
      },
      get onclose() {
        return panel.properties.onclose;
      },
    },
    { popupRole: (panel.host?.options?.panelRole as PopoverRole) ?? 'listbox' }
  );

  const ref = panel.ref;
  panel.ref = ((el) => {
    ref(el);
    panel.popup.ref(el as unknown as HTMLElement);
  }) as typeof ref;
}
