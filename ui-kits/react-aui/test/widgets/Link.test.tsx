import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Link } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Link', () => {
  it('renders the destination with target and no current mark', async () => {
    destroy = await runApp(async () => {
      render(
        <Link href="/docs/widgets/button" target="_blank">
          Component reference
        </Link>
      );
      const anchor = screen.getByRole('link', { name: 'Component reference' });
      expect(anchor).toBeInstanceOf(HTMLAnchorElement);
      expect(anchor.getAttribute('href')).toBe('/docs/widgets/button');
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.getAttribute('aria-current')).toBeNull();
      expect(anchor.textContent).toBe('Component reference');
    });
  });

  it('keeps the href while disabled and cancels activation', async () => {
    destroy = await runApp(async () => {
      let clicks = 0;
      render(
        <Link href="/account/billing" disabled onClick={() => (clicks += 1)}>
          Billing portal
        </Link>
      );
      const anchor = screen.getByRole('link', { name: 'Billing portal' });
      expect(anchor.getAttribute('aria-disabled')).toBe('true');
      expect(anchor.getAttribute('href')).toBe('/account/billing');
      expect(anchor.getAttribute('tabindex')).toBe('-1');

      let prevented = true;
      const listener = (event: MouseEvent) => {
        prevented = event.defaultPrevented;
      };
      document.addEventListener('click', listener);
      await act(async () => {
        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      document.removeEventListener('click', listener);
      expect(prevented).toBe(true);
      expect(clicks).toBe(0);
    });
  });

  it('leaves activation to the browser while enabled', async () => {
    destroy = await runApp(async () => {
      render(<Link href="/docs/widgets/switch">Settings</Link>);
      const anchor = screen.getByRole('link', { name: 'Settings' });
      expect(anchor.getAttribute('aria-disabled')).toBe('false');

      let prevented = true;
      const listener = (event: MouseEvent) => {
        prevented = event.defaultPrevented;
      };
      document.addEventListener('click', listener);
      await act(async () => {
        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      document.removeEventListener('click', listener);
      expect(anchor.getAttribute('tabindex')).toBeNull();
      expect(prevented).toBe(false);
    });
  });

  it('forces the current-page mark from the current prop', async () => {
    destroy = await runApp(async () => {
      render(
        <Link href="/docs/widgets/link" current>
          This guide
        </Link>
      );
      expect(screen.getByRole('link', { name: 'This guide' }).getAttribute('aria-current')).toBe('page');
    });
  });

  it('forwards events, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      let clicks = 0;
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <Link href="/docs/widgets/link" ref={ref} onClick={() => (clicks += 1)}>
          Click me
        </Link>
      );
      const anchor = screen.getByRole('link', { name: 'Click me' });
      expect(ref.current).toBe(anchor);
      await act(async () => {
        await userEvent.click(anchor);
      });
      expect(clicks).toBe(1);
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ link: { color: 'error' } });
      const { unmount } = render(<Link href="/a">Fallback</Link>);
      expect(screen.getByRole('link', { name: 'Fallback' }).className).toBe('aui-link aui-link-error');
      unmount();
      render(
        <Link href="/b" color="info">
          Explicit
        </Link>
      );
      expect(screen.getByRole('link', { name: 'Explicit' }).className).toBe('aui-link aui-link-info');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Link href="/a" className="my-link">
          Additive
        </Link>
      );
      expect(screen.getByRole('link', { name: 'Additive' }).className).toContain('my-link');
      expect(screen.getByRole('link', { name: 'Additive' }).className).toContain('aui-link');
      unmount();
      configure({ overrides: true });
      render(
        <Link href="/b" className="only-me">
          Replacement
        </Link>
      );
      expect(screen.getByRole('link', { name: 'Replacement' }).className).toBe('only-me');
    });
  });
});
