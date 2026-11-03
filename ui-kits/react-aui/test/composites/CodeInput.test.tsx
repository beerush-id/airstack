import type { StateUnsubscribe } from '@airlib/react';
import { $bind, mutable } from '@airlib/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure } from '../../src/config.js';
import { CodeInput, CodeInputCell } from '../../src/index.js';
import { restoreConfig, runApp, snapshotConfig } from '../setup.js';

let destroy: StateUnsubscribe | undefined;

type CodeProps = {
  value?: string;
  length?: number;
  kind?: 'numeric' | 'alphanumeric';
  disabled?: boolean;
  readonly?: boolean;
  oninput?: (event: CustomEvent<string>) => void;
  onchange?: (event: CustomEvent<string>) => void;
  oncomplete?: (event: CustomEvent<string>) => void;
};

function Code(props: CodeProps) {
  const count = props.length ?? 6;

  return (
    <CodeInput label="Verification code" {...props} length={count}>
      {Array.from({ length: count }, (_, index) => (
        <CodeInputCell key={index} index={index} />
      ))}
    </CodeInput>
  );
}

const cell = (index: number, count = 6) =>
  screen.getByRole('textbox', { name: `Verification code, character ${index + 1} of ${count}` }) as HTMLInputElement;

beforeEach(snapshotConfig);

afterEach(() => {
  destroy?.();
  restoreConfig();
});

