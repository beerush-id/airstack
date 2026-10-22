import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Divider } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Divider', () => {
  it('renders a horizontal separator with no announced axis', async () => {
    destroy = await runApp(async () => {
      render(<Divider />);
      const separator = screen.getByRole('separator');
      expect(separator).toBeInstanceOf(HTMLDivElement);
      expect(separator.getAttribute('aria-orientation')).toBeNull();
      expect(separator.getAttribute('tabindex')).toBeNull();
      expect(separator.textContent).toBe('');
    });
  });

  it('announces the axis only when vertical', async () => {
    destroy = await runApp(async () => {
      render(<Divider orientation="vertical" />);
      expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
    });
  });

  it('forwards events, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      let clicks = 0;
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Divider ref={ref} onClick={() => (clicks += 1)}>
          {/* A separator hosts content itself: a rule with nothing inside. */}
          {undefined}
        </Divider>
      );
      const separator = screen.getByRole('separator');
      expect(ref.current).toBe(separator);
      await act(async () => {
        await userEvent.click(separator);
      });
      expect(clicks).toEqual(1);
    });
  });

  it('stays neutral in classes until a color is requested', async () => {
    destroy = await runApp(async () => {
      render(<Divider>Neutral</Divider>);
      expect(screen.getByRole('separator').className).toBe('aui-divider');
    });
  });

  it('uses configured fallbacks and explicit props win', async () => {
    destroy = await runApp(async () => {
      configure({ divider: { color: 'error' } });
      const { unmount } = render(<Divider>Fallback</Divider>);
      expect(screen.getByRole('separator').className).toBe('aui-divider aui-divider-error');
      unmount();
      render(<Divider color="info">Explicit</Divider>);
      expect(screen.getByRole('separator').className).toBe('aui-divider aui-divider-info');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Divider className="my-rule">Additive</Divider>);
      expect(screen.getByRole('separator').className).toContain('my-rule');
      expect(screen.getByRole('separator').className).toContain('aui-divider');
      unmount();
      configure({ overrides: true });
      render(<Divider className="only-me">Replacement</Divider>);
      expect(screen.getByRole('separator').className).toBe('only-me');
    });
  });
});
