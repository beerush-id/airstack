import { $symbol, type AnyType, effect, untrack } from '@airlib/core';
import { shadow } from '@airlib/core/browser';
import { selectionGroup } from '../selection.js';
import type { AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement, DetachFn } from '../types.js';
import type { PopoverAria } from '../widgets/popover.js';
import { ListboxAria, type ListboxAttributes, listboxCtx, type ListboxProps } from './listbox.js';
import {
  bindPanel,
  PopupAria,
  type PopupCloseEvent,
  popupCtx,
  type PopupOpenEvent,
  type PopupPanel,
  type PopupProps,
  PopupTriggerAria,
  type PopupTriggerAttributes,
  type PopupTriggerOptions,
} from './popup.js';

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

/**
 * Reactive input properties for the Combobox text input.
 */
export interface ComboboxInputProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Whether this input is disabled from user interaction.
   */
  disabled?: boolean;
}

export interface ComboboxInputOptions extends PopupTriggerOptions {}

/**
 * Compiled HTML and ARIA attributes for a Combobox text input.
 *
 * @template E - Target Element type
 */
export interface ComboboxInputAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {
  'aria-autocomplete'?: 'list';
}

/**
 * Popup panel props inherit the listbox contract.
 */
export type ComboboxPanelProps = ListboxProps;

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

/**
 * Editable text input carrying the combobox role: it drives the filter query and the
 * popup's expansion, while traversal and commits run through the composed listbox panel.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ComboboxInputAria<E extends BaseElement = HTMLElement> extends PopupTriggerAria<
  E,
  ComboboxProps,
  ComboboxInputAttributes<E>,
  ComboboxInputOptions
> {
  protected declare host: ComboboxAria;

  /**
   * Current combobox value.
   */
  public get value() {
    return this.host?.value ?? '';
  }

  /**
   * Current combobox label.
   */
  public get label() {
    return this.host?.label ?? '';
  }

  /**
   * Current combobox text.
   */
  public get text() {
    return this.host?.text ?? '';
  }

  /**
   * Current combobox query.
   */
  public get query() {
    return this.host?.query ?? '';
  }

  /**
   * @param props - User-provided input properties.
   * @param options - User-provided input options.
   */
  public constructor(props: ComboboxInputProps = {}, options: AriaOptions = { native: true }) {
    super(props as never, options as never);

    this.omittedAttrs.push('aria-autocomplete');
    this.update();
  }

  /**
   * Compile the input attributes.
   * @return {ComboboxInputAttributes<E>}
   */
  protected override createAttributes(): ComboboxInputAttributes<E> {
    const attrs = super.createAttributes() as ComboboxInputAttributes<E>;

    if (this.isNative) {
      Object.assign(attrs, {
        name: this.host?.triggerId,
        type: 'text',
        value: this.query || this.label || this.text || this.value,
        required: this.host?.properties.required,
      });
    } else {
      Object.assign(attrs, {
        'aria-required': this.host?.properties.required ? 'true' : 'false',
      });
    }

    attrs['aria-autocomplete'] = 'list';

    return attrs;
  }

  protected override attach(): DetachFn | void {
    const detach = super.attach();
    const host = this.element!;

    const selectLabel = (): void => {
      const combo = this.host as unknown as ComboboxAria | undefined;
      if (!combo || this.disabled) return;
      if (combo.query !== '' || combo.text === '') return;
      (this.element as unknown as HTMLInputElement | null)?.select?.();
    };

    const handleInput = (event: Event): void => {
      this.handleInput(event);
    };

    host.addEventListener('input', handleInput);
    host.addEventListener('focus', selectLabel);

    return () => {
      detach?.();
      host.removeEventListener('input', handleInput);
      host.removeEventListener('focus', selectLabel);
    };
  }

  private readonly handleInput = (event: Event): void => {
    const host = this.host as unknown as ComboboxAria | undefined;
    if (!host || this.disabled) return;

    let value = (event.target as HTMLInputElement).value;
    if (host.query === '' && host.text !== '' && value.length > host.text.length && value.startsWith(host.text)) {
      value = value.slice(host.text.length);
    }
    host.assign({ query: value, open: true });

    if (value === '' && !host.multiple) {
      if (host.value !== null && host.value !== undefined) host.value = undefined;
      if (host.text !== '') host.properties.text = '';
    }
  };
}

/**
 * Popup listbox panel inheriting listbox mechanics and proxying overlay dismissal,
 * positioning, and light dismissal through an internal popover.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export class ComboboxPanelAria<E extends BaseElement = HTMLElement> extends ListboxAria<
  E,
  ListboxProps,
  ListboxAttributes<E>
> {
  /**
   * Enclosing combobox orchestrator discovered from ambient context.
   */
  public host?: ComboboxAria;
  public popup!: PopoverAria;

  /**
   * Unique panel identifier shared with the input's aria-controls.
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
   * Current combobox query.
   */
  public get query() {
    return this.host?.query ?? '';
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

    this.host = popupCtx.get() as ComboboxAria;
    this.omittedAttrs.push('value', 'query', 'multiple', 'required', 'text', 'valueMap');
    bindPanel(this as unknown as PopupPanel, ['combo']);

    this.update();
  }

  /**
   * Destroys the internal popover and delegates to the base implementation.
   */
  public override destroy(): void {
    this.popup.destroy();
    super.destroy();
  }

  protected override createAttributes(): ListboxAttributes<E> {
    return Object.assign((this.popup as unknown as this).attrs, super.createAttributes());
  }

  protected capture(event: AriaEvent): void {
    if (event.type === 'change' && !this.properties.multiple) {
      this.popup.close();
    }
    super.capture(event);
  }
}
