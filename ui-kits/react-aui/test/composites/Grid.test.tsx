import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Grid, GridCell, GridColumnHeader, GridRow, GridRowHeader, TreeGrid } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

function Departures(props: { disabled?: boolean; value?: string; onchange?: (event: CustomEvent<unknown>) => void }) {
  return (
    <Grid label="Departures" value={props.value} disabled={props.disabled} onchange={props.onchange}>
      <GridRow name="head">
        <GridColumnHeader name="city" colindex={1} sort="ascending">
          City
        </GridColumnHeader>
        <GridColumnHeader name="gate" colindex={2}>
          Gate
        </GridColumnHeader>
      </GridRow>
      <GridRow name="west">
        <GridCell name="ams" colindex={1}>
          Amsterdam
        </GridCell>
        <GridCell name="ams-gate" colindex={2}>
          12
        </GridCell>
      </GridRow>
      <GridRow name="east">
        <GridCell name="ber" colindex={1}>
          Berlin
        </GridCell>
        <GridCell name="ber-gate" colindex={2} disabled>
          TBD
        </GridCell>
      </GridRow>
    </Grid>
  );
}

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Grid', () => {
  it('renders grid, row, cell, and header semantics', async () => {
    destroy = await runApp(async () => {
      render(<Departures />);
      expect(screen.getByRole('grid', { name: 'Departures' })).toBeInstanceOf(HTMLElement);
      expect(screen.getAllByRole('row')).toHaveLength(3);
      expect(screen.getAllByRole('gridcell')).toHaveLength(4);
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
      expect(screen.getByRole('columnheader', { name: 'City' }).getAttribute('aria-sort')).toBe('ascending');
    });
  });

  it('commits the clicked cell and reports the grid value', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(<Departures onchange={(event) => (committed = event.detail)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('gridcell', { name: 'Amsterdam' }));
      });
      expect(committed).toBe('ams');
      expect(screen.getByRole('gridcell', { name: 'Amsterdam' }).getAttribute('aria-selected')).toBe('true');
    });
  });

  it('binds value two-way with the controller', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ cell: 'ams' });
      render(
        <Grid label="Departures" value={$bind(state, 'cell')}>
          <GridRow name="west">
            <GridCell name="ams">Amsterdam</GridCell>
            <GridCell name="ber">Berlin</GridCell>
          </GridRow>
        </Grid>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('gridcell', { name: 'Berlin' }));
      });
      expect(state.cell).toBe('ber');
    });
  });

  it('lifts a cell commit to its row in row mode', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(
        <Grid label="Cabin seats" selectionMode="row" onchange={(event) => (committed = event.detail)}>
          <GridRow name="front">
            <GridRowHeader name="r-front" rowindex={1}>
              Front
            </GridRowHeader>
            <GridCell name="f-a" colindex={2}>
              1A
            </GridCell>
          </GridRow>
          <GridRow name="back">
            <GridRowHeader name="r-back" rowindex={2}>
              Back
            </GridRowHeader>
            <GridCell name="b-a" colindex={2}>
              2A
            </GridCell>
          </GridRow>
        </Grid>
      );
      expect(screen.getAllByRole('rowheader')).toHaveLength(2);
      await act(async () => {
        await userEvent.click(screen.getByRole('gridcell', { name: '2A' }));
      });
      expect(committed).toBe('back');
      const back = screen.getByRole('rowheader', { name: 'Back' }).closest('[role="row"]');
      expect(back?.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('opens a text session on a picked editable cell', async () => {
    destroy = await runApp(async () => {
      render(
        <Grid label="Stock list" editable>
          <GridRow name="fruit">
            <GridCell name="apples" value="12">
              12
            </GridCell>
          </GridRow>
        </Grid>
      );
      await act(async () => {
        await userEvent.click(screen.getByRole('gridcell', { name: '12' }));
      });
      const cell = screen.getByRole('gridcell', { name: '12' });
      expect(cell.getAttribute('aria-selected')).toBe('true');
      expect(cell.getAttribute('contenteditable')).toBe('true');
    });
  });

  it('refuses commits while the grid is disabled', async () => {
    destroy = await runApp(async () => {
      let committed: unknown;
      render(<Departures disabled onchange={(event) => (committed = event.detail)} />);
      await act(async () => {
        await userEvent.click(screen.getByRole('gridcell', { name: 'Amsterdam' }));
      });
      expect(committed).toBeUndefined();
      expect(screen.getByRole('gridcell', { name: 'Amsterdam' }).getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('marks a treegrid host with the treegrid role', async () => {
    destroy = await runApp(async () => {
      render(
        <TreeGrid label="Files">
          <GridRow name="src">
            <GridCell name="src-cell">src</GridCell>
          </GridRow>
        </TreeGrid>
      );
      const treegrid = screen.getByRole('treegrid', { name: 'Files' });
      expect(treegrid.className).toContain('aui-tree-grid');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Grid label="Departures" className="my-grid">
          <GridRow name="west">
            <GridCell name="ams">Amsterdam</GridCell>
          </GridRow>
        </Grid>
      );
      const grid = screen.getByRole('grid', { name: 'Departures' });
      expect(grid.className).toContain('my-grid');
      expect(grid.className).toContain('aui-grid');
      unmount();
      configure({ overrides: true });
      render(
        <Grid label="Departures" className="only-me">
          <GridRow name="west">
            <GridCell name="ams">Amsterdam</GridCell>
          </GridRow>
        </Grid>
      );
      expect(screen.getByRole('grid', { name: 'Departures' }).className).toBe('only-me');
    });
  });
});
