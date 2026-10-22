import type { StateUnsubscribe } from '@airlib/react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Field, FieldControl, FieldDescription, FieldError, FieldLabel, NumberStepper, SearchInput, TextInput } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('Field batch', () => {
  it('field wires label and control by namespace', async () => {
    destroy = await runApp(async () => {
      render(
        <Field placeholder="you@example.com">
          <FieldLabel>Email address</FieldLabel>
          <FieldControl />
          <FieldDescription>We send a sign-in link.</FieldDescription>
        </Field>
      );
      const input = screen.getByPlaceholderText('you@example.com');
      expect(input.className).toContain('aui-field-control');
      const label = screen.getByText('Email address');
      expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
      expect(screen.getByText('We send a sign-in link.').className).toContain('aui-field-description');
    });
  });

  it('field error carries the failure channel', async () => {
    destroy = await runApp(async () => {
      render(
        <Field invalid touched>
          <FieldLabel>Work email</FieldLabel>
          <FieldControl />
          <FieldError>Enter a valid email.</FieldError>
        </Field>
      );
      expect(screen.getByText('Enter a valid email.').className).toContain('aui-field-error');
    });
  });

  it('text input keeps the live value and commits', async () => {
    destroy = await runApp(async () => {
      let committed: string | undefined;
      render(<TextInput label="Display name" placeholder="Ada" onchange={(e) => (committed = e.detail)} />);
      const input = screen.getByPlaceholderText('Ada') as HTMLInputElement;
      expect(input.className).toContain('aui-text-input');
      await act(async () => {
        await userEvent.type(input, 'Ada');
      });
      expect(input.value).toContain('Ada');
      await act(async () => {
        input.blur();
      });
      expect(committed).toBeDefined();
    });
  });

  it('search input keeps native search type', async () => {
    destroy = await runApp(async () => {
      render(<SearchInput label="Search docs" placeholder="Search" />);
      const input = screen.getByPlaceholderText('Search');
      expect(input.getAttribute('type')).toBe('search');
      expect(input.className).toContain('aui-search-input');
      expect(screen.getByRole('searchbox', { name: 'Search docs' })).toBe(input);
    });
  });

  it('number stepper clamps and announces bounds', async () => {
    destroy = await runApp(async () => {
      render(<NumberStepper min={1} max={8} value={2} aria-label="Guests" />);
      const stepper = screen.getByRole('spinbutton', { name: 'Guests' });
      expect(stepper.className).toContain('aui-number-stepper');
      expect(stepper.getAttribute('min')).toBe('1');
      expect(stepper.getAttribute('max')).toBe('8');
    });
  });

  it('supports additive class mode', async () => {
    destroy = await runApp(async () => {
      render(<TextInput placeholder="Name" className="my-input" />);
      expect(screen.getByPlaceholderText('Name').className).toContain('aui-text-input');
      expect(screen.getByPlaceholderText('Name').className).toContain('my-input');
    });
  });
});
