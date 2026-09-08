# Grid Specification

A grid is an interactive widget containing one or more rows of cells. The user can navigate between cells in two dimensions using keyboard arrow keys.

### Composite Parts
- **`Grid`**: WAI-ARIA `grid` / `treegrid`
- **`Row`**: WAI-ARIA `row`
- **`GridCell`**: WAI-ARIA `gridcell`
- **`ColumnHeader`**: WAI-ARIA `columnheader`
- **`RowHeader`**: WAI-ARIA `rowheader`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`grid`** | Interactive tabular structure (`<table>` or `<div>`). | `role="grid"` / `role="treegrid"`, `aria-label` / `aria-labelledby`, `aria-colcount`, `aria-rowcount`. | 2D roving focus coordinator. Manages arrow key navigation across rows and columns. |
| **`row`** | Row container (`<tr>` or `<div>`). | `role="row"`, `aria-selected` (if selectable), `aria-rowindex`. | Row container and selection coordinator. |
| **`gridcell`** | Interactive cell (`<td>` or `<div>`). | `role="gridcell"`, `aria-selected` (if selectable), `aria-readonly`, `aria-colindex`. | Interactive target receiving 2D roving focus. |
| **`columnheader`** | Column header (`<th>` or `<div>`). | `role="columnheader"`, `aria-sort`, `aria-colindex`. | Column header; sortable action trigger. |
| **`rowheader`** | Row header (`<th>` or `<div>`). | `role="rowheader"`, `aria-rowindex`. | Row header labeling row contents. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `GridProps`
```ts
export interface GridProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Active cell or row identifier */
  value?: string;
  /** Row vs cell selection mode */
  selectionMode?: 'cell' | 'row';
  /** Total number of columns in the grid (aria-colcount) */
  colcount?: number;
  /** Total number of rows in the grid (aria-rowcount) */
  rowcount?: number;
  disabled?: boolean;
}
```

#### `TreegridProps`
```ts
export interface TreegridProps extends GridProps {}
```

#### `RowProps`
```ts
export interface RowProps {
  /** Row identifier (used when `selectionMode: 'row'`) */
  name?: string;
  /** 1-based row index (aria-rowindex) */
  rowindex?: number;
  /** Initial selection hint when uncontrolled */
  selected?: boolean;
  disabled?: boolean;
}
```

#### `GridCellProps`
```ts
export interface GridCellProps {
  /** Cell identifier or name */
  name?: string;
  /** 1-based column index (aria-colindex) */
  colindex?: number;
  /** Whether the cell is readonly */
  readonly?: boolean;
  /** Initial selection hint when uncontrolled */
  selected?: boolean;
  disabled?: boolean;
}
```

#### `ColumnHeaderProps`
```ts
export interface ColumnHeaderProps {
  /** Column header name */
  name?: string;
  /** 1-based column index (aria-colindex) */
  colindex?: number;
  /** Sort direction (aria-sort) */
  sort?: 'ascending' | 'descending' | 'none' | 'other';
  disabled?: boolean;
}
```

#### `RowHeaderProps`
```ts
export interface RowHeaderProps {
  /** Row header name */
  name?: string;
  /** 1-based row index (aria-rowindex) */
  rowindex?: number;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Grid: 2D roving focus coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'grid',
  props?: GridProps
): GridAria<E>;

// Treegrid: Hierarchical 2D grid coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'treegrid',
  props?: TreegridProps
): TreegridAria<E>;

// Row: Row container and selection coordinator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'row',
  props?: RowProps
): RowAria<E>;

// GridCell: Interactive target receiving 2D roving focus
export function aria<E extends BaseElement = HTMLElement>(
  role: 'gridcell',
  props: GridCellProps
): GridCellAria<E>;

// ColumnHeader: Interactive column header
export function aria<E extends BaseElement = HTMLElement>(
  role: 'columnheader',
  props?: ColumnHeaderProps
): ColumnHeaderAria<E>;

// RowHeader: Row header labeling row contents
export function aria<E extends BaseElement = HTMLElement>(
  role: 'rowheader',
  props?: RowHeaderProps
): RowHeaderAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard Navigation**:
   - `ArrowUp` / `ArrowDown`: Moves focus vertically between rows in the same column.
   - `ArrowLeft` / `ArrowRight`: Moves focus horizontally between cells in the same row.
   - `Home` / `End`: Moves focus to the first / last cell in the row.
   - `PageUp` / `PageDown`: Scrolls rows and moves focus vertically.
   - Grid declares no `manual` prop: arrows move focus only and never select; `Space`/`Enter` activates.

2. **State Projection**: `value` reads and writes props directly. Props is the single source of state.
