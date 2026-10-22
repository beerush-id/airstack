import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Main } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Main', () => {
  it('renders a native main without a redundant role', async () => {
    destroy = await runApp(async () => {
      render(<Main>Primary content</Main>);
      const main = screen.getByRole('main');
      expect(main).toBeInstanceOf(HTMLElement);
      expect(main.tagName).toBe('MAIN');
      expect(main.getAttribute('role')).toBeNull();
      expect(main.textContent).toBe('Primary content');
    });
  });

  it('names the landmark only when labelled', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Main label="Content">Primary content</Main>);
      expect(screen.getByRole('main', { name: 'Content' }).getAttribute('aria-label')).toBe('Content');
      unmount();
      render(<Main>Primary content</Main>);
      expect(screen.getByRole('main').getAttribute('aria-label')).toBeNull();
      expect(screen.getByRole('main').getAttribute('aria-labelledby')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="content-title">Docs</span>
          <Main labelledby="content-title">Primary content</Main>
        </>
      );
      expect(screen.getByRole('main').getAttribute('aria-labelledby')).toBe('content-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Main ref={ref} id="skip-target">
          Primary content
        </Main>
      );
      const main = screen.getByRole('main');
      expect(ref.current).toBe(main);
      expect(main.getAttribute('id')).toBe('skip-target');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Main className="my-main">Primary content</Main>);
      expect(screen.getByRole('main').className).toContain('my-main');
      expect(screen.getByRole('main').className).toContain('aui-main');
      unmount();
      configure({ overrides: true });
      render(<Main className="only-me">Primary content</Main>);
      expect(screen.getByRole('main').className).toBe('only-me');
    });
  });
});
