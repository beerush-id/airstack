import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type CodeInputProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCode(props: Partial<CodeInputProps>, cells: number, host: 'native' | 'custom' = 'native') {
  const code = aria('code-input', { label: 'Verification code', ...props } as CodeInputProps);
  const containerEl = bind(document.createElement('div'), code);
  document.body.appendChild(containerEl);

  const items = Array.from({ length: cells }, (_unused, index) => {
    const cell =
      host === 'native'
        ? aria('code-input-cell', { index })
        : aria<HTMLInputElement>('code-input-cell', { index }, { native: false });

    const el = bind(document.createElement(host === 'native' ? 'input' : 'div'), cell) as HTMLInputElement;
    containerEl.appendChild(el);
    return { index, cell, el };
  });

  const cleanup = () => {
    for (const { cell } of items) {
      cell.destroy();
    }

    code.destroy();
    containerEl.remove();
  };

  return { code, containerEl, items, cleanup };
}

function type(el: HTMLInputElement, character: string) {
  el.value = character;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: character }));
}

function travel(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('CodeInput - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Segmented Input Distribution & Focus Hop Invariant', () => {
    it('fills the targeted cell, hops to the next, and keeps one concatenated value', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '', length: 4 });
          const { code, items, cleanup } = buildCode(props, 4);

          items[0].el.focus();
          type(items[0].el, '1');

          expect(props.value).toBe('1');
          expect(items[0].el.value).toBe('1');
          expect(document.activeElement).toBe(items[1].el);

          type(items[1].el, '2');
          expect(props.value).toBe('12');
          expect(items[1].el.value).toBe('2');
          expect(document.activeElement).toBe(items[2].el);

          // Writing later digits leaves earlier cells untouched
          type(items[2].el, '3');
          expect(items[0].el.value).toBe('1');
          expect(props.value).toBe('123');

          expect(code.value).toBe('123');

          cleanup();
        });
      }));

    it('filters characters by kind and truncates the value to the declared length', () =>
      scope.run(() => {
        component().run(() => {
          const numeric = buildCode({ value: '12ab3456', length: 4, kind: 'numeric' }, 4);
          expect(numeric.code.value).toBe('12');
          expect(numeric.items[0].el.value).toBe('1');
          expect(numeric.items[1].el.value).toBe('2');
          expect(numeric.items[2].el.value).toBe('');

          type(numeric.items[2].el, 'x');
          expect(numeric.code.properties.value).toBe('12');
          expect(numeric.items[2].el.value).toBe('');

          numeric.cleanup();

          const alpha = buildCode({ value: 'a1b2c3', length: 4, kind: 'alphanumeric' }, 4);
          expect(alpha.code.value).toBe('a1b2');
          expect(alpha.items[3].el.value).toBe('2');

          type(alpha.items[0].el, '!');
          expect(alpha.code.properties.value).toBe('a1b2');

          alpha.cleanup();
        });
      }));
  });

  describe('Single Tab-Stop & Boundary Invariant', () => {
    it('keeps only the active cell reachable and moves the stop with the navigation keys', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '12', length: 4 });
          const { containerEl, items, cleanup } = buildCode(props, 4);

          // One stop only: the cell holding the caret position, not every input
          const stops = items.map(({ el }) => el.getAttribute('tabindex'));
          expect(stops.filter((value) => value === '0')).toHaveLength(1);
          expect(stops.filter((value) => value === '-1')).toHaveLength(3);

          items[0].el.focus();

          travel(items[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(items[1].el);

          travel(items[1].el, 'ArrowLeft');
          expect(document.activeElement).toBe(items[0].el);

          // Home returns to the first cell, End to the first unfilled one
          travel(items[0].el, 'End');
          expect(document.activeElement).toBe(items[2].el);

          travel(items[2].el, 'Home');
          expect(document.activeElement).toBe(items[0].el);

          // Retreating from the first cell has nowhere to go
          travel(items[0].el, 'ArrowLeft');
          expect(document.activeElement).toBe(items[0].el);

          // Advancing past the last cell cannot leave the group
          items[3].el.focus();
          travel(items[3].el, 'ArrowRight');
          expect(document.activeElement).toBe(items[3].el);
          expect(containerEl.contains(document.activeElement as Node)).toBe(true);

          cleanup();
        });
      }));

    it('shifts the code back on Backspace and clears in place on Delete', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '1234', length: 4 });
          const { items, cleanup } = buildCode(props, 4);

          // Delete clears the focused cell and leaves focus and the neighbours alone
          items[1].el.focus();
          travel(items[1].el, 'Delete');
          expect(props.value).toBe('134');
          expect(document.activeElement).toBe(items[1].el);

          // Backspace clears the current cell when filled, then shifts the left neighbour in
          items[2].el.focus();
          travel(items[2].el, 'Backspace');
          expect(props.value).toBe('13');
          expect(items[2].el.value).toBe('');

          travel(items[2].el, 'Backspace');
          expect(props.value).toBe('1');
          expect(items[0].el.value).toBe('1');

          cleanup();
        });
      }));

    it('removes every cell from the tab order when the group is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '', length: 3, disabled: true });
          const { containerEl, items, cleanup } = buildCode(props, 3);

          expect(containerEl.getAttribute('aria-disabled')).toBe('true');

          for (const { el } of items) {
            expect((el as HTMLInputElement).disabled).toBe(true);
          }

          items[0].el.focus();
          expect(travel(items[0].el, 'ArrowRight').defaultPrevented).toBe(false);
          expect(props.value).toBe('');

          // A read-only group stays reachable but refuses edits
          props.disabled = false;
          props.readonly = true;
          items[0].el.focus();
          type(items[0].el, '7');
          expect(props.value).toBe('');

          cleanup();
        });
      }));
  });

  describe('Coordinated Value Synchronization Invariant', () => {
    it('gives the first cell the one-time-code hint and leaves the rest without it', () =>
      scope.run(() => {
        component().run(() => {
          const { containerEl, items, cleanup } = buildCode({ value: '', length: 6 }, 6);

          expect(containerEl.getAttribute('role')).toBe('group');
          expect(containerEl.getAttribute('aria-label')).toBe('Verification code');

          expect(items[0].el.getAttribute('autocomplete')).toBe('one-time-code');
          for (const { el } of items.slice(1)) {
            expect(el.getAttribute('autocomplete')).not.toBe('one-time-code');
          }

          cleanup();
        });
      }));

    it('announces edits, completion and the committed value on blur', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '', length: 3 });
          const { containerEl, items, cleanup } = buildCode(props, 3);

          const edits: unknown[] = [];
          const commits: unknown[] = [];
          const completions: unknown[] = [];

          containerEl.addEventListener('input', (event) => edits.push((event as CustomEvent).detail));
          containerEl.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));
          containerEl.addEventListener('complete', (event) => completions.push((event as CustomEvent).detail));

          items[0].el.focus();
          type(items[0].el, '5');
          expect(edits).toEqual(['5']);
          expect(commits).toEqual([]);
          expect(completions).toEqual([]);

          type(items[1].el, '6');
          type(items[2].el, '7');

          expect(props.value).toBe('567');
          expect(completions).toEqual(['567']);

          items[2].el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual(['567']);

          // A blur with nothing changed produces no second commit
          items[2].el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          expect(commits).toEqual(['567']);

          cleanup();
        });
      }));

    it('gives a custom host the textbox role and the character it derives from the code', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '98', length: 3 });
          const { items, cleanup } = buildCode(props, 3, 'custom');

          expect(items[0].el.getAttribute('role')).toBe('textbox');
          expect(items[2].el.getAttribute('role')).toBe('textbox');
          expect(items[0].el.textContent).toBe('9');
          expect(items[1].el.textContent).toBe('8');
          expect(items[2].el.textContent).toBe('');

          // The cell follows the group value; it holds no character of its own
          props.value = '7';
          expect(items[0].el.textContent).toBe('7');
          expect(items[1].el.textContent).toBe('');

          cleanup();
        });
      }));
  });
});
