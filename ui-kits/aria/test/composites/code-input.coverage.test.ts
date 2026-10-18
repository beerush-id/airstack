import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, CodeInputCellAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('CodeInput - Coverage & Edge Guards', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  it('handles standalone orphan cells gracefully without a parent CodeInput context', () =>
    scope.run(() => {
      component().run(() => {
        const orphan0 = new CodeInputCellAria();
        expect(orphan0.index).toBe(0);
        expect(orphan0.value).toBe('');
        expect(orphan0.disabled).toBe(false);
        expect(orphan0.attributes.tabindex).toBe(0);

        const orphan1 = aria('code-input-cell', { index: 1 });
        expect(orphan1.attributes.tabindex).toBe(-1);

        orphan0.ref(null);
        const inputEl = bind(document.createElement('input'), orphan0);
        inputEl.dispatchEvent(new FocusEvent('focus'));
        inputEl.dispatchEvent(new FocusEvent('blur'));
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: '1' }));
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        inputEl.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));

        orphan0.destroy();
        orphan1.destroy();
      });
    }));

  it('guards removeAt bounds, empty distribution, and internal focus transfers between cells', () =>
    scope.run(() => {
      component().run(() => {
        const unmounted = aria('code-input', { value: '', length: 2 });
        expect(unmounted.distribute(0, '1')).toBe(true);
        unmounted.destroy();

        const code = aria('code-input', { value: '12', length: 4 });
        const containerEl = bind(document.createElement('div'), code);
        document.body.appendChild(containerEl);

        const c0 = code.cell({ index: 0 });
        const c1 = code.cell({ index: 1 });
        const el0 = bind(document.createElement('input'), c0);
        const el1 = bind(document.createElement('input'), c1);
        containerEl.appendChild(el0);
        containerEl.appendChild(el1);

        expect(code.distribute(0, '---')).toBe(false);
        expect(code.distribute(0, '1')).toBe(true);
        code.removeAt(-1);
        code.removeAt(5);
        expect(code.value).toBe('12');

        el0.focus();
        code.distribute(0, '9');
        el0.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: el1 }));

        el1.value = '8';
        el1.dispatchEvent(new Event('input', { bubbles: true }));
        expect(code.value).toBe('98');

        const pasteFallback = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
        Object.defineProperty(pasteFallback, 'clipboardData', {
          value: {
            getData: (format: string) => (format === 'text' ? '45' : ''),
          },
        });
        el0.dispatchEvent(pasteFallback);
        expect(code.value).toBe('45');

        el0.dispatchEvent(pasteFallback);
        expect(code.value).toBe('45');

        const pasteEmpty = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
        el0.dispatchEvent(pasteEmpty);
        expect(code.value).toBe('45');

        c0.destroy();
        c1.destroy();
        code.destroy();
        containerEl.remove();
      });
    }));

  it('handles Delete on an unfilled cell, Backspace on cell 0 when empty, and custom cell input fallback', () =>
    scope.run(() => {
      component().run(() => {
        const code = aria('code-input', { value: '', length: 3 });
        const containerEl = bind(document.createElement('div'), code);
        document.body.appendChild(containerEl);

        const c0 = code.cell<HTMLDivElement>({ index: 0 }, { native: false });
        const c2 = code.cell<HTMLDivElement>({ index: 2 }, { native: false });
        const el0 = bind(document.createElement('div'), c0);
        const el2 = bind(document.createElement('div'), c2);
        containerEl.appendChild(el0);
        containerEl.appendChild(el2);

        el0.focus();
        el0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        el0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
        el0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(code.value).toBe('');

        el2.focus();
        el2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        expect(code.value).toBe('');

        el0.textContent = '7';
        el0.dispatchEvent(new Event('input', { bubbles: true }));
        expect(code.value).toBe('7');

        code.assign({ readonly: true });
        el0.textContent = '9';
        el0.dispatchEvent(new Event('input', { bubbles: true }));
        expect(el0.textContent).toBe('7');

        c0.destroy();
        c2.destroy();
        code.destroy();
        containerEl.remove();
      });
    }));
});
