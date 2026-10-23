import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, createContext, setup, stylex } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type GridSelectionMode = 'cell' | 'row';
export type GridSort = 'ascending' | 'descending' | 'none' | 'other';

export type GridProps = ComponentStyles & {
  id?: string;
  label?: string;
  value?: Bindable<string>;
  selectionMode?: GridSelectionMode;
  colcount?: number;
  rowcount?: number;
  disabled?: boolean;
  editable?: boolean;
  children?: ReactNode;
  onchange?: (event: CustomEvent<unknown>) => void;
};

export type TreeGridProps = GridProps;

export type GridRowProps = ComponentStyles & {
  id?: string;
  name?: string;
  rowindex?: number;
  selected?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode;
};

export type GridCellProps = ComponentStyles & {
  id?: string;
  name: string;
  value?: string;
  colindex?: number;
  readonly?: boolean;
  selected?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode;
};

export type GridColumnHeaderProps = ComponentStyles & {
  id?: string;
  name?: string;
  colindex?: number;
  sort?: GridSort;
  disabled?: boolean;
  children?: ReactNode;
};

export type GridRowHeaderProps = ComponentStyles & {
  id?: string;
  name?: string;
  rowindex?: number;
  disabled?: boolean;
  children?: ReactNode;
};

const GRID_ROLE = 'grid';
const TREE_GRID_ROLE = 'treegrid';
const ROW_ROLE = 'grid-row';
const CELL_ROLE = 'grid-cell';
const COLUMN_HEADER_ROLE = 'grid-columnheader';
const ROW_HEADER_ROLE = 'grid-rowheader';

const CELL_OMIT = [...OMIT_KEYS, 'value'];

/** The enclosing grid's props, so a cell can tell whether the grid takes typing. */
const gridProps = createContext<GridProps>();

register('grid', { size: 'sm', color: 'primary' });
register('treeGrid', { size: 'sm', color: 'primary' });
register('gridRow', {});
register('gridCell', {});
register('gridColumnHeader', {});
register('gridRowHeader', {});

/**
 * Two-dimensional table a keyboard can drive. Arrows only move focus — the
 * grid keeps one roving tab stop and commits on `Enter` or a click, writing
 * the chosen cell name back through `value`.
 */
export const Grid = setup<GridProps>((props) => {
  const grid = aria(GRID_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.GRID], props, auiConfig.grid);

  gridProps.set(props);

  return () => (
    <div ref={grid.ref} {...grid.restProps(OMIT_KEYS)} style={gridColumns(props)} className={className()}>
      {props.children}
    </div>
  );
}, 'Grid');

/**
 * The grid with rows-and-expansion semantics. Same coordinator, same parts,
 * same keys; expansion state stays in the consumer's markup.
 */
export const TreeGrid = setup<TreeGridProps>((props) => {
  const grid = aria(TREE_GRID_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.SCALE, AUI_CLASS.GRID, AUI_CLASS.TREE_GRID], props, auiConfig.treeGrid);

  gridProps.set(props);

  return () => (
    <div ref={grid.ref} {...grid.restProps(OMIT_KEYS)} style={gridColumns(props)} className={className()}>
      {props.children}
    </div>
  );
}, 'TreeGrid');

/**
 * Publishes the grid's column count, so every row lines up on one set of columns sized by their
 * content; without `colcount`, rows share the width evenly instead.
 *
 * @param props - The grid's props, for `colcount`.
 * @returns The style the grid's element takes.
 */
function gridColumns(props: GridProps) {
  // A count, not a length: as a string, so it isn't given a unit.
  return stylex({ '--aui-grid-columns': props.colcount == null ? undefined : String(props.colcount) });
}

/**
 * One line of the grid. In `row` mode it carries the name a commit writes and
 * the tab stop; in `cell` mode it holds those back and its cells do the work.
 */
export const GridRow = setup<GridRowProps>((props) => {
  const row = aria(ROW_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.GRID_ROW, props, auiConfig.gridRow);

  return () => (
    <div ref={row.ref} {...row.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'GridRow');

/**
 * One position in the grid. An editable grid turns the picked cell into a text
 * session where `Escape` or a blur commits what was typed.
 */
export const GridCell = setup<GridCellProps>((props) => {
  const grid = gridProps.get();
  const cell = aria(CELL_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.GRID_CELL, props, auiConfig.gridCell);
  // A styling hook only: CSS gives every typeable cell a text cursor before the edit begins.
  const editable = () => (grid?.editable && !props.readonly ? 'true' : undefined);

  return () => (
    <div ref={cell.ref} {...cell.restProps(CELL_OMIT)} data-editable={editable()} className={className()}>
      {props.children}
    </div>
  );
}, 'GridCell');

/**
 * Names a column and announces its sort direction. Never a tab stop and never
 * part of selection, so a click on a header commits nothing.
 */
export const GridColumnHeader = setup<GridColumnHeaderProps>((props) => {
  const header = aria(COLUMN_HEADER_ROLE, props as AnyType);
  const className = () =>
    $families([AUI_CLASS.GRID_CELL, AUI_CLASS.GRID_COLUMN_HEADER], props, auiConfig.gridColumnHeader);

  return () => (
    <div ref={header.ref} {...header.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'GridColumnHeader');

/**
 * Names a line without joining its cells, so the first column can label a row
 * and stay out of the roving set.
 */
export const GridRowHeader = setup<GridRowHeaderProps>((props) => {
  const header = aria(ROW_HEADER_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.GRID_CELL, AUI_CLASS.GRID_ROW_HEADER], props, auiConfig.gridRowHeader);

  return () => (
    <div ref={header.ref} {...header.restProps(OMIT_KEYS)} className={className()}>
      {props.children}
    </div>
  );
}, 'GridRowHeader');
