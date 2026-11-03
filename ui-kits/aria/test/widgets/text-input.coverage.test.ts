import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type TextInputEvent } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('TextInput - Coverage (guards & teardown completeness)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Edit Guard Contract', () => {
    it('ignores typing while readonly', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria('text-input', { value: 'hi', readonly: true });
          const el = bind(document.createElement('input'), input);

          el.value = 'blocked';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          expect(input.value).toBe('hi');

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('withholds blur commits with no diff on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLDivElement>('text-input', { value: 'same' }, { native: false });
          const el = bind(document.createElement('div'), input);

          const commits: unknown[] = [];
          el.addEventListener('change', (event) => commits.push((event as TextInputEvent).detail));

          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual([]);

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('attaches no commit path on a native host', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria('text-input', { value: 'hi' });
          const el = bind(document.createElement('input'), input);

          let customs = 0;
          el.addEventListener('change', (event) => {
            if (event instanceof CustomEvent) customs += 1;
          });

          input.assign({ value: 'typed' });
          el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(customs).toBe(0);

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));
  });

  describe('Attribute Shielding Contract', () => {
    it('shields compiled keys from consumer refine overrides', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLDivElement>(
            'text-input',
            { value: 'hi', kind: 'search', multiline: true },
            { native: false }
          );
          const el = bind(document.createElement('div'), input);

          input.refine(() => ({
            role: 'button',
            tabindex: 5,
            'aria-multiline': 'false',
            'data-scope': 'demo',
          }));

          expect(el.getAttribute('role')).toBe('searchbox');
          expect(el.getAttribute('tabindex')).toBe('0');
          expect(el.getAttribute('aria-multiline')).toBe('true');
          expect(el.getAttribute('data-scope')).toBe('demo');

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLDivElement>(
            'text-input',
            { value: 'hi', kind: 'search', multiline: true, label: 'Query' },
            { native: false }
          );

          for (const key of [
            'value',
            'kind',
            'multiline',
            'disabled',
            'readonly',
            'label',
            'aria-invalid',
            'tabindex',
          ]) {
            expect(input.ownKeys).toContain(key);
          }

          input.destroy();
          expect(input.current).toBeNull();
        });
      }));
  });

  describe('Teardown Completeness', () => {
    it('drops the blur listener across a detach-and-reattach cycle', () =>
      scope.run(() => {
        component().run(() => {
          const input = aria<HTMLDivElement>('text-input', { value: 'a' }, { native: false });
          const first = bind(document.createElement('div'), input);

          input.ref(null);
          expect(input.current).toBeNull();

          input.assign({ value: 'b' });
          first.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

          const second = document.createElement('div');
          const commits: unknown[] = [];
          second.addEventListener('change', (event) => commits.push((event as TextInputEvent).detail));
          input.ref(second);
          document.body.appendChild(second);

          second.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual(['b']);

          input.destroy();
          first.remove();
          second.remove();
          expect(input.current).toBeNull();
        });
      }));

    it('constructs without frozen reactive reads outside a reactive boundary', () =>
      scope.run(() => {
        const reads: string[] = [];
        const restore = setStaticTracker((_init, key) => {
          if (typeof key === 'symbol') return;
          reads.push(String(key));
        });
        try {
          const input = aria<HTMLDivElement>('text-input', { value: 'hi', kind: 'search' }, { native: false });
          input.destroy();
        } finally {
          restore();
        }
        expect(reads).toEqual([]);
      }));
  });
});
