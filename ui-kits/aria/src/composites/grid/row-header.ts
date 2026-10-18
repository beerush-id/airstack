import { Aria } from '../../core.js';
import type { AriaAttributes, AriaProps, BaseElement } from '../../types.js';

export interface RowHeaderProps extends AriaProps {
  name?: string;
  rowindex?: number;
  disabled?: boolean;
}
export interface RowHeaderAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'rowheader';
  'aria-rowindex'?: number;
  'aria-disabled'?: 'true' | 'false';
}

export class GridRowHeaderAria<
  E extends BaseElement = HTMLElement,
  T extends RowHeaderProps = RowHeaderProps,
  A extends RowHeaderAttributes<E> = RowHeaderAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T> = {}) {
    super(props);
    this.omittedAttrs.push('name', 'rowindex', 'disabled');
    this.update();
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs: Record<string, unknown> = {
      role: 'rowheader',
      'aria-rowindex': this.properties.rowindex,
      'aria-disabled': isDisabled ? 'true' : undefined,
    };
    return attrs as A;
  }
}
