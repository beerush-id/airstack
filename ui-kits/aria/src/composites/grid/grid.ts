import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { roverCtx } from '../../context.js';
import { Aria } from '../../core.js';
import { selectionGroup } from '../../selection.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaProps, BaseElement } from '../../types.js';
import { ariaBoolean } from '../../utils/attributes.js';
import { handleRovingKey } from '../../utils/navigation.js';
import { createTabStop } from '../../utils/tab-stop.js';

export const gridCtx = createContext<GridAria>();
export interface GridProps extends AriaProps {
  id?: string;
  label?: string;
  value?: string;
  selectionMode?: 'cell' | 'row';
  colcount?: number;
  rowcount?: number;
  disabled?: boolean;
  editable?: boolean;
  onchange?: AriaEventHandler<AriaEvent>;
}

export type TreeGridProps = GridProps;
export interface GridAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role?: 'grid' | 'treegrid';
  'aria-label'?: string;
  'aria-colcount'?: number;
  'aria-rowcount'?: number;
  'aria-disabled'?: 'true' | 'false';
}

const ROLE_GRID = 'grid';
const ROLE_TREEGRID = 'treegrid';
const ROVE_SELECTOR = '[tabindex]';
const ENABLED_ROVE_SELECTOR = '[tabindex]:not([aria-disabled="true"]):not([disabled])';
const ROW_SELECTOR = '[role="row"]';

export class GridAria<
  E extends BaseElement = HTMLElement,
  T extends GridProps = GridProps,
  A extends GridAttributes<E> = GridAttributes<E>,
> extends Aria<E, T, A> {
  protected gridRole: 'grid' | 'treegrid' = 'grid';
  protected parentRover = roverCtx.get();

  public get value(): string | undefined {
    return this.properties.value;
  }

  public set value(val: string | undefined) {
    this.properties.value = val;
  }

  public get selectionMode(): 'cell' | 'row' {
    return this.properties.selectionMode ?? 'cell';
  }

  public get disabled(): boolean {
    return !!this.properties.disabled;
  }

  public get isRowMode() {
    return this.selectionMode === 'row';
  }

  public get editable(): boolean {
    return !!this.properties.editable;
  }

  public locked = false;

  /**
   * An editable grid's one tab stop: the cell focused last, else the first one to join. Its
   * selection is the cell being edited, which clears when editing ends, so it can't hold the stop.
   */
  public readonly tabStop = createTabStop();

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_GRID}-${uIndex($symbol(ROLE_GRID), true)}`;
    });
    gridCtx.set(this as unknown as GridAria);
    roverCtx.set(this as unknown as Aria<BaseElement>);
    selectionGroup.set(this.properties as Record<string, unknown>);
    this.omittedAttrs.push(
      'id',
      'label',
      'value',
      'editable',
      'selectionMode',
      'colcount',
      'rowcount',
      'disabled',
      'onchange'
    );
    this.update();
  }

  protected override createAttributes(): A {
    const disabled = this.disabled;
    const attrs: Record<string, unknown> = {
      id: this.properties.id,
      role: this.gridRole,
      tabindex: (!this.editable || this.isRowMode) && this.value == null && !disabled ? 0 : undefined,
      'aria-disabled': ariaBoolean(disabled),
      onkeydown: this.handleKeyDown,
    };
    if (this.properties.label) {
      attrs['aria-label'] = this.properties.label;
    }
    if (this.properties.colcount !== undefined) {
      attrs['aria-colcount'] = this.properties.colcount;
    }
    if (this.properties.rowcount !== undefined) {
      attrs['aria-rowcount'] = this.properties.rowcount;
    }
    return attrs as A;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || this.parentRover || this.locked) return;

    if (this.isRowMode) {
      handleRovingKey(this.element, event, {
        manual: true,
        selector: ENABLED_ROVE_SELECTOR,
        bothAxes: false,
      });

      return;
    }

    const target = event.target as HTMLElement;
    if (!target?.matches(ROVE_SELECTOR)) return;
    if (this.move(target, event.key)) {
      event.preventDefault();
    }
  };

  private move(current: HTMLElement, key: string): boolean {
    const root = this.element! as unknown as HTMLElement;
    if (current === root) return this.enterFromGrid(key);
    const rows = Array.from(root.querySelectorAll<HTMLElement>(ROW_SELECTOR));
    const currentRow = current.closest(ROW_SELECTOR) as HTMLElement | null;
    const inRow = (row: HTMLElement | null) =>
      row ? Array.from(row.querySelectorAll<HTMLElement>(ENABLED_ROVE_SELECTOR)) : [];
    const allInRow = (row: HTMLElement) => Array.from(row.querySelectorAll<HTMLElement>(ROVE_SELECTOR));

    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      const cells = inRow(currentRow);
      const idx = cells.indexOf(current);
      if (idx === -1) return false;
      const next = key === 'ArrowRight' ? cells[idx + 1] : cells[idx - 1];
      if (!next) return false;
      next.focus();
      return true;
    }

    if (key === 'Home' || key === 'End') {
      const cells = inRow(currentRow);
      /* istanbul ignore if */
      if (cells.length === 0) return false;
      (key === 'Home' ? cells[0] : cells[cells.length - 1]).focus();
      return true;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown') {
      /* istanbul ignore if */
      if (!currentRow) return false;
      if (!inRow(currentRow).includes(current)) return false;

      const col = allInRow(currentRow).indexOf(current);
      const rowIdx = rows.indexOf(currentRow);
      let nextRow: HTMLElement | undefined;

      if (key === 'ArrowDown') nextRow = rows[rowIdx + 1];
      else if (key === 'ArrowUp') nextRow = rows[rowIdx - 1];
      else if (key === 'PageDown') nextRow = rows[rows.length - 1];
      else nextRow = rows[0];
      if (!nextRow) return false;

      const nextCells = inRow(nextRow);

      /* istanbul ignore if */
      if (nextCells.length === 0) return false;
      const nextAll = allInRow(nextRow);
      const clamped = Math.min(col, nextAll.length - 1);
      const landed = nextAll[clamped] as HTMLElement;

      if (nextCells.includes(landed)) {
        landed.focus();
        return true;
      }

      for (let step = 1; step < nextAll.length; step++) {
        const earlier = nextAll[clamped - step];
        if (earlier && nextCells.includes(earlier)) {
          earlier.focus();
          return true;
        }

        const later = nextAll[clamped + step];
        if (later && nextCells.includes(later)) {
          later.focus();
          return true;
        }
      }

      /* istanbul ignore next */
      return false;
    }

    return false;
  }

  private enterFromGrid(key: string): boolean {
    const cells = Array.from(this.element!.querySelectorAll<HTMLElement>(ENABLED_ROVE_SELECTOR));
    if (cells.length === 0) return false;
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === 'Home') {
      cells[0].focus();
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'End') {
      cells[cells.length - 1].focus();
      return true;
    }
    return false;
  }
}
export class TreeGridAria<
  E extends BaseElement = HTMLElement,
  T extends TreeGridProps = TreeGridProps,
  A extends GridAttributes<E> = GridAttributes<E>,
> extends GridAria<E, T, A> {
  protected override gridRole: 'grid' | 'treegrid' = 'treegrid';

  public constructor(props: Partial<T> = {}) {
    super(props);
    $static(() => {
      const current = this.properties.id as string | undefined;
      if (!current || current.startsWith(`${ROLE_GRID}-`)) {
        this.properties.id = `${ROLE_TREEGRID}-${uIndex($symbol(ROLE_TREEGRID), true)}`;
      }
    });
    this.update();
  }
}
