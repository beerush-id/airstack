import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { FilePicker } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('FilePicker', () => {
  it('renders a button trigger that cannot submit a form', async () => {
    destroy = await runApp(async () => {
      render(<FilePicker>Choose images</FilePicker>);
      const trigger = screen.getByRole('button', { name: 'Choose images' });
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('type')).toBe('button');
    });
  });

  it('keeps file filters off the trigger element', async () => {
    destroy = await runApp(async () => {
      render(
        <FilePicker accept="image/*" multiple>
          Choose
        </FilePicker>
      );
      const trigger = screen.getByRole('button', { name: 'Choose' });
      expect(trigger.getAttribute('accept')).toBeNull();
      expect(trigger.getAttribute('multiple')).toBeNull();
      expect(trigger.getAttribute('capture')).toBeNull();
    });
  });

  it('locks the trigger while disabled', async () => {
    destroy = await runApp(async () => {
      render(<FilePicker disabled>Uploading…</FilePicker>);
      const trigger = screen.getByRole('button', { name: 'Uploading…' });
      expect(trigger.hasAttribute('disabled')).toBe(true);
    });
  });

  it('forwards consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<FilePicker ref={ref}>Choose</FilePicker>);
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Choose' }));
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<FilePicker className="my-picker">Choose</FilePicker>);
      expect(screen.getByRole('button', { name: 'Choose' }).className).toContain('my-picker');
      expect(screen.getByRole('button', { name: 'Choose' }).className).toContain('aui-file-picker');
      unmount();
      configure({ overrides: true });
      render(<FilePicker className="only-me">Choose</FilePicker>);
      expect(screen.getByRole('button', { name: 'Choose' }).className).toBe('only-me');
    });
  });
});
