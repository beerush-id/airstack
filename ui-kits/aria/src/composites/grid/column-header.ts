import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';

export interface ColumnHeaderProps extends AriaProps {
  name?: string;
  colindex?: number;
  sort?: 'ascending' | 'descending' | 'none' | 'other';
  disabled?: boolean;
}
export interface ColumnHeaderAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'columnheader';
  'aria-colindex'?: number;
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
  'aria-disabled'?: 'true' | 'false';
}
export class GridColumnHeaderAria<
  E extends BaseElement = HTMLElement,
  T extends ColumnHeaderProps = ColumnHeaderProps,
  A extends ColumnHeaderAttributes<E> = ColumnHeaderAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);
    this.omittedAttrs.push('name', 'colindex', 'sort', 'disabled');
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs: Record<string, unknown> = {
      role: 'columnheader',
      'aria-colindex': this.properties.colindex,
      'aria-sort': this.properties.sort,
      'aria-disabled': isDisabled ? 'true' : undefined,
    };
    return attrs as A;
  }
}
