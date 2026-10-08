import { $symbol } from '@airlib/core';
import { selectionGroup } from '../selection.js';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../types.js';
import type { PopoverAria } from '../widgets/popover.js';
import { ListboxAria, type ListboxAttributes, type ListboxProps, listboxCtx } from './listbox.js';
import {
  bindPanel,
  PopupAria,
  type PopupCloseEvent,
  type PopupOpenEvent,
  type PopupPanel,
  type PopupProps,
  PopupTriggerAria,
  type PopupTriggerAttributes,
  type PopupTriggerOptions,
  popupCtx,
} from './popup.js';

/**
 * Controller-dispatched open/close event.
 */
export type SelectOpenEvent = PopupOpenEvent;
export type SelectCloseEvent = PopupCloseEvent;

/**
 * Controller-dispatched input event.
 */
export type SelectInputEvent = AriaEvent<string | undefined>;

export type SelectChangeEvent = AriaEvent<string | string[] | undefined>;

export interface SelectBaseProps extends PopupProps {
  /**
   * Called after the popup opens.
   */
  onopen?: AriaEventHandler<SelectOpenEvent>;

  /**
   * Called after the popup closes, through every dismissal path.
   */
  onclose?: AriaEventHandler<SelectCloseEvent>;
}

/**
 * Reactive input properties for single-select SelectAria.
 */
export interface SingleSelectProps extends SelectBaseProps {
  multiple?: false;

  /**
   * Active option value; `null` is the unselected token.
   */
  value?: string;

  oninput?: AriaEventHandler<SelectInputEvent>;

  /**
   * Called with the whole value after a member commit reaches the container.
   */
  onchange?: AriaEventHandler<SelectChangeEvent>;
}

/**
 * Reactive input properties for multi-select SelectAria.
 */
export interface MultipleSelectProps extends SelectBaseProps {
  multiple: true;

  /**
   * Array of active option values.
   */
  value?: string[];

  /**
   * Called with the whole value after a member commit reaches the container.
   */
  onchange?: AriaEventHandler<SelectChangeEvent>;
}

/**
 * Reactive input properties for the Select container orchestrator.
 */
export type SelectProps = SingleSelectProps | MultipleSelectProps;

/**
 * Reactive input properties for the Select combobox trigger.
 */
export interface SelectTriggerProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Whether this trigger is disabled from user interaction.
   */
  disabled?: boolean;
}

export interface SelectTriggerOptions extends PopupTriggerOptions {}

/**
 * Compiled HTML and ARIA attributes for a Select combobox trigger.
 *
 * @template E - Target Element type
 */
export interface SelectTriggerAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {}

/**
 * Popup panel props inherit the listbox contract.
 */
export type SelectPanelProps = ListboxProps;

const SELECT_SYMBOL = $symbol('select');

/**
 * Root orchestrator hosting select value and popup visibility.
 * Compiles no role; publishes ambient context for trigger, panel, and options.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SelectAria<E extends BaseElement = HTMLElement> extends PopupAria<E, SelectProps> {
  /**
   * Get the currently selected value(s).
   */
  public get value() {
    return this.properties.value;
  }

  /**
   * Set the currently selected value(s).
   */
  public set value(value: this['properties']['value']) {
    this.properties.value = value;
  }

  public get text(): string {
    return this.properties.text ?? '';
  }

  public set text(value: string) {
    this.properties.text = value ?? '';
  }

  /**
   * Whether multiple options may be selected concurrently.
   */
  public get multiple(): boolean {
    return !!this.properties.multiple;
  }

  public constructor(props: SelectProps = {}) {
    super(props, {
      name: 'select',
      symbol: SELECT_SYMBOL,
      triggerRole: 'combobox',
      panelRole: 'listbox',
    });

    this.omittedAttrs.push('value', 'query', 'multiple', 'required');

    popupCtx.set(this as never);
    listboxCtx.set(this.properties as ListboxProps);
    selectionGroup.set(this.properties as Record<string, unknown>);

    this.update();
  }

  /**
   * Creates a new SelectPanelAria instance.
   *
   * @param props - User-provided panel properties.
   * @returns - Configured panel instance.
   */
  public panel(props?: SelectPanelProps) {
    return new SelectPanelAria(props);
  }

  /**
   * Creates a new SelectTriggerAria instance.
   *
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   * @returns - Configured trigger instance.
   */
  public trigger(props?: SelectTriggerProps, options?: SelectTriggerOptions) {
    return new SelectTriggerAria(props, options);
  }
}

/**
 * Combobox trigger opening the select listbox. Compiles attributes only;
 * click and arrow-key activation come from the composed popover modes.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SelectTriggerAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  SelectProps,
  SelectTriggerAttributes<E>,
  SelectTriggerOptions
> {
  /**
   * Enclosing select orchestrator discovered from ambient context.
   */
  public declare host?: SelectAria;

  /**
   * Get the currently selected value(s).
   */
  public get value(): string | string[] | undefined {
    return this.host?.value;
  }

  public get text(): string {
    return this.host?.text ?? '';
  }

  /**
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   */
  public constructor(props: Partial<SelectTriggerProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.update();
  }
}

/**
 * Popup listbox panel inheriting listbox mechanics and proxying overlay
 * dismissal, positioning, and focus management through an internal popover.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class SelectPanelAria<E extends BaseElement = HTMLElement> extends ListboxAria<
  E,
  ListboxProps,
  ListboxAttributes<E>
> {
  /**
   * Enclosing select orchestrator discovered from ambient context.
   */
  public host?: SelectAria;
  public popup!: PopoverAria;

  /**
   * Unique panel identifier shared with the trigger's aria-controls.
   */
  public override get id() {
    return `${this.properties.id}-panel`;
  }

  /**
   * Whether the popup is currently open.
   */
  public get open() {
    return this.popup.open;
  }

  /**
   * Sets the internal panel element reference and delegates to the popup.
   *
   * @param element - Element to track.
   */
  /* istanbul ignore next: no flow assigns panel.current; popup tracks the element through its own ref */
  public override set current(element: E | null) {
    super.current = element;
    this.popup.current = element as unknown as HTMLElement;
  }

  /**
   * @param props - User-provided panel properties.
   */
  public constructor(props: Partial<ListboxProps> = {}) {
    super(props, true);

    this.host = popupCtx.get() as SelectAria;
    bindPanel(this as unknown as PopupPanel);

    this.update();
  }

  /**
   * Destroys the internal popover and delegates to the base implementation.
   */
  public override destroy(): void {
    this.popup.destroy();
    super.destroy();
  }

  /**
   * Announces a value change to the select orchestrator and closes the popup
   * if single-select.
   * @return dispatched event.
   */
  protected override announceChange() {
    const event = super.announceChange();
    this.host?.dispatch(event);

    if (!this.properties.multiple) {
      this.popup.close();
    }
    this.applyText();

    return event;
  }

  protected applyText() {
    if (!this.host) return;

    const selected = this.element?.querySelectorAll('[aria-selected="true"]');
    this.host.text = Array.from(selected ?? [])
      .map((el) => el.textContent)
      .join(', ');
  }
}
