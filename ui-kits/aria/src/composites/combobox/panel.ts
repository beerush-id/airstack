import type { AriaEvent, BaseElement } from '../../types.js';
import type { PopoverAria } from '../../widgets/popover.js';
import { ListboxAria, type ListboxAttributes, type ListboxProps } from '../listbox.js';
import { bindPanel, type PopupPanel } from '../popup/panel.js';
import { popupCtx } from '../popup/popup.js';
import type { ComboboxAria } from './combobox.js';


/**
 * Popup panel props inherit the listbox contract.
 */
export type ComboboxPanelProps = ListboxProps;
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
    bindPanel(this as unknown as PopupPanel, { mode: ['combo'] });

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
