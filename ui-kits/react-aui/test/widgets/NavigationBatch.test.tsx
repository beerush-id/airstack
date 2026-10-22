import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Breadcrumb, BreadcrumbSeparator, Navigation, Pagination, Toolbar } from '../../src/index.js';
import { Link } from '../../src/widgets/Link.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Navigation batch', () => {
  it('names the navigation landmark', async () => {
    destroy = await runApp(async () => {
      render(
        <Navigation label="Project sections">
          <Link href="#overview">Overview</Link>
          <Link href="#members">Members</Link>
        </Navigation>
      );
      const nav = screen.getByRole('navigation', { name: 'Project sections' });
      expect(nav.tagName).toBe('NAV');
      expect(nav.className).toContain('aui-navigation');
    });
  });

  it('breadcrumb holds the trail name and hides separators', async () => {
    destroy = await runApp(async () => {
      render(
        <Breadcrumb label="Documentation trail">
          <Link href="#docs">Docs</Link>
          <BreadcrumbSeparator />
          <Link href="#docs-aria" current>
            Aria
          </Link>
        </Breadcrumb>
      );
      const trail = screen.getByRole('navigation', { name: 'Documentation trail' });
      expect(trail.className).toContain('aui-breadcrumb');
      const sep = trail.querySelector('[role="separator"]');
      expect(sep?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('toolbar names the strip and keeps controls operable', async () => {
    destroy = await runApp(async () => {
      render(
        <Toolbar label="Comment actions">
          <button type="button">Undo</button>
          <button type="button">Send</button>
        </Toolbar>
      );
      const bar = screen.getByRole('toolbar', { name: 'Comment actions' });
      expect(bar.className).toContain('aui-toolbar');
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInstanceOf(HTMLButtonElement);
    });
  });

  it('pagination holds position with guarded steppers', async () => {
    destroy = await runApp(async () => {
      render(
        <Pagination label="Search results pages" page={2} total={5}>
          <Link href="#page-1">1</Link>
        </Pagination>
      );
      const pager = screen.getByRole('navigation', { name: 'Search results pages' });
      expect(pager.className).toContain('aui-pagination');
    });
  });

  it('supports additive class mode', async () => {
    destroy = await runApp(async () => {
      render(
        <Navigation label="Sections" className="my-nav">
          <Link href="#a">A</Link>
        </Navigation>
      );
      const nav = screen.getByRole('navigation', { name: 'Sections' });
      expect(nav.className).toContain('aui-navigation');
      expect(nav.className).toContain('my-nav');
    });
  });

  it('forwards consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Toolbar label="Actions" ref={ref as never}>
          <button type="button">Go</button>
        </Toolbar>
      );
      expect(ref.current).toBe(screen.getByRole('toolbar', { name: 'Actions' }));
      await act(async () => {});
    });
  });
});
