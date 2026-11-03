import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { treeItemCtx } from './item.js';
import { ROLE_TREE_GROUP } from './shared.js';

/**
 * Reactive input properties for TreeGroupAria.
 */
export interface TreeGroupProps extends AriaProps {
  id?: string;
  label?: string;
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for a tree branch group container.
 */
export interface TreeGroupAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'group';
  hidden?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
/**
 * Headless WAI-ARIA TreeGroup controller pairing a branch's children container with its enclosing TreeItem.
 */
export class TreeGroupAria<
  E extends BaseElement = HTMLElement,
  T extends TreeGroupProps = TreeGroupProps,
  A extends TreeGroupAttributes<E> = TreeGroupAttributes<E>,
> extends Aria<E, T, A> {
  private item = treeItemCtx.get();

  public constructor(props: Partial<T> = {}) {
    super(props);
    this.item?.markBranch();
    this.omittedAttrs.push('id', 'label', 'labelledby', 'role', 'aria-label', 'aria-labelledby', 'hidden');
    this.update();
  }

  protected override createAttributes(): A {
    const labelledby = this.properties.labelledby ?? (this.properties.label ? undefined : this.item?.id);
    const hidden = this.item ? !this.item.expanded : false;

    return {
      id: this.properties.id,
      role: ROLE_TREE_GROUP,
      'aria-label': this.properties.label,
      'aria-labelledby': labelledby,
      hidden,
    } as A;
  }
}