describe('CodeInput', () => {
  it('renders one named group with a single tab stop', async () => {
    destroy = await runApp(async () => {
      render(<Code value="42" />);
      expect(screen.getByRole('group', { name: 'Verification code' }).getAttribute('aria-disabled')).toBe('false');
      expect(cell(0).value).toBe('4');
      expect(cell(1).value).toBe('2');
      expect(cell(2).value).toBe('');
      expect(cell(0).getAttribute('inputmode')).toBe('numeric');
      expect(cell(0).getAttribute('autocomplete')).toBe('one-time-code');
      expect(cell(1).getAttribute('autocomplete')).toBeNull();
      expect(cell(0).tabIndex).toBe(-1);
      expect(cell(2).tabIndex).toBe(0);
      expect(cell(3).tabIndex).toBe(-1);
    });
  });

  it('advances focus as characters land and reports each edit', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '42' });
      const inputs: string[] = [];
      render(<Code value={$bind(state, 'code')} oninput={(event) => inputs.push(event.detail)} />);
      await act(async () => {
        await userEvent.click(cell(2));
      });
      await act(async () => {
        await userEvent.type(cell(2), '7');
      });
      expect(state.code).toBe('427');
      expect(cell(2).value).toBe('7');
      expect(document.activeElement).toBe(cell(3));
      expect(inputs).toContain('427');
    });
  });

  it('spreads a pasted code across the cells and completes once', async () => {
    destroy = await runApp(async () => {
      const completes: string[] = [];
      render(<Code oncomplete={(event) => completes.push(event.detail)} />);
      await act(async () => {
        fireEvent.paste(cell(0), { clipboardData: { getData: () => '123456' } });
      });
      expect(cell(0).value).toBe('1');
      expect(cell(5).value).toBe('6');
      expect(document.activeElement).toBe(cell(5));
      expect(completes).toEqual(['123456']);
    });
  });

  it('shifts the remaining characters left on backspace', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '1234' });
      render(<Code value={$bind(state, 'code')} />);
      await act(async () => {
        await userEvent.click(cell(2));
      });
      await act(async () => {
        await userEvent.type(cell(2), '{backspace}');
      });
      expect(state.code).toBe('124');
      expect(cell(0).value).toBe('1');
      expect(cell(1).value).toBe('2');
      expect(cell(2).value).toBe('4');
      expect(cell(3).value).toBe('');
    });
  });

  it('drops characters outside the active kind and past the length', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: 'A9' });
      render(<Code length={4} kind="alphanumeric" value={$bind(state, 'code')} />);
      await act(async () => {
        await userEvent.click(cell(2, 4));
      });
      await act(async () => {
        await userEvent.type(cell(2, 4), '-');
      });
      expect(state.code).toBe('A9');
      await act(async () => {
        fireEvent.paste(cell(2, 4), { clipboardData: { getData: () => 'XYZ123' } });
      });
      expect(state.code).toBe('A9XY');
    });
  });

  it('accepts only digits in the numeric kind', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '42' });
      render(<Code value={$bind(state, 'code')} />);
      await act(async () => {
        await userEvent.click(cell(2));
      });
      await act(async () => {
        await userEvent.type(cell(2), 'a');
      });
      expect(state.code).toBe('42');
      await act(async () => {
        fireEvent.paste(cell(2), { clipboardData: { getData: () => '7890123' } });
      });
      expect(state.code).toBe('427890');
    });
  });

  it('reports the code on blur once it differs from focus entry', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '42' });
      const changes: string[] = [];
      render(<Code value={$bind(state, 'code')} onchange={(event) => changes.push(event.detail)} />);
      await act(async () => {
        await userEvent.click(cell(2));
      });
      await act(async () => {
        await userEvent.type(cell(2), '7');
      });
      await act(async () => {
        fireEvent.blur(cell(3), { relatedTarget: null });
      });
      expect(changes).toEqual(['427']);
      await act(async () => {
        fireEvent.focus(cell(3));
        fireEvent.blur(cell(3), { relatedTarget: null });
      });
      expect(changes).toEqual(['427']);
    });
  });

  it('shows a code written from outside', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '12' });
      render(<Code value={$bind(state, 'code')} />);
      await act(async () => {
        state.code = '987654';
      });
      expect(cell(0).value).toBe('9');
      expect(cell(1).value).toBe('8');
      expect(cell(5).value).toBe('4');
    });
  });

  it('locks every cell while disabled', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '42' });
      render(<Code value={$bind(state, 'code')} disabled />);
      expect(screen.getByRole('group').getAttribute('aria-disabled')).toBe('true');
      expect(cell(0).disabled).toBe(true);
      expect(cell(0).tabIndex).toBe(-1);
      expect(cell(2).tabIndex).toBe(-1);
      await act(async () => {
        fireEvent.keyDown(cell(2), { key: 'Backspace' });
      });
      expect(state.code).toBe('42');
    });
  });

  it('keeps the tab stop and refuses edits while read-only', async () => {
    destroy = await runApp(async () => {
      const state = mutable({ code: '42' });
      render(<Code value={$bind(state, 'code')} readonly />);
      expect(cell(0).readOnly).toBe(true);
      expect(cell(2).tabIndex).toBe(0);
      await act(async () => {
        fireEvent.keyDown(cell(2), { key: 'Backspace' });
        fireEvent.input(cell(2), { data: '7' });
      });
      expect(state.code).toBe('42');
    });
  });

  it('supports additive and replacement class modes', async () => {
    destroy = await runApp(async () => {
      const { unmount } = render(
        <CodeInput label="Verification code" length={2} value="1" className="my-code">
          <CodeInputCell index={0} className="my-cell" />
          <CodeInputCell index={1} />
        </CodeInput>
      );
      expect(screen.getByRole('group').className).toContain('my-code');
      expect(screen.getByRole('group').className).toContain('aui-code-input');
      expect(cell(0, 2).className).toContain('my-cell');
      expect(cell(0, 2).className).toContain('aui-code-input-cell');
      unmount();
      configure({ overrides: true });
      render(
        <CodeInput label="Verification code" length={2} value="1" className="only-me">
          <CodeInputCell index={0} className="only-cell" />
          <CodeInputCell index={1} />
        </CodeInput>
      );
      expect(screen.getByRole('group').className).toBe('only-me');
      expect(cell(0, 2).className).toBe('only-cell');
    });
  });
});
