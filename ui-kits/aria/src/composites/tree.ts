import { $static, $symbol, type AnyType, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../context.js';
import { Aria } from '../core.js';
import {
  SelectionAria,
  type SelectionAttributes,
  selectionGroup,
  type SelectionOptions,
  type SelectionProps,
} from '../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, Primitive } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';
import { handleRovingKey } from '../utils/navigation.js';

const ROLE_TREE = 'tree';
const ROLE_TREE_ITEM = 'treeitem';
const ROLE_TREE_GROUP = 'group';

const ENABLED_ITEM_SELECTOR = '[role="treeitem"]:not([aria-disabled="true"]):not(:disabled)';
const VISIBLE_ITEM_SELECTOR = `${ENABLED_ITEM_SELECTOR}:not([aria-expanded="false"] *)`;

/**
 * Custom event dispatched when the tree selection changes.
 */
export type TreeChangeEvent<T = unknown> = AriaEvent<T>;

/**
 * Custom event dispatched when a branch tree item expands or collapses.
 */
export type TreeItemToggleEvent = AriaEvent<boolean>;

interface TreeBaseProps extends AriaProps {
  id?: string;
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  labelledby?: string;
}

/**
 * Reactive input properties for single-select TreeAria.
 */
export interface SingleTreeProps<T extends Primitive = string> extends TreeBaseProps {
  multiple?: false;
  value?: T;
  onchange?: AriaEventHandler<TreeChangeEvent<T | undefined>>;
}

/**
 * Reactive input properties for multi-select TreeAria.
 */
export interface MultipleTreeProps<T extends Primitive = string> extends TreeBaseProps {
  multiple: true;
  value?: T[];
  onchange?: AriaEventHandler<TreeChangeEvent<T[]>>;
}

/**
 * Reactive input properties for TreeAria (single or multiple selection).
 */
export type TreeProps<T extends Primitive = string> = SingleTreeProps<T> | MultipleTreeProps<T>;

/**
 * Compiled HTML and ARIA attributes for a tree container.
 */
export interface TreeAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'tree';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-multiselectable'?: 'true' | 'false';
  'aria-required'?: 'true';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Ambient context for the enclosing Tree props.
 */
export const treeCtx = createContext<TreeProps>();

/**
 * Ambient context for the enclosing TreeItem controller.
 */
export const treeItemCtx = createContext<TreeItemAria<BaseElement>>();

/**
 * Headless WAI-ARIA Tree container controller coordinating hierarchical selection and depth-aware roving focus.
 */
export class TreeAria<
  E extends BaseElement = HTMLElement,
  T extends TreeProps = TreeProps,
  A extends TreeAttributes<E> = TreeAttributes<E>,
> extends Aria<E, T, A> {
  private parentRover = roverCtx.get();

  public get id(): string | undefined {
    return this.properties.id;
  }

  public get value(): T['value'] {
    return this.properties.value;
  }

  public set value(val: T['value']) {
    this.properties.value = val;
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  public constructor(props: Partial<T> = {}) {
    const ambientProps = treeCtx.get(props as TreeProps);
    super(ambientProps as Partial<T>);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_TREE}-${uIndex($symbol(ROLE_TREE), true)}`;

      if (this.properties.manual === undefined) {
        this.properties.manual = true;
      }

      if (this.properties.multiple && !Array.isArray(this.properties.value)) {
        this.properties.value = [] as unknown as string[];
      }
    });

    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.properties as Record<string, unknown>);

    this.omittedAttrs.push(
      'id',
      'label',
      'labelledby',
      'value',
      'multiple',
      'manual',
      'disabled',
      'required',
      'onchange',
      'role',
      'aria-label',
      'aria-labelledby',
      'aria-multiselectable',
      'aria-required',
      'aria-disabled'
    );

    this.on('keydown', this.handleKeyDown);
    this.update();
  }

  protected override createAttributes(): A {
    const disabled = this.disabled;

    return {
      id: this.id,
      role: ROLE_TREE,
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
      'aria-multiselectable': ariaBoolean(!!this.properties.multiple),
      'aria-required': this.properties.required ? 'true' : undefined,
      'aria-disabled': ariaBoolean(disabled),
    } as A;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || this.parentRover) return;

    handleRovingKey(this.element, event, {
      selector: VISIBLE_ITEM_SELECTOR,
      manual: this.properties.manual !== false,
      loop: false,
    });
  };
}

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
