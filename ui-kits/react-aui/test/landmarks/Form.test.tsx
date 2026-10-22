import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { Form } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Form', () => {
  it('renders a native form without a landmark role when unnamed', async () => {
    destroy = await runApp(async () => {
      render(<Form>Checkout fields</Form>);
      const form = screen.getByText('Checkout fields').closest('form')!;
      expect(form.tagName).toBe('FORM');
      expect(form.getAttribute('role')).toBeNull();
    });
  });

  it('names the landmark only when labelled', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Form label="Shipping address">fields</Form>);
      const named = screen.getByRole('form', { name: 'Shipping address' });
      expect(named.getAttribute('aria-label')).toBe('Shipping address');
      unmount();
      render(<Form>fields</Form>);
      const plain = document.querySelector('form')!;
      expect(plain.getAttribute('role')).toBeNull();
      expect(plain.getAttribute('aria-label')).toBeNull();
    });
  });

  it('resolves the name from labelledby', async () => {
    destroy = await runApp(async () => {
      render(
        <>
          <span id="pay-title">Payment</span>
          <Form labelledby="pay-title">fields</Form>
        </>
      );
      expect(screen.getByRole('form', { name: 'Payment' }).getAttribute('aria-labelledby')).toBe('pay-title');
    });
  });

  it('forwards id, children, and consumer ref', async () => {
    destroy = await runApp(async () => {
      const ref = React.createRef<HTMLFormElement>();
      render(
        <Form ref={ref} id="checkout">
          fields
        </Form>
      );
      const form = screen.getByText('fields').closest('form')!;
      expect(ref.current).toBe(form);
      expect(form.getAttribute('id')).toBe('checkout');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(<Form label="A" className="my-form">fields</Form>);
      expect(screen.getByRole('form', { name: 'A' }).className).toContain('my-form');
      expect(screen.getByRole('form', { name: 'A' }).className).toContain('aui-form');
      unmount();
      configure({ overrides: true });
      render(<Form label="A" className="only-me">fields</Form>);
      expect(screen.getByRole('form', { name: 'A' }).className).toBe('only-me');
    });
  });
});
