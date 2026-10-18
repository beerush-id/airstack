import { $static, effect } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../../selection.js';
import type { AriaProps, BaseElement } from '../../types.js';
import { gridCtx, type GridAria } from './grid.js';

export interface GridCellProps extends AriaProps {
  name?: string;
  value?: string;
  colindex?: number;
  readonly?: boolean;
  selected?: boolean;
  disabled?: boolean;
}
export interface GridCellAttributes<E extends BaseElement = HTMLElement> extends SelectionAttributes<E> {
  role?: 'gridcell';
  tabindex?: number;
  'aria-selected'?: 'true' | 'false';
  'aria-disabled'?: 'true' | 'false';
  'aria-readonly'?: 'true';
  'aria-colindex'?: number;
}
export class GridCellAria<
  E extends BaseElement = HTMLElement,
  T extends GridCellProps = GridCellProps,
  A extends GridCellAttributes<E> = GridCellAttributes<E>,
> extends SelectionAria<E, T, A> {
  protected grid = gridCtx.get();

  protected get isRowMode() {
    return this.grid?.properties.selectionMode === 'row';
  }

  public override get selected() {
    return super.selected;
  }

  public override set selected(value: boolean) {
    if (this.isRowMode) return;
    super.selected = value;
  }

  public get editable() {
    return !!this.grid?.properties.editable;
  }

  public constructor(props: Partial<T> = {}) {
    super(props, {
      role: 'grid-cell',
      valueKey: 'name',
      allowKeys: ['Enter'],
      deferredKey: true,
    } as SelectionOptions);

    this.omittedAttrs.push(
      'name',
      'colindex',
      'readonly',
      'selected',
      'aria-selected',
      'aria-colindex',
      'aria-readonly'
    );

    $static(() => {
      if (this.isRowMode) {
        this.group = undefined;
        this.options.allowKeys = [];
      }
    });

    this.on('keyup', (e) => {
      if (e.key !== 'Escape') return;
      this.commit();
    });
    this.on('blur', () => {
      this.commit();
    });
    this.on('click', (e) => {
      if (!this.grid || !this.editable || !this.selected) return;
      e.stopPropagation();
      e.preventDefault();
    });

    effect.client(() => {
      if (!this.editable || !this.grid) return;

      const selected = this.selected;
      this.grid.locked = selected;

      if (selected) this.placeCursor();
    });

    this.update();
  }

  public override deselect(): void {
    if (this.isRowMode) return;
    super.deselect();
  }

  public override select(): void {
    if (this.isRowMode) return;
    super.select();
  }

  public override toggle(): void {
    if (this.isRowMode) return;
    super.toggle();
  }

  protected commit() {
    if (!this.grid || !this.editable || !this.selected) return;
    this.properties.value = this.element?.textContent;
    this.grid.value = undefined;
  }

  protected placeCursor(atEnd = true) {
    const element = this.element as unknown as HTMLInputElement;
    if (!element) return;

    element.focus();

    const selection = window.getSelection();
    if (!selection) return;

    const targetNode = element.lastChild ?? element;
    const offset = atEnd ? (targetNode.nodeValue?.length ?? targetNode.childNodes.length) : 0;

    selection.collapse(targetNode, offset);
  }

  protected override createAttributes(): A {
    const attrs = super.createAttributes() as Record<string, unknown>;
    const isSelected = this.selected;
    const isDisabled = this.disabled;
    const isPassive = this.isRowMode;

    return Object.assign(attrs, {
      role: 'gridcell',
      tabindex: isPassive ? undefined : this.editable ? (isDisabled ? -1 : 0) : isSelected ? 0 : -1,
      contenteditable: isSelected && this.editable ? 'true' : undefined,
      'aria-disabled': isPassive ? undefined : isDisabled ? 'true' : 'false',
      'aria-selected': isPassive ? undefined : isSelected ? 'true' : 'false',
      'aria-colindex': this.properties.colindex,
      'aria-readonly': this.properties.readonly ? 'true' : undefined,
    }) as A;
  }
}
