import type { AriaOptions, BaseElement } from '../../types.js';
import {
  PopupTriggerAria,
  type PopupTriggerAttributes,
  type PopupTriggerOptions,
  type PopupTriggerProps,
} from '../popup.js';
import { type MenuAria, menuCtx } from './menu.js';

/**
 * Reactive input properties for the Menu trigger button.
 */
export interface MenuButtonProps extends PopupTriggerProps {}

/**
 * Configuration options for MenuButtonAria.
 */
export interface MenuButtonOptions extends PopupTriggerOptions {}

/**
 * Compiled HTML and ARIA attributes for a Menu trigger button.
 *
 * @template E - Target Element type
 */
export interface MenuButtonAttributes<E extends BaseElement = HTMLElement> extends PopupTriggerAttributes<E> {}

/**
 * Popup trigger button opening the menu panel. Compiles attributes only;
 * click and key activation come from the composed popover modes.
 *
 * @template E - Target Element type (defaults to HTMLButtonElement)
 */
export class MenuButtonAria<E extends BaseElement = HTMLButtonElement> extends PopupTriggerAria<
  E,
  MenuButtonProps,
  MenuButtonAttributes<E>,
  MenuButtonOptions
> {
  /**
   * Enclosing menu orchestrator discovered from ambient context.
   */
  public declare host?: MenuAria;

  /**
   * @param props - User-provided trigger properties.
   * @param options - User-provided trigger options.
   */
  public constructor(props: Partial<MenuButtonProps> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.host = menuCtx.get();
    this.update();
  }

  protected override createAttributes(): MenuButtonAttributes<E> {
    return Object.assign(super.createAttributes(), {
      role: undefined,
      'aria-haspopup': 'menu',
    });
  }
}
