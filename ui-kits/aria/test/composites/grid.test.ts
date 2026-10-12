import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type GridProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

type CellRef = { name: string; el: HTMLElement };

function buildGrid(props: Partial<GridProps>, rows: string[][], host: 'grid' | 'table' = 'grid') {
  const grid = aria('grid', props as GridProps);
  const gridEl = bind(document.createElement(host === 'grid' ? 'div' : 'table'), grid);
  document.body.appendChild(gridEl);

  const built: Array<{ row: { el: HTMLElement; controller: unknown }; cells: CellRef[] }> = [];
  const controllers: Array<{ destroy: () => void }> = [grid];

  rows.forEach((names, rowIndex) => {
    const slot = component().run(() => {
      const row = aria('grid-row', { name: `r${rowIndex}`, rowindex: rowIndex + 1 });
      const rowEl = bind(document.createElement('div'), row);
      gridEl.appendChild(rowEl);
      controllers.push(row);

      const cells: CellRef[] = [];

      names.forEach((name, columnIndex) => {
        const cell = aria('grid-cell', { name, colindex: columnIndex + 1 });
        const el = bind(document.createElement('div'), cell);
        rowEl.appendChild(el);
        controllers.push(cell);
        cells.push({ name, el });
      });

      return { row, rowEl, cells };
    });

    built.push({ row: { el: slot.rowEl, controller: slot.row }, cells: slot.cells });
  });

  const cleanup = () => {
    for (const controller of controllers.reverse()) {
      controller.destroy();
    }

    gridEl.remove();
  };

  return { grid, gridEl, rows: built, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const focused = () => (document.activeElement as HTMLElement)?.getAttribute('data-name') ?? null;

describe('Grid - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Two-Dimensional Coordinate Navigation Invariant', () => {
    it('moves focus across rows and columns and leaves the selection where it was', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: 'a1', selectionMode: 'cell' });
          const { gridEl, rows, cleanup } = buildGrid(props, [
            ['a1', 'a2', 'a3'],
            ['b1', 'b2', 'b3'],
            ['c1', 'c2', 'c3'],
          ]);

          rows.forEach((row, rowIndex) => {
            row.cells.forEach((cell, columnIndex) => {
              cell.el.dataset.name = cell.name;
              expect(cell.el.getAttribute('aria-colindex')).toBe(String(columnIndex + 1));
            });
            (row.row as unknown as { el: HTMLElement }).el.dataset.name = `r${rowIndex}`;
          });

          const at = (name: string) => rows.flatMap((row) => row.cells).find((cell) => cell.name === name)?.el;

          at('a1')?.focus();
          expect(document.activeElement).toBe(at('a1'));

          press(at('a1') as HTMLElement, 'ArrowRight');
          expect(focused()).toBe('a2');

          press(at('a2') as HTMLElement, 'ArrowDown');
          expect(focused()).toBe('b2');

          press(at('b2') as HTMLElement, 'ArrowLeft');
          expect(focused()).toBe('b1');

          press(at('b1') as HTMLElement, 'ArrowUp');
          expect(focused()).toBe('a1');

          press(at('a1') as HTMLElement, 'End');
          expect(focused()).toBe('a3');

          press(at('a3') as HTMLElement, 'Home');
          expect(focused()).toBe('a1');

          // Traversal is not selection: arrows moved focus and nothing else
          expect(props.value).toBe('a1');
          expect(at('a1')?.getAttribute('aria-selected')).toBe('true');
          expect(at('a3')?.getAttribute('aria-selected')).toBe('false');

          // One tab stop, travelling with focus
          const stops = rows.flatMap((row) => row.cells).filter((cell) => cell.el.getAttribute('tabindex') === '0');
          expect(stops).toHaveLength(1);
          expect(stops[0].el).toBe(at('a1'));

          gridEl.remove();
          cleanup();
        });
      }));

    it('commits with Space and Enter through the same click path as pointer', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: 'a1', selectionMode: 'cell' });
          const { rows, cleanup } = buildGrid(props, [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ]);

          const target = rows[1].cells[1].el;
          const activations: string[] = [];
          target.addEventListener('click', () => activations.push('clicked'));

          target.focus();
          press(target, ' ');
          expect(activations).toEqual([]);

          const enter = press(target, 'Enter');
          expect(enter.defaultPrevented).toBe(false);
          expect(activations).toHaveLength(1);
          expect(props.value).toBe('b2');

          cleanup();
        });
      }));
  });

  describe('Cell Selection & Focus Virtualization Invariant', () => {
    it('keeps one selected cell in cell selection mode', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: undefined, selectionMode: 'cell' });
          const { grid, rows, cleanup } = buildGrid(props, [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ]);

          expect(grid.attributes.role).toBe('grid');

          const [a1, a2] = rows[0].cells;
          expect(a1.el.getAttribute('aria-selected')).toBe('false');

          a1.el.click();
          expect(props.value).toBe('a1');
          expect(a1.el.getAttribute('aria-selected')).toBe('true');

          a2.el.click();
          expect(props.value).toBe('a2');
          expect(a1.el.getAttribute('aria-selected')).toBe('false');
          expect(a2.el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));

    it('lifts selection to the row in row selection mode', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: undefined, selectionMode: 'row' });
          const { rows, cleanup } = buildGrid(props, [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ]);

          rows[0].cells[1].el.click();

          expect(props.value).toBe('r0');
          expect(rows[0].row.el.getAttribute('aria-selected')).toBe('true');
          expect(rows[1].row.el.getAttribute('aria-selected')).toBe('false');

          // The selected row's index is announced for off-screen rows
          expect(rows[0].row.el.getAttribute('aria-rowindex')).toBe('1');
          expect(rows[1].row.el.getAttribute('aria-rowindex')).toBe('2');

          rows[1].cells[0].el.click();
          expect(props.value).toBe('r1');
          expect(rows[0].row.el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));

    it('declares a readonly cell and a disabled cell as different conditions', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid');
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);

          const locked = component().run(() => {
            const cell = aria('grid-cell', { name: 'formula', readonly: true });
            const el = bind(document.createElement('div'), cell);
            gridEl.appendChild(el);
            return { cell, el };
          });

          const gone = component().run(() => {
            const cell = aria('grid-cell', { name: 'removed', disabled: true });
            const el = bind(document.createElement('div'), cell);
            gridEl.appendChild(el);
            return { cell, el };
          });

          expect(locked.el.getAttribute('aria-readonly')).toBe('true');
          expect(gone.el.getAttribute('aria-disabled')).toBe('true');

          // A readonly cell is still the grid's own content, not a removed one
          expect(locked.el.getAttribute('aria-disabled')).not.toBe('true');

          grid.destroy();
          locked.cell.destroy();
          gone.cell.destroy();
          gridEl.remove();
        });
      }));

    it('declares the full grid extent even when only part of it is rendered', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ colcount: 12, rowcount: 250 });
          const grid = aria('grid', props);
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);

          expect(gridEl.getAttribute('aria-colcount')).toBe('12');
          expect(gridEl.getAttribute('aria-rowcount')).toBe('250');

          props.rowcount = 500;
          expect(gridEl.getAttribute('aria-rowcount')).toBe('500');

          // A grid with no label declared stays unnamed rather than inventing one
          expect(gridEl.hasAttribute('aria-label')).toBe(false);
          expect(gridEl.hasAttribute('aria-labelledby')).toBe(false);

          grid.destroy();
          gridEl.remove();
        });
      }));
  });

  describe('Row/Column Header Association Invariant', () => {
    it('compiles header roles with their index and sort state', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { label: 'Invoices' });
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);

          const headerRow = component().run(() => {
            const row = aria('grid-row', { rowindex: 1 });
            const rowEl = bind(document.createElement('div'), row);
            gridEl.appendChild(rowEl);

            const nameHeader = aria('grid-columnheader', { name: 'name', colindex: 1 });
            const nameEl = bind(document.createElement('div'), nameHeader);
            rowEl.appendChild(nameEl);

            const totalHeader = aria('grid-columnheader', { name: 'total', colindex: 2, sort: 'none' });
            const totalEl = bind(document.createElement('div'), totalHeader);
            rowEl.appendChild(totalEl);

            return { row, rowEl, nameHeader, nameEl, totalHeader, totalEl };
          });

          const bodyRow = component().run(() => {
            const row = aria('grid-row', { name: 'inv-1', rowindex: 2 });
            const rowEl = bind(document.createElement('div'), row);
            gridEl.appendChild(rowEl);

            const rowHeader = aria('grid-rowheader', { rowindex: 2 });
            const rowHeaderEl = bind(document.createElement('div'), rowHeader);
            rowEl.appendChild(rowHeaderEl);

            const cell = aria('grid-cell', { name: 'amount', colindex: 1 });
            const cellEl = bind(document.createElement('div'), cell);
            rowEl.appendChild(cellEl);

            return { row, rowEl, rowHeader, rowHeaderEl, cell, cellEl };
          });

          expect(gridEl.getAttribute('role')).toBe('grid');
          expect(gridEl.getAttribute('aria-label')).toBe('Invoices');
          expect(headerRow.nameEl.getAttribute('role')).toBe('columnheader');
          expect(headerRow.nameEl.getAttribute('aria-colindex')).toBe('1');
          expect(headerRow.totalEl.getAttribute('aria-sort')).toBe('none');
          expect(bodyRow.rowHeaderEl.getAttribute('role')).toBe('rowheader');
          expect(bodyRow.rowHeaderEl.getAttribute('aria-rowindex')).toBe('2');
          expect(bodyRow.cellEl.getAttribute('role')).toBe('gridcell');

          // Sorting is a projection of the header's own state
          headerRow.totalHeader.assign({ sort: 'descending' });
          expect(headerRow.totalEl.getAttribute('aria-sort')).toBe('descending');

          grid.destroy();
          headerRow.row.destroy();
          headerRow.nameHeader.destroy();
          headerRow.totalHeader.destroy();
          bodyRow.row.destroy();
          bodyRow.rowHeader.destroy();
          bodyRow.cell.destroy();
          gridEl.remove();
        });
      }));

    it('announces a hierarchical grid as a treegrid', () =>
      scope.run(() => {
        component().run(() => {
          const treegrid = aria('treegrid', { label: 'File tree' });
          const treeEl = bind(document.createElement('div'), treegrid);
          document.body.appendChild(treeEl);

          expect(treegrid.attributes.role).toBe('treegrid');
          expect(treeEl.getAttribute('role')).toBe('treegrid');
          expect(treeEl.getAttribute('aria-label')).toBe('File tree');

          const row = component().run(() => {
            const part = aria('grid-row', { name: 'dir-1' });
            const el = bind(document.createElement('div'), part);
            treeEl.appendChild(el);
            return { part, el };
          });

          expect(row.el.getAttribute('role')).toBe('row');

          treegrid.destroy();
          row.part.destroy();
          treeEl.remove();
        });
      }));
  });
});
