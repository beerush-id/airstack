import { $static, effect } from '@airlib/core';
import { SelectionAria, type SelectionAttributes, type SelectionOptions } from '../../selection.js';
import type { AriaProps, BaseElement } from '../../types.js';
import { gridCtx } from './grid.js';

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
      clickable: true,
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
      if (!this.isRowMode && this.properties.name) this.grid?.tabStop.join(this.properties.name);
    });

    // In an editable grid the cell focused last holds the tab stop, whether or not it's being edited.
    this.on('focus', () => {
      if (this.properties.name) this.grid?.tabStop.focus(this.properties.name);
    });
    this.cleanups.add(() => {
      if (this.properties.name) this.grid?.tabStop.leave(this.properties.name);
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

    // Editing locks the grid's arrows to the caret; a read-only cell is never edited, so it never locks.
    effect.client(() => {
      if (!this.editable || !this.grid || this.properties.readonly) return;

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
    if (!this.grid || !this.editable || !this.selected || this.properties.readonly) return;
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
    // A picking grid's tab stop is its picked cell; an editable one's is the cell focused last.
    const isTabStop = this.editable ? !isDisabled && this.grid?.tabStop.current === this.properties.name : isSelected;

    return Object.assign(attrs, {
      role: 'gridcell',
      tabindex: isPassive ? undefined : isTabStop ? 0 : -1,
      contenteditable: isSelected && this.editable && !this.properties.readonly ? 'true' : undefined,
      'aria-disabled': isPassive ? undefined : isDisabled ? 'true' : 'false',
      'aria-selected': isPassive ? undefined : isSelected ? 'true' : 'false',
      'aria-colindex': this.properties.colindex,
      'aria-readonly': this.properties.readonly ? 'true' : undefined,
    }) as A;
  }
}
