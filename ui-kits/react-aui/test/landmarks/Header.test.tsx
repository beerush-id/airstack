import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Header } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Header', () => {
  it('renders a native header without a redundant role', async () => {
    destroy = await runApp(async () => {
      render(<Header>Site identity</Header>);
      const header = screen.getByRole('banner');
      expect(header).toBeInstanceOf(HTMLElement);
      expect(header.tagName).toBe('HEADER');
      expect(header.getAttribute('role')).toBeNull();
      expect(header.textContent).toBe('Site identity');
    });
  });

  it('names the landmark only when labelled', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Header label="Site">Site identity</Header>);
      expect(screen.getByRole('banner', { name: 'Site' }).getAttribute('aria-label')).toBe('Site');
      unmount();
      render(<Header>Site identity</Header>);
      expect(screen.getByRole('banner').getAttribute('aria-label')).toBeNull();
      expect(screen.getByRole('banner').getAttribute('aria-labelledby')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="site-title">AirLib</span>
          <Header labelledby="site-title">Site identity</Header>
        </>
      );
      expect(screen.getByRole('banner').getAttribute('aria-labelledby')).toBe('site-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Header ref={ref} id="skip-target">
          Site identity
        </Header>
      );
      const header = screen.getByRole('banner');
      expect(ref.current).toBe(header);
      expect(header.getAttribute('id')).toBe('skip-target');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Header className="my-header">Site identity</Header>);
      expect(screen.getByRole('banner').className).toContain('my-header');
      expect(screen.getByRole('banner').className).toContain('aui-header');
      unmount();
      configure({ overrides: true });
      render(<Header className="only-me">Site identity</Header>);
      expect(screen.getByRole('banner').className).toBe('only-me');
    });
  });

});
