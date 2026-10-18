import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { popupCtx, PopupAria } from './popup.js';

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
  /* istanbul ignore next */
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
