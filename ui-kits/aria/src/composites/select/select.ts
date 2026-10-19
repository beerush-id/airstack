import { $symbol, type AnyType } from '@airlib/core';
import { shadow } from '@airlib/core/browser';
import { selectionGroup } from '../../selection.js';
import type { AriaEvent, AriaEventHandler, BaseElement, DetachFn } from '../../types.js';
import { listboxCtx, type ListboxProps } from '../listbox.js';
import { PopupAria, type PopupCloseEvent, popupCtx, type PopupOpenEvent, type PopupProps } from '../popup/popup.js';
import { SelectPanelAria, type SelectPanelProps } from './panel.js';
import { SelectTriggerAria, type SelectTriggerOptions, type SelectTriggerProps } from './trigger.js';

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

  /**
   * Custom labels for the select element to map values to.
   */
  options?: Record<AnyType, AnyType>;
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

  public get labels() {
    return this.properties.options ?? this.valueMap;
  }

  /**
   * Label of the current choice(s).
   */
  public get label() {
    const value = this.properties.value;
    const values = Array.isArray(value) ? value : [value];
    const labels = this.labels;
    return values
      .map((key) => labels[key as string])
      .filter(Boolean)
      .join(', ');
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

  public constructor(
    props: SelectProps = {},
    public valueMap: Record<AnyType, AnyType> = {}
  ) {
    super(props, {
      name: 'select',
      symbol: SELECT_SYMBOL,
      triggerRole: 'combobox',
      panelRole: 'listbox',
    });

    this.omittedAttrs.push('value', 'query', 'labels', 'multiple', 'required', 'text');

    popupCtx.set(this as never);
    listboxCtx.set(this.properties as ListboxProps);
    selectionGroup.set(this.properties as Record<string, unknown>);

    this.update();
  }

  /**
   * Captures the current selection and emits a change event.
   */
  public captureChange() {
    if (!this.element) return;

    const panel = shadow.getElementById(this.panelId);
    const selected = panel?.querySelectorAll('[aria-selected="true"]');
    this.text = Array.from(selected ?? [])
      .map((el) => el.textContent)
      .join(', ');
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

  /**
   * Captures the current selection and delegates to the base implementation.
   */
  protected attach(): DetachFn | void {
    const detach = super.attach();
    this.captureChange();
    return detach;
  }
}
