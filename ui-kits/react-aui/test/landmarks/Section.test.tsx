import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Section } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Section', () => {
  it('renders a native section with no landmark role while unnamed', async () => {
    destroy = await runApp(async () => {
      render(<Section>Release notes</Section>);
      expect(screen.queryByRole('region')).toBeNull();
      expect(screen.getByText('Release notes').tagName).toBe('SECTION');
    });
  });

  it('publishes the region role only while named', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Section label="Billing">Invoices</Section>);
      expect(screen.getByRole('region', { name: 'Billing' }).getAttribute('aria-label')).toBe('Billing');
      unmount();
      render(<Section>Release notes</Section>);
      expect(screen.queryByRole('region')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <Section labelledby="billing-title">
          <span id="billing-title">Billing</span>
          <span>Invoices move ledgers on 1 November.</span>
        </Section>
      );
      expect(screen.getByRole('region').getAttribute('aria-labelledby')).toBe('billing-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Section ref={ref} id="billing" label="Billing">
          Invoices
        </Section>
      );
      const section = screen.getByRole('region');
      expect(ref.current).toBe(section);
      expect(section.getAttribute('id')).toBe('billing');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <Section className="my-section" label="Billing">
          Invoices
        </Section>
      );
      expect(screen.getByRole('region').className).toContain('my-section');
      expect(screen.getByRole('region').className).toContain('aui-section');
      unmount();
      configure({ overrides: true });
      render(
        <Section className="only-me" label="Billing">
          Invoices
        </Section>
      );
      expect(screen.getByRole('region').className).toBe('only-me');
    });
  });
});
