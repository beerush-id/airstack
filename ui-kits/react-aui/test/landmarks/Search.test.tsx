import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Search } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Search', () => {
  it('marks the facility as a named search landmark', async () => {
    destroy = await runApp(async () => {
      render(
        <Search label="Documentation">
          <input type="search" aria-label="Search documentation" placeholder="Search documentation" />
        </Search>
      );
      const search = screen.getByRole('search', { name: 'Documentation' });
      expect(search).toBeInstanceOf(HTMLElement);
      expect(search.getAttribute('aria-label')).toBe('Documentation');
      expect(screen.getByRole('searchbox', { name: 'Search documentation' })).toBeInstanceOf(HTMLElement);
    });
  });

  it('takes its name from another element when told to', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <h2 id="facility">Product search</h2>
          <Search labelledby="facility">
            <input type="search" aria-label="Query" />
          </Search>
        </>
      );
      const search = screen.getByRole('search', { name: 'Product search' });
      expect(search.getAttribute('aria-labelledby')).toBe('facility');
      expect(search.hasAttribute('label')).toBe(false);
      expect(search.hasAttribute('labelledby')).toBe(false);
    });
  });

  it('stays a landmark when the page names no facility', async () => {
    destroy = await runApp(async () => {
      render(
        <Search>
          <input type="search" aria-label="Query" />
        </Search>
      );
      const search = screen.getByRole('search');
      expect(search.hasAttribute('aria-label')).toBe(false);
      expect(search.hasAttribute('aria-labelledby')).toBe(false);
    });
  });

  it('forwards a consumer ref to the container', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Search ref={ref} label="Documentation">
          <input type="search" aria-label="Query" />
        </Search>
      );
      expect(ref.current).toBe(screen.getByRole('search', { name: 'Documentation' }));
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Search label="Documentation" className="my-search">
          <input type="search" aria-label="Query" />
        </Search>
      );
      const search = screen.getByRole('search', { name: 'Documentation' });
      expect(search.className).toContain('my-search');
      expect(search.className).toContain('aui-search');
      unmount();
      configure({ overrides: true });
      render(
        <Search label="Documentation" className="only-me">
          <input type="search" aria-label="Query" />
        </Search>
      );
      expect(screen.getByRole('search', { name: 'Documentation' }).className).toBe('only-me');
    });
  });
});
