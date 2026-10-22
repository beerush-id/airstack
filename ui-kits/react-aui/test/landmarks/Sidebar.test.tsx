import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Sidebar } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Sidebar', () => {
  it('renders a native aside without a redundant role', async () => {
    destroy = await runApp(async () => {
      render(<Sidebar>Related links</Sidebar>);
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInstanceOf(HTMLElement);
      expect(sidebar.tagName).toBe('ASIDE');
      expect(sidebar.getAttribute('role')).toBeNull();
      expect(sidebar.textContent).toBe('Related links');
    });
  });

  it('names the landmark only when labelled', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Sidebar label="On this page">Related links</Sidebar>);
      expect(screen.getByRole('complementary', { name: 'On this page' }).getAttribute('aria-label')).toBe(
        'On this page'
      );
      unmount();
      render(<Sidebar>Related links</Sidebar>);
      expect(screen.getByRole('complementary').getAttribute('aria-label')).toBeNull();
      expect(screen.getByRole('complementary').getAttribute('aria-labelledby')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="toc-title">On this page</span>
          <Sidebar labelledby="toc-title">Related links</Sidebar>
        </>
      );
      expect(screen.getByRole('complementary').getAttribute('aria-labelledby')).toBe('toc-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Sidebar ref={ref} id="toc">
          Related links
        </Sidebar>
      );
      const sidebar = screen.getByRole('complementary');
      expect(ref.current).toBe(sidebar);
      expect(sidebar.getAttribute('id')).toBe('toc');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Sidebar className="my-sidebar">Related links</Sidebar>);
      expect(screen.getByRole('complementary').className).toContain('my-sidebar');
      expect(screen.getByRole('complementary').className).toContain('aui-sidebar');
      unmount();
      configure({ overrides: true });
      render(<Sidebar className="only-me">Related links</Sidebar>);
      expect(screen.getByRole('complementary').className).toBe('only-me');
    });
  });
});
