import type { StateUnsubscribe } from '@airlib/react';
import { mutable, setup } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Announcer } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Announcer', () => {
  it('compiles a polite status region that is read as one unit', async () => {
    destroy = await runApp(async () => {
      render(<Announcer>Draft saved</Announcer>);
      const region = screen.getByRole('status');
      expect(region.textContent).toBe('Draft saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.getAttribute('aria-atomic')).toBe('true');
      expect(region.className).toContain('aui-announcer');
      expect(region.hasAttribute('tabindex')).toBe(false);
    });
  });

  it('interrupts as an alert when the message is urgent', async () => {
    destroy = await runApp(async () => {
      render(<Announcer politeness="assertive">Upload failed</Announcer>);
      const region = screen.getByRole('alert');
      expect(region.getAttribute('aria-live')).toBe('assertive');
    });
  });

  it('stays silent while politeness is off, and keeps the region identified', async () => {
    destroy = await runApp(async () => {
      const { container } = render(
        <Announcer politeness="off" aria-label="Render count">
          42
        </Announcer>
      );
      const region = container.querySelector('.aui-announcer') as HTMLElement;
      expect(region.getAttribute('aria-live')).toBe('off');
      expect(region.getAttribute('aria-label')).toBe('Render count');
    });
  });

  it('marks busy only when asked and forwards relevant changes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Announcer>Idle</Announcer>);
      expect(screen.getByRole('status').hasAttribute('aria-busy')).toBe(false);
      unmount();
      render(
        <Announcer busy relevant="additions">
          One entry
        </Announcer>
      );
      const region = screen.getByRole('status');
      expect(region.getAttribute('aria-busy')).toBe('true');
      expect(region.getAttribute('aria-relevant')).toBe('additions');
    });
  });

  it('announces the new text when the message changes', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ message: 'Draft saved' });
      const Live = setup(() => () => <Announcer>{state.message}</Announcer>);
      render(<Live />);
      expect(screen.getByRole('status').textContent).toBe('Draft saved');
      await act(async () => {
        state.message = 'Draft published';
      });
      expect(screen.getByRole('status').textContent).toBe('Draft published');
    });
  });

  it('forwards a consumer ref and supports additive and replacement classes', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLDivElement>();
      const first = render(
        <Announcer ref={ref} className="my-live">
          Saved
        </Announcer>
      );
      expect(ref.current?.className).toContain('aui-announcer');
      expect(ref.current?.className).toContain('my-live');
      first.unmount();
      configure({ overrides: true });
      render(<Announcer className="only-me">Saved</Announcer>);
      expect((document.querySelector('.only-me') as HTMLElement).className).toBe('only-me');
    });
  });
});
