import type { AriaAttributes, BaseElement, Orientation } from '../../types.js';
import { MenuContainerAria, menuCtx, ROLE_MENU } from './container.js';
import type { MenubarProps } from './menubar.js';

/**
 * Reactive input properties for the menu popup panel.
 */
export interface MenuPanelProps extends MenubarProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Element ID providing accessible label.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for a menu container.
 *
 * @template E - Target Element type
 */
export interface MenuPanelAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'menu';
  'aria-orientation'?: Orientation;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Headless WAI-ARIA menu panel managing vertical roving focus
 * across command items. Claims the Escape keystroke; popup dismissal
 * and focus-return belong to the trigger/popover layer.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class MenuPanelAria<
  E extends BaseElement = HTMLElement,
  T extends MenuPanelProps = MenuPanelProps,
  A extends MenuPanelAttributes<E> = MenuPanelAttributes<E>,
> extends MenuContainerAria<E, T, A> {
  protected override readonly containerRole: 'menu' = 'menu';
  protected override readonly defaultOrientation: Orientation = 'vertical';

  private root = menuCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.omittedAttrs.push('id', 'aria-orientation');
    this.update();
  }

  /**
   * Visual and keyboard navigation orientation of the panel.
   */
  public get orientation(): Orientation {
    return this.props.orientation ?? this.defaultOrientation;
  }

  /**
   * Computes HTML and ARIA attributes for the menu popup panel.
   *
   * @returns Menu panel attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      id: this.props.id ?? (this.root ? `${this.root.props.id}-${ROLE_MENU}` : undefined),
      'aria-orientation': this.orientation,
      'aria-label': this.props.label,
      'aria-labelledby': this.props.labelledby,
    }) as A;
  }

  /**
   * Claims the Escape keystroke for popup dismissal wiring.
   * Dismissal and focus-return belong to the trigger/popover layer;
   * the menu core only owns the keystroke while focus is inside.
   *
   * @param event - Keyboard event bubbled from a menu item
   */
  protected override handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.root) this.root.open = false;
      return;
    }

    super.handleKey(event);
  }
}
