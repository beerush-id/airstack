import { $static, type AnyType, createContext } from '@airlib/core';
import {
  SelectionAria,
  type SelectionAttributes,
  type SelectionOptions,
  type SelectionProps,
} from '../../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, BaseElement, Primitive } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { ENABLED_ITEM_SELECTOR, ROLE_TREE_ITEM } from './shared.js';

/**
 * Custom event dispatched when a branch tree item expands or collapses.
 */
export type TreeItemToggleEvent = AriaEvent<boolean>;
/**
 * Ambient context for the enclosing TreeItem controller.
 */
export const treeItemCtx = createContext<TreeItemAria<BaseElement>>();
/**
 * Reactive input properties for TreeItemAria.
 */
export interface TreeItemProps<T extends Primitive = string> extends Omit<SelectionProps, 'name' | 'value'> {
  id?: string;
  name?: T;
  value?: T;
  expanded?: boolean;
  disabled?: boolean;
  label?: string;
  ontoggle?: AriaEventHandler<TreeItemToggleEvent>;
}

/**
 * Compiled HTML and ARIA attributes for a tree item element.
 */
export interface TreeItemAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'treeitem';
  tabindex?: number;
  'aria-label'?: string;
  'aria-selected'?: 'true' | 'false';
  'aria-expanded'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
}
/**
 * Headless WAI-ARIA TreeItem controller managing node selection and per-branch expansion.
 */
export class TreeItemAria<
  E extends BaseElement = HTMLElement,
  T extends TreeItemProps = TreeItemProps,
  A extends TreeItemAttributes<E> = TreeItemAttributes<E>,
> extends SelectionAria<E, T & SelectionProps, A, SelectionOptions> {
  public override get value(): AnyType {
    return this.properties.name ?? this.properties.value;
  }

  public override get selected(): boolean {
    return super.selected;
  }

  public override set selected(value: boolean) {
    super.selected = value;
  }

  public get isBranch(): boolean {
    return typeof this.properties.expanded === 'boolean';
  }

  public get expanded(): boolean {
    return !!this.properties.expanded;
  }

  public set expanded(value: boolean) {
    if (this.disabled) return;
    if (value) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  public constructor(props: Partial<T> = {}) {
    super(props as Partial<T & SelectionProps>, {
      native: false,
      role: ROLE_TREE_ITEM,
      valueKey: 'name',
      allowKeys: [],
      clickable: true,
    });

    $static(() => {
      const token = typeof this.value === 'string' ? this.value : this.id;
      this.properties.id =
        this.properties.id ?? (this.group?.id ? `${this.group.id}-${ROLE_TREE_ITEM}-${token}` : this.id);
      this.id = this.properties.id!;
    });

    treeItemCtx.set(this as unknown as TreeItemAria<BaseElement>);

    this.omittedAttrs.push(
      'name',
      'value',
      'expanded',
      'label',
      'ontoggle',
      'role',
      'aria-label',
      'aria-selected',
      'aria-expanded'
    );

    this.update();
  }

  /**
   * Marks this tree item as a branch when a child TreeGroup mounts inside its scope.
   */
  public markBranch(): void {
    $static(() => {
      if (this.properties.expanded === undefined) {
        this.properties.expanded = false;
      }
    });
  }

  /**
   * Expands this branch item.
   */
  public expand(): void {
    if (this.disabled || !this.isBranch || this.expanded) return;
    this.properties.expanded = true;
    this.notifyToggle();
  }

  /**
   * Collapses this branch item.
   */
  public collapse(): void {
    if (this.disabled || !this.isBranch || !this.expanded) return;
    this.properties.expanded = false;
    this.notifyToggle();
  }

  /**
   * Toggles expansion state on this branch item.
   */
  public toggleExpand(): void {
    if (this.disabled || !this.isBranch) return;
    if (this.expanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  protected override createAttributes(): A {
    const attrs = super.createAttributes();
    const isDisabled = this.disabled;
    const isSelected = this.selected;

    return Object.assign(attrs, {
      role: ROLE_TREE_ITEM,
      tabindex: isDisabled ? -1 : isSelected ? 0 : -1,
      'aria-label': this.properties.label,
      'aria-selected': ariaBoolean(isSelected),
      'aria-expanded': this.isBranch ? ariaBoolean(this.expanded) : undefined,
      onclick: this.handleItemClick,
      onkeydown: this.handleItemKeyDown,
      onkeyup: undefined,
    }) as A;
  }

  private isOwnTarget(event: Event): boolean {
    const targetItem = (event.target as HTMLElement | null)?.closest?.('[role="treeitem"]');
    return !targetItem || targetItem === (this.element as unknown as HTMLElement);
  }

  private readonly handleItemClick = (event: MouseEvent): void => {
    if (this.disabled || event.defaultPrevented || !this.isOwnTarget(event)) return;
    this.toggle();
  };

  private readonly handleItemKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || !this.isOwnTarget(event)) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
      return;
    }

    if (event.key === 'ArrowRight') {
      if (!this.isBranch) return;

      if (!this.expanded) {
        event.preventDefault();
        this.expand();
        return;
      }

      handleRovingKey(this.element, event, {
        selector: ENABLED_ITEM_SELECTOR,
        orientation: 'horizontal',
        manual: this.group?.manual !== false,
        loop: false,
      });
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (this.isBranch && this.expanded) {
        event.preventDefault();
        this.collapse();
        return;
      }

      const parentItem = (this.element as unknown as HTMLElement | null)?.parentElement?.closest<HTMLElement>(
        ENABLED_ITEM_SELECTOR
      );
      if (parentItem) {
        handleRovingKey(parentItem.parentElement, event, {
          selector: `#${parentItem.id}`,
          orientation: 'horizontal',
          manual: this.group?.manual !== false,
          loop: false,
        });
      }
    }
  };

  private notifyToggle(): void {
    const event: TreeItemToggleEvent = new CustomEvent('toggle', {
      detail: this.expanded,
      bubbles: false,
    });
    this.element?.dispatchEvent(event);
    this.properties.ontoggle?.(event);
  }
}
