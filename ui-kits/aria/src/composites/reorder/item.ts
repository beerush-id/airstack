import { createContext, type Primitive } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { reorderCtx } from './host.js';

/**
 * Ambient context for the enclosing ReorderItem controller.
 */
export const reorderItemCtx = createContext<ReorderItemAria<BaseElement, ReorderItemProps<Primitive>>>();

/**
 * Reactive input properties for ReorderItemAria.
 */
export interface ReorderItemProps<T extends Primitive = Primitive> extends AriaProps {
  id?: string;
  value: T;
  label?: string;
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a reorder item.
 */
export interface ReorderItemAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  'aria-label'?: string;
  'aria-current'?: 'true';
  'aria-disabled'?: 'true' | 'false';
}

/**
 * Headless WAI-ARIA ReorderItem controller representing a movable item in a reorder container.
 */
export class ReorderItemAria<
  E extends BaseElement = HTMLElement,
  T extends ReorderItemProps<Primitive> = ReorderItemProps<Primitive>,
  A extends ReorderItemAttributes<E> = ReorderItemAttributes<E>,
> extends Aria<E, T, A> {
  protected reorder = reorderCtx.get();

  public get value(): T['value'] {
    return this.properties.value;
  }

  public get index(): number {
    const list =
      this.reorder?.active !== null && this.reorder?.active !== undefined ? this.reorder.preview : this.reorder?.value;
    return list ? list.indexOf(this.value) : -1;
  }

  public get active(): boolean {
    return this.value !== undefined && this.reorder?.active === this.value;
  }

  public get disabled(): boolean {
    return !!(this.properties.disabled || this.reorder?.disabled);
  }

  public constructor(props: Partial<T> = {}) {
    super(props);

    if (this.reorder) {
      this.reorder.items.add(this as never);
      this.cleanups.add(() => this.reorder?.items.delete(this as never));
    }

    reorderItemCtx.set(this as never);
    this.omittedAttrs.push('id', 'value', 'label', 'disabled', 'aria-label', 'data-active', 'aria-disabled');
    this.update();
  }

  protected override createAttributes(): A {
    const attrs: ReorderItemAttributes<E> = {
      id: this.properties.id,
      'aria-label': this.properties.label,
      'data-active': this.active ? 'true' : undefined,
      'aria-disabled': ariaBoolean(this.disabled),
    };
    return attrs as A;
  }
}
