import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Footer } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Footer', () => {
  it('renders a native footer without a redundant role', async () => {
    destroy = await runApp(async () => {
      render(<Footer>Site footer</Footer>);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInstanceOf(HTMLElement);
      expect(footer.tagName).toBe('FOOTER');
      expect(footer.getAttribute('role')).toBeNull();
      expect(footer.textContent).toBe('Site footer');
    });
  });

  it('names the landmark only when labelled', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Footer label="Site">Site footer</Footer>);
      expect(screen.getByRole('contentinfo', { name: 'Site' }).getAttribute('aria-label')).toBe('Site');
      unmount();
      render(<Footer>Site footer</Footer>);
      expect(screen.getByRole('contentinfo').getAttribute('aria-label')).toBeNull();
      expect(screen.getByRole('contentinfo').getAttribute('aria-labelledby')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="footer-title">AirLib</span>
          <Footer labelledby="footer-title">Site footer</Footer>
        </>
      );
      expect(screen.getByRole('contentinfo').getAttribute('aria-labelledby')).toBe('footer-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Footer ref={ref} id="site-footer">
          Site footer
        </Footer>
      );
      const footer = screen.getByRole('contentinfo');
      expect(ref.current).toBe(footer);
      expect(footer.getAttribute('id')).toBe('site-footer');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Footer className="my-footer">Site footer</Footer>);
      expect(screen.getByRole('contentinfo').className).toContain('my-footer');
      expect(screen.getByRole('contentinfo').className).toContain('aui-footer');
      unmount();
      configure({ overrides: true });
      render(<Footer className="only-me">Site footer</Footer>);
      expect(screen.getByRole('contentinfo').className).toBe('only-me');
    });
  });
});
