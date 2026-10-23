import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { treeItemCtx } from './item.js';

/**
 * Compiled HTML and ARIA attributes for a tree branch's expand toggle.
 */
export interface TreeToggleAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  'aria-hidden'?: 'true';
}

/**
 * Pointer affordance that opens and closes its enclosing branch without selecting it. It stays
 * out of the accessibility tree: the keyboard opens and closes branches with the arrows, and the
 * branch row itself already reports whether it's expanded.
 */
export class TreeToggleAria<E extends BaseElement = HTMLElement> extends Aria<E, AriaProps, TreeToggleAttributes<E>> {
  protected item = treeItemCtx.get();

  public constructor(props: Partial<AriaProps> = {}) {
    super(props);
    this.omittedAttrs.push('aria-hidden');
    this.update();
  }

  protected override createAttributes(): TreeToggleAttributes<E> {
    return {
      'aria-hidden': 'true',
      onclick: this.handleClick,
      ondblclick: this.claim,
    };
  }

  /** A quick second press is its own click, so the row's double click must not toggle again. */
  private readonly claim = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || !this.item?.isBranch) return;
    // Claims the click, so the row doesn't also select itself.
    event.preventDefault();
    this.item.toggleExpand();
  };
}
