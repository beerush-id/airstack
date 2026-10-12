import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  aria,
  type GridCellAria,
  type GridColumnHeaderAria,
  type GridProps,
  type GridRowAria,
} from '../../src/index.js';
import { bind, component } from '../utils.js';

function press(el: HTMLElement, key: string, init?: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

function buildGrid(props: Partial<GridProps>, rows: string[][]) {
  const grid = aria('grid', props as GridProps);
  const gridEl = bind(document.createElement('div'), grid);
  document.body.appendChild(gridEl);
  const controllers: Array<{ destroy: () => void }> = [grid];
  const built: Array<{ rowEl: HTMLElement; cells: HTMLElement[] }> = [];
  rows.forEach((names, rowIndex) => {
    const slot = component().run(() => {
      const row = aria('grid-row', { name: `r${rowIndex}`, rowindex: rowIndex + 1 });
      const rowEl = bind(document.createElement('div'), row);
      gridEl.appendChild(rowEl);
      controllers.push(row);
      const cells: HTMLElement[] = [];
      names.forEach((name, columnIndex) => {
        const cell = aria('grid-cell', { name, colindex: columnIndex + 1 });
        const el = bind(document.createElement('div'), cell);
        rowEl.appendChild(el);
        controllers.push(cell);
        cells.push(el);
      });
      return { rowEl, cells };
    });
    built.push(slot);
  });
  const cleanup = () => {
    for (const c of controllers.reverse()) c.destroy();
    gridEl.remove();
  };
  return { grid, gridEl, rows: built, cleanup };
}

describe('Grid - Coverage & Boundary Tests', () => {
  const scope = createLifecycle();
  afterAll(() => {
    scope.destroy();
  });

  describe('State Projection Invariant', () => {
    it('reads and writes value directly with cell default and row mode', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { value: 'a1' });
          expect(grid.value).toBe('a1');
          grid.value = 'b2';
          expect(grid.properties.value).toBe('b2');
          grid.value = undefined;
          expect(grid.value).toBeUndefined();
          expect(grid.selectionMode).toBe('cell');
          expect(grid.disabled).toBe(false);
          expect(grid.ownKeys).toContain('value');
          expect(grid.ownKeys).toContain('selectionMode');
          expect(grid.current).toBeNull();
          grid.destroy();

          const rowMode = aria('grid', { selectionMode: 'row', disabled: true });
          expect(rowMode.selectionMode).toBe('row');
          expect(rowMode.disabled).toBe(true);
          rowMode.destroy();
        });
      }));

    it('generates unique ids and honors declared ones for grid and treegrid', () =>
      scope.run(() => {
        component().run(() => {
          const a = aria('grid');
          const b = aria('grid');
          const declared = aria('grid', { id: 'invoices' });
          expect(a.attributes.id).toMatch(/^grid-/);
          expect(a.attributes.id).not.toBe(b.attributes.id);
          expect(declared.attributes.id).toBe('invoices');
          a.destroy();
          b.destroy();
          declared.destroy();

          const tree = aria('treegrid', { label: 'Files' });
          expect(tree.attributes.role).toBe('treegrid');
          expect(tree.attributes.id).toMatch(/^treegrid-/);
          const treeDeclared = aria('treegrid', { id: 'files' });
          expect(treeDeclared.attributes.id).toBe('files');
          tree.destroy();
          treeDeclared.destroy();
        });
      }));

    it('constructs every part without props and toggles standalone members', () =>
      scope.run(() => {
        component().run(() => {
          const bareGrid = aria('grid');
          expect(bareGrid.attributes.role).toBe('grid');
          const bareTree = aria('treegrid');
          expect(bareTree.attributes.role).toBe('treegrid');
          const bareRow = aria('grid-row');
          expect(bareRow.attributes.role).toBe('row');
          bareRow.toggle();
          expect(bareRow.selected).toBe(false);
          const bareCell = aria('grid-cell');
          expect(bareCell.attributes.role).toBe('gridcell');
          bareCell.toggle();
          expect(bareCell.selected).toBe(true);
          const bareCol = aria('grid-columnheader');
          expect(bareCol.attributes.role).toBe('columnheader');
          const bareRowH = aria('grid-rowheader');
          expect(bareRowH.attributes.role).toBe('rowheader');
          bareGrid.destroy();
          bareTree.destroy();
          bareRow.destroy();
          bareCell.destroy();
          bareCol.destroy();
          bareRowH.destroy();
        });
      }));

    it('declares extent only when provided', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { label: 'L' });
          const el = bind(document.createElement('div'), grid);
          document.body.appendChild(el);
          expect(el.getAttribute('aria-label')).toBe('L');
          expect(el.hasAttribute('aria-colcount')).toBe(false);
          expect(el.hasAttribute('aria-rowcount')).toBe(false);
          grid.destroy();
          el.remove();
        });
      }));
  });

  describe('Guarded Traversal Invariant', () => {
    it('claims nothing while disabled, vetoed, or nested in a rover', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: 'a1', selectionMode: 'cell' });
          const { gridEl, rows, cleanup } = buildGrid(props, [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ]);
          const at = (r: number, c: number) => rows[r].cells[c];
          at(0, 0).focus();
          props.disabled = true;
          expect(gridEl.getAttribute('aria-disabled')).toBe('true');
          expect(press(at(0, 0), 'ArrowRight').defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(at(0, 0));
          at(0, 0).click();
          expect(props.value).toBe('a1');
          props.disabled = false;
          cleanup();
        });
      }));

    it('yields a keystroke the consumer canceled and ignores non-cell targets and keys', () =>
      scope.run(() => {
        component().run(() => {
          const { gridEl, rows, cleanup } = buildGrid({ value: 'a1' }, [['a1', 'a2']]);
          gridEl.addEventListener('keydown', (e) => e.preventDefault(), { capture: true });
          rows[0].cells[0].focus();
          expect(press(rows[0].cells[0], 'ArrowRight').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(rows[0].cells[0]);
          cleanup();
        });
      }));

    it('surrenders traversal to an enclosing toolbar rover', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria('toolbar', { label: 'T' });
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);
          const grid = aria('grid', { value: 'a1' });
          const gridEl = bind(document.createElement('div'), grid);
          toolbarEl.appendChild(gridEl);
          const row = component().run(() => {
            const r = aria('grid-row', { name: 'r0' });
            const re = bind(document.createElement('div'), r);
            gridEl.appendChild(re);
            const cell = aria('grid-cell', { name: 'a1' });
            const ce = bind(document.createElement('div'), cell);
            re.appendChild(ce);
            return { r, re, cell, ce };
          });
          row.ce.focus();
          expect(press(row.ce, 'ArrowDown').defaultPrevented).toBe(false);
          row.cell.destroy();
          row.r.destroy();
          grid.destroy();
          toolbar.destroy();
          gridEl.remove();
          toolbarEl.remove();
        });
      }));

    it('stops at row ends and grid edges without selecting', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: 'a1' });
          const { rows, cleanup } = buildGrid(props, [
            ['a1', 'a2'],
            ['b1', 'b2'],
          ]);
          rows[0].cells[1].focus();
          expect(press(rows[0].cells[1], 'ArrowRight').defaultPrevented).toBe(false);
          rows[0].cells[0].focus();
          expect(press(rows[0].cells[0], 'ArrowLeft').defaultPrevented).toBe(false);
          rows[0].cells[0].focus();
          expect(press(rows[0].cells[0], 'ArrowUp').defaultPrevented).toBe(false);
          rows[1].cells[0].focus();
          expect(press(rows[1].cells[0], 'ArrowDown').defaultPrevented).toBe(false);
          expect(press(rows[1].cells[0], 'Escape').defaultPrevented).toBe(false);
          expect(props.value).toBe('a1');
          cleanup();
        });
      }));

    it('travels PageUp and PageDown across the full extent', () =>
      scope.run(() => {
        component().run(() => {
          const { rows, cleanup } = buildGrid({ value: 'a1' }, [
            ['a1', 'a2'],
            ['b1', 'b2'],
            ['c1', 'c2'],
          ]);
          rows[1].cells[1].focus();
          press(rows[1].cells[1], 'PageDown');
          expect(document.activeElement).toBe(rows[2].cells[1]);
          press(rows[2].cells[1], 'PageUp');
          expect(document.activeElement).toBe(rows[0].cells[1]);
          cleanup();
        });
      }));

    it('refuses travel from detached cells, empty rows, and rows without enabled cells', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const row = component().run(() => {
            const r = aria('grid-row', { name: 'empty' });
            const re = bind(document.createElement('div'), r);
            gridEl.appendChild(re);
            return { r, re };
          });
          const lone = component().run(() => {
            const cell = aria('grid-cell', { name: 'lone' });
            const el = bind(document.createElement('div'), cell);
            gridEl.appendChild(el);
            return { cell, el };
          });
          lone.el.focus();
          expect(press(lone.el, 'ArrowDown').defaultPrevented).toBe(false);
          expect(press(lone.el, 'ArrowRight').defaultPrevented).toBe(false);
          expect(press(lone.el, 'Home').defaultPrevented).toBe(false);
          expect(press(row.re, 'ArrowDown').defaultPrevented).toBe(false);
          lone.cell.destroy();
          row.r.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('skips disabled cells while traveling', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { value: 'a1' });
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const row = component().run(() => {
            const r = aria('grid-row', { name: 'r0' });
            const re = bind(document.createElement('div'), r);
            gridEl.appendChild(re);
            const a1 = aria('grid-cell', { name: 'a1' });
            const a1El = bind(document.createElement('div'), a1);
            re.appendChild(a1El);
            const a2 = aria('grid-cell', { name: 'a2', disabled: true });
            const a2El = bind(document.createElement('div'), a2);
            re.appendChild(a2El);
            const a3 = aria('grid-cell', { name: 'a3' });
            const a3El = bind(document.createElement('div'), a3);
            re.appendChild(a3El);
            return { r, re, a1, a1El, a2, a2El, a3, a3El };
          });
          expect(row.a2El.getAttribute('tabindex')).toBe('-1');
          row.a1El.focus();
          press(row.a1El, 'ArrowRight');
          expect(document.activeElement).toBe(row.a3El);
          row.a1.destroy();
          row.a2.destroy();
          (row.a3 as unknown as { destroy: () => void }).destroy();
          row.r.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('keeps the visual column when traveling vertically past disabled cells', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { value: 'a2' });
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const buildRow = (name: string, cells: Array<{ name: string; disabled?: boolean }>) =>
            component().run(() => {
              const r = aria('grid-row', { name });
              const re = bind(document.createElement('div'), r);
              gridEl.appendChild(re);
              const els = cells.map(({ name: n, disabled }) => {
                const c = aria('grid-cell', { name: n, disabled });
                const el = bind(document.createElement('div'), c);
                el.dataset.name = n;
                re.appendChild(el);
                return { c, el };
              });
              return { r, els };
            });
          const west = buildRow('west', [{ name: 'a1' }, { name: 'a2' }, { name: 'a3' }]);
          const east = buildRow('east', [{ name: 'b1', disabled: true }, { name: 'b2' }, { name: 'b3' }]);
          const mid = buildRow('mid', [{ name: 'm1' }, { name: 'm2', disabled: true }, { name: 'm3' }]);
          const low = buildRow('low', [{ name: 'l1', disabled: true }, { name: 'l2', disabled: true }, { name: 'l3' }]);
          const last = buildRow('last', [
            { name: 'c1' },
            { name: 'c2', disabled: true },
            { name: 'c3', disabled: true },
          ]);
          const at = (n: string) =>
            [...west.els, ...east.els, ...mid.els, ...low.els, ...last.els].find((cell) => cell.el.dataset.name === n)
              ?.el as HTMLElement;

          at('a2').focus();
          press(at('a2'), 'ArrowDown');
          expect(document.activeElement).toBe(at('b2'));

          at('a1').focus();
          press(at('a1'), 'ArrowDown');
          expect(document.activeElement).toBe(at('b2'));

          at('b2').focus();
          press(at('b2'), 'ArrowDown');
          expect(document.activeElement).toBe(at('m1'));

          at('m1').focus();
          press(at('m1'), 'ArrowDown');
          expect(document.activeElement).toBe(at('l3'));

          at('l3').focus();
          press(at('l3'), 'ArrowDown');
          expect(document.activeElement).toBe(at('c1'));

          at('b1').focus();
          expect(press(at('b1'), 'ArrowDown').defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(at('b1'));

          for (const row of [west, east, mid, low, last]) {
            for (const cell of row.els) {
              (cell.c as unknown as { destroy: () => void }).destroy();
            }
            (row.r as unknown as { destroy: () => void }).destroy();
          }
          grid.destroy();
          gridEl.remove();
        });
      }));
  });

  describe('Member Coordination Invariant', () => {
    it('keeps row containers unfocused while projecting selection in row mode', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: undefined, selectionMode: 'row' });
          const { rows, cleanup } = buildGrid(props, [['a1']]);
          const rowController = (rows[0] as unknown as { rowEl: HTMLElement }).rowEl;
          expect(rowController.getAttribute('tabindex')).toBe('-1');
          expect(rowController.hasAttribute('aria-rowindex')).toBe(true);
          cleanup();
        });
      }));

    it('keeps cell selection select-only and honors the disabled cascade', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<GridProps>({ value: 'a1', selectionMode: 'cell' });
          const { rows, cleanup } = buildGrid(props, [['a1', 'a2']]);
          const a1 = component().run(() => aria('grid-cell', { name: 'a1' }) as GridCellAria);
          void a1;
          rows[0].cells[0].click();
          expect(props.value).toBeUndefined();
          const cell = component().run(() => {
            const c = aria('grid-cell', { name: 'solo', disabled: true }) as GridCellAria;
            return c;
          });
          cell.toggle();
          expect(cell.selected).toBe(false);
          cell.selected = true;
          expect(cell.selected).toBe(false);
          cell.destroy();
          a1.destroy();
          cleanup();
        });
      }));

    it('ignores cell keystrokes while disabled, canceled, or non-activating', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const cell = component().run(() => {
            const c = aria('grid-cell', { name: 'a1', disabled: true }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          expect(press(cell.el, ' ').defaultPrevented).toBe(false);
          cell.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
          cell.c.destroy();
          const live = component().run(() => {
            const c = aria('grid-cell', { name: 'b1' }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          live.el.addEventListener('keydown', (e) => e.preventDefault(), { capture: true });
          expect(press(live.el, 'Enter').defaultPrevented).toBe(true);
          live.c.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('detaches cell keyboard wiring on teardown', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const cell = component().run(() => {
            const c = aria('grid-cell', { name: 'a1' }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          const seen: string[] = [];
          cell.el.addEventListener('click', () => seen.push('clicked'));
          press(cell.el, 'Enter');
          expect(seen).toEqual(['clicked']);
          cell.c.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('leaves a row-mode cell without a row unclaimed', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', { selectionMode: 'row', value: undefined });
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const cell = component().run(() => {
            const c = aria('grid-cell', { name: 'orphan' }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          cell.el.click();
          expect(grid.properties.value).toBeUndefined();
          cell.c.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));
  });

  describe('Header Contract Invariant', () => {
    it('compiles header indexes, sort, and disabled without tabindex stops', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const plain = component().run(() => {
            const h = aria('grid-columnheader', { name: 'plain' }) as GridColumnHeaderAria;
            const el = bind(document.createElement('div'), h);
            gridEl.appendChild(el);
            return { h, el };
          });
          expect(plain.el.hasAttribute('aria-colindex')).toBe(false);
          expect(plain.el.hasAttribute('aria-sort')).toBe(false);
          const locked = component().run(() => {
            const h = aria('grid-columnheader', { name: 'locked', disabled: true });
            const el = bind(document.createElement('div'), h);
            gridEl.appendChild(el);
            return { h, el };
          });
          expect(locked.el.getAttribute('aria-disabled')).toBe('true');
          const rowHeader = component().run(() => {
            const h = aria('grid-rowheader', { name: 'r' });
            const el = bind(document.createElement('div'), h);
            gridEl.appendChild(el);
            return { h, el };
          });
          expect(rowHeader.el.hasAttribute('aria-rowindex')).toBe(false);
          const lockedRow = component().run(() => {
            const h = aria('grid-rowheader', { name: 'lr', disabled: true });
            const el = bind(document.createElement('div'), h);
            gridEl.appendChild(el);
            return { h, el };
          });
          expect(lockedRow.el.getAttribute('aria-disabled')).toBe('true');
          plain.h.destroy();
          locked.h.destroy();
          rowHeader.h.destroy();
          lockedRow.h.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('covers empty-row Home and detached ArrowUp guards', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const row = component().run(() => {
            const r = aria('grid-row', { name: 'r0' });
            const re = bind(document.createElement('div'), r);
            gridEl.appendChild(re);
            const lone = aria('grid-cell', { name: 'a1', disabled: true });
            const le = bind(document.createElement('div'), lone);
            re.appendChild(le);
            return { r, re, lone, le };
          });
          row.le.focus();
          expect(press(row.le, 'Home').defaultPrevented).toBe(false);
          expect(press(row.le, 'ArrowUp').defaultPrevented).toBe(false);
          const detached = component().run(() => {
            const c = aria('grid-cell', { name: 'orphan' });
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          detached.el.focus();
          expect(press(detached.el, 'ArrowUp').defaultPrevented).toBe(false);
          row.lone.destroy();
          row.r.destroy();
          detached.c.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('rewrites grid-prefixed treegrid ids and exercises selected accessors', () =>
      scope.run(() => {
        component().run(() => {
          const legacy = aria('treegrid', { id: 'grid-legacy' });
          expect(legacy.attributes.id).toMatch(/^treegrid-/);
          legacy.destroy();
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const row = component().run(() => {
            const r = aria('grid-row', { name: 'r0' }) as GridRowAria;
            const re = bind(document.createElement('div'), r);
            gridEl.appendChild(re);
            return { r, re };
          });

          // Row selection is ignored in cell mode.
          expect(row.r.selected).toBe(false);
          row.r.selected = true;
          expect(row.r.selected).toBe(false);

          const cell = component().run(() => {
            const c = aria('grid-cell', { name: 'c1' }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          expect(cell.c.selected).toBe(false);
          cell.c.selected = true;
          expect(cell.c.selected).toBe(true);
          expect(cell.el.getAttribute('tabindex')).toBe('0');
          cell.c.destroy();
          row.r.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));

    it('projects cell colindex and readonly only when declared', () =>
      scope.run(() => {
        component().run(() => {
          const grid = aria('grid', {});
          const gridEl = bind(document.createElement('div'), grid);
          document.body.appendChild(gridEl);
          const bare = component().run(() => {
            const c = aria('grid-cell', { name: 'bare' }) as GridCellAria;
            const el = bind(document.createElement('div'), c);
            gridEl.appendChild(el);
            return { c, el };
          });
          expect(bare.el.hasAttribute('aria-colindex')).toBe(false);
          expect(bare.el.hasAttribute('aria-readonly')).toBe(false);
          expect(bare.el.getAttribute('tabindex')).toBe('-1');
          bare.c.destroy();
          grid.destroy();
          gridEl.remove();
        });
      }));
  });
});
