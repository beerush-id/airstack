import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../../context.js';
import { Aria } from '../../core.js';
import { selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement, Primitive } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { ROLE_TREE, VISIBLE_ITEM_SELECTOR } from './shared.js';

/**
 * Custom event dispatched when the tree selection changes.
 */
export type TreeChangeEvent<T = unknown> = AriaEvent<T>;

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
      tabindex: 0,
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
