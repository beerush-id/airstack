import { $static, createContext } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../../selection.js';
import type { AriaProps, BaseElement } from '../../types.js';
import { gridCtx, type GridAria } from './grid.js';

export const rowCtx = createContext<GridRowAria>();
export interface RowProps extends AriaProps {
  name?: string;
  rowindex?: number;
  selected?: boolean;
  disabled?: boolean;
}
export interface RowAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'row';
  'aria-selected'?: 'true' | 'false';
  'aria-rowindex'?: number;
  'aria-disabled'?: 'true' | 'false';
}
export class GridRowAria<
  E extends BaseElement = HTMLElement,
  T extends RowProps = RowProps,
  A extends RowAttributes<E> = RowAttributes<E>,
> extends SelectionAria<E, T, A> {
  protected host = gridCtx.get();

  protected get isRowMode() {
    return this.host?.properties.selectionMode === 'row';
  }

  public override get selected(): boolean {
    return super.selected;
  }

  public override set selected(value: boolean) {
    if (!this.isRowMode) return;
    super.selected = value;
  }

  public constructor(props: Partial<T> = {}) {
    super(props, { role: 'grid-row', valueKey: 'name', allowKeys: ['Enter'] } as SelectionOptions);

    $static(() => {
      if (!this.isRowMode) this.options.allowKeys = [];
    });

    rowCtx.set(this as unknown as GridRowAria);

    this.omittedAttrs.push('name', 'rowindex', 'selected', 'aria-selected', 'aria-rowindex');
    this.update();
  }

  public override select(): void {
    if (!this.isRowMode) return;
    super.select();
  }

  public override deselect(): void {
    if (!this.isRowMode) return;
    super.deselect();
  }

  public override toggle(): void {
    if (!this.isRowMode) return;
    super.toggle();
  }

  protected override createAttributes(): A {
    const attrs = super.createAttributes() as Record<string, unknown>;
    const isSelected = this.selected;
    const isDisabled = this.disabled;
    const isPassive = !this.isRowMode;

    return Object.assign(attrs, {
      role: 'row',
      tabindex: isDisabled || isPassive ? undefined : isSelected ? 0 : -1,
      'aria-disabled': isPassive ? undefined : isDisabled ? 'true' : 'false',
      'aria-selected': isPassive ? undefined : isSelected ? 'true' : 'false',
      'aria-rowindex': this.properties.rowindex,
    }) as A;
  }
}
