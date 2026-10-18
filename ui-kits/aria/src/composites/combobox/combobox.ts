import { $symbol, type AnyType, effect, untrack } from '@airlib/core';
import { shadow } from '@airlib/core/browser';
import { selectionGroup } from '../../selection.js';
import type { AriaEvent, AriaEventHandler, BaseElement, DetachFn } from '../../types.js';
import { listboxCtx, type ListboxProps } from '../listbox.js';
import {
  PopupAria,
  type PopupCloseEvent,
  popupCtx,
  type PopupOpenEvent,
  type PopupProps,
} from '../popup/popup.js';
import { ComboboxInputAria, type ComboboxInputOptions, type ComboboxInputProps } from './input.js';
import { ComboboxPanelAria, type ComboboxPanelProps } from './panel.js';

/**
 * Controller-dispatched open/close event.
 */
export type ComboboxOpenEvent = PopupOpenEvent;
export type ComboboxCloseEvent = PopupCloseEvent;

/**
 * Controller-dispatched input event carrying the typed query or the option that took the cursor.
 */
export type ComboboxInputEvent = AriaEvent<string | undefined>;

/**
 * Controller-dispatched change event carrying the whole committed value.
 */
export type ComboboxChangeEvent = AriaEvent<string | string[] | undefined>;

interface ComboboxBaseProps extends PopupProps {
  /**
   * Called after the popup opens.
   */
  onopen?: AriaEventHandler<ComboboxOpenEvent>;

  /**
   * Called after the popup closes, through every dismissal path.
   */
  onclose?: AriaEventHandler<ComboboxCloseEvent>;

  /**
   * Called with the query on typing and with the option value as traversal moves the cursor.
   */
  oninput?: AriaEventHandler<ComboboxInputEvent>;

  /**
   * Called with the whole value after a member commit reaches the container.
   */
  onchange?: AriaEventHandler<ComboboxChangeEvent>;

  /**
   * Map of option values to their labels.
   */
  valueMap?: Record<AnyType, AnyType>;
}

/**
 * Reactive input properties for single-select ComboboxAria.
 */
export interface SingleComboboxProps extends ComboboxBaseProps {
  multiple?: false;

  /**
   * Filter query string; distinct from the selected value.
   */
  query?: string;

  /**
   * Selected option value; `null` is the unselected token.
   */
  value?: string | null;
}

/**
 * Reactive input properties for multi-select ComboboxAria.
 */
export interface MultipleComboboxProps extends ComboboxBaseProps {
  multiple: true;

  /**
   * Filter query string; distinct from the selected value.
   */
  query?: string;

  /**
   * Selected option values.
   */
  value?: string[];
}

/**
 * Reactive input properties for the Combobox container orchestrator.
 */
export type ComboboxProps = SingleComboboxProps | MultipleComboboxProps;

const COMBOBOX_SYMBOL = $symbol('combobox');

/**
 * Root orchestrator hosting combobox value, filter query, and popup visibility.
 * Compiles no role; publishes ambient context for the input, panel, and options.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ComboboxAria<E extends BaseElement = HTMLElement> extends PopupAria<E, ComboboxProps> {
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

  /**
   * Filter query driving the popup's suggestions.
   */
  public get query(): string {
    return this.properties.query ?? '';
  }

  /**
   * Set the filter query.
   */
  public set query(value: string) {
    this.properties.query = value;
  }

  /**
   * Whether multiple options may be selected concurrently.
   */
  public get multiple(): boolean {
    return !!this.properties.multiple;
  }

  public get valueMap() {
    /* istanbul ignore next */
    return this.properties.valueMap ?? this.__valueMap ?? {};
  }

  /**
   * Label of the current choice(s).
   */
  public get label() {
    const value = this.properties.value;
    const values = Array.isArray(value) ? value : [value];
    return values
      .map((key) => this.valueMap[key as string])
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Label of the current choice — the text the field shows while the user is not filtering.
   */
  public get text(): string {
    return this.properties.text ?? '';
  }

  /**
   * Set the label of the current choice.
   */
  public set text(value: string) {
    this.properties.text = value;
  }

  public constructor(props: ComboboxProps = {}, valueMap: Record<AnyType, AnyType> = {}) {
    super(props, {
      name: 'combobox',
      symbol: COMBOBOX_SYMBOL,
      triggerRole: 'combobox',
      panelRole: 'listbox',
    });

    this.__valueMap = valueMap;
    this.omittedAttrs.push('value', 'query', 'multiple', 'required', 'text', 'valueMap');

    popupCtx.set(this as never);
    listboxCtx.set(this.properties as ListboxProps);
    selectionGroup.set(this.properties as Record<string, unknown>);

    this.update();
  }

  /**
   * Creates a new ComboboxInputAria instance.
   *
   * @param props - User-provided input properties.
   * @param options - User-provided input options.
   * @returns - Configured input instance.
   */
  public input(props?: ComboboxInputProps, options?: ComboboxInputOptions) {
    return new ComboboxInputAria(props, options);
  }

  /**
   * Creates a new ComboboxPanelAria instance.
   *
   * @param props - User-provided panel properties.
   * @returns - Configured panel instance.
   */
  public panel(props?: ComboboxPanelProps) {
    return new ComboboxPanelAria(props);
  }

  /**
   * Keeps the field's text aligned with the selection: a commit publishes the chosen option's
   * label as `text` and frees the `query` filter; leaving the composite does the same.
   */
  protected override attach() {
    const host = this.element!;

    const withinComposite = (node: Node): boolean => {
      if (host.contains(node)) return true;

      const panel = shadow.getElementById(this.panelId);
      return !!panel?.contains(node);
    };

    const handleFocusOut = (event: Event): void => {
      const next = (event as FocusEvent).relatedTarget;
      if (next instanceof Node && withinComposite(next)) return;

      this.captureChange();
      this.open = false;
    };

    this.on('focusout', handleFocusOut);

    return effect.client(() => {
      void this.value;
      untrack(() => this.captureChange());
    });
  }

  public captureChange() {
    if (!this.element) return;

    const panel = shadow.getElementById(this.panelId);
    const selected = panel?.querySelectorAll('[aria-selected="true"]');
    const text = Array.from(selected ?? [])
      .map((el) => el.textContent)
      .join(', ');
    this.assign({ query: '', text });
  }

  private readonly __valueMap?: Record<AnyType, AnyType>;
}
