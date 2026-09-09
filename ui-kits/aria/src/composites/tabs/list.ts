import { roverCtx } from '../../context.js';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement, Orientation } from '../../types.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { ROLE_TABLIST, TAB_SELECTORS, TabAria, tabCtx } from './tab.js';

/**
 * Reactive input properties for the TabList focus manager.
 */
export interface TabListProps extends AriaProps {
  /**
   * Accessible label for the tablist.
   */
  label?: string;

  /**
   * Element ID providing the accessible label for the tablist.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for the TabList element.
 *
 * @template E - Target Element type
 */
export interface TabListAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role: typeof ROLE_TABLIST;
  'aria-orientation': Orientation;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onkeydown?: (e: KeyboardEvent) => void;
}

/**
 * TabList controller managing keyboard roving focus and orientation for a set of tabs.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template A - Compiled attributes dictionary type
 */
export class TabListAria<
  E extends BaseElement = HTMLElement,
  A extends TabListAttributes<E> = TabListAttributes<E>,
> extends Aria<E, TabListProps, A> {
  private parentRover = roverCtx.get();

  /**
   * Enclosing Tab orchestrator controller.
   */
  protected tab?: TabAria;

  public constructor(props: Partial<TabListProps> = {}) {
    super(props);
    this.tab = tabCtx.get();
    roverCtx.set(this as unknown as Aria<BaseElement>);
    this.omittedAttrs.push('aria-orientation');
    this.update();
  }

  /**
   * Visual and keyboard orientation inherited from the parent tab orchestrator.
   */
  public get orientation(): Orientation {
    return this.tab?.props.orientation ?? TabAria.config.orientation;
  }

  /**
   * Compiles HTML and ARIA attributes for the tablist container.
   *
   * @returns TabList attributes dictionary
   */
  protected override createAttributes(): A {
    return Object.assign(super.createAttributes(), {
      role: ROLE_TABLIST,
      'aria-orientation': this.orientation,
      'aria-label': this.props.label,
      'aria-labelledby': this.props.labelledby,
      onkeydown: (e: KeyboardEvent) => {
        if (this.tab?.props.disabled || this.parentRover) return;

        handleRovingKey(this.element, e, {
          selector: TAB_SELECTORS,
          orientation: this.orientation,
          manual: this.tab?.props.manual ?? true,
        });
      },
    }) as A;
  }
}
