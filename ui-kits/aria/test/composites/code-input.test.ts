import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type CodeInputProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildCode(props: Partial<CodeInputProps>, cells: number, host: 'native' | 'custom' = 'native') {
  const code = aria('code-input', props as CodeInputProps);
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

function type(el: HTMLElement, character: string) {
  if (el instanceof HTMLInputElement) {
    el.value = character;
  } else {
    el.textContent = character;
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: character }));
}

function paste(el: HTMLElement, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (format: string) => (format === 'text' || format === 'text/plain' ? text : ''),
    },
  });
  el.dispatchEvent(event);
  return event;
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

  describe('SSR & Attribute Compilation Invariant', () => {
    it('compiles group and cell attributes deterministically and respects user-land labels', () =>
      scope.run(() => {
        component().run(() => {
          const unlabeled = aria('code-input');
          expect(unlabeled.attributes.role).toBe('group');
          expect(unlabeled.attributes['aria-label']).toBeUndefined();
          expect(unlabeled.attributes['aria-disabled']).toBe('false');
          expect(unlabeled.value).toBe('');

          const unlabeledCell = unlabeled.cell({ index: 0 });
          expect(unlabeledCell.attributes.type).toBe('text');
          expect(unlabeledCell.attributes.role).toBeUndefined();
          expect(unlabeledCell.attributes['aria-label']).toBeUndefined();
          expect(unlabeledCell.attributes.inputmode).toBe('numeric');
          expect(unlabeledCell.attributes.autocomplete).toBe('one-time-code');
          expect(unlabeledCell.attributes.tabindex).toBe(0);
          expect(unlabeledCell.value).toBe('');

          const secondUnlabeledCell = unlabeled.cell({ index: 1 });
          expect(secondUnlabeledCell.attributes.autocomplete).toBeUndefined();
          expect(secondUnlabeledCell.attributes.tabindex).toBe(-1);

          unlabeledCell.destroy();
          secondUnlabeledCell.destroy();
          unlabeled.destroy();

          const labeled = aria('code-input', {
            label: 'Security PIN',
            length: 4,
            kind: 'alphanumeric',
            value: 'A1',
          });
          expect(labeled.attributes['aria-label']).toBe('Security PIN');

          const c0 = labeled.cell({ index: 0 });
          const c1 = labeled.cell({ index: 1 });
          const c2 = labeled.cell({ index: 2 });
          expect(c0.attributes['aria-label']).toBe('Security PIN, character 1 of 4');
          expect(c0.attributes.inputmode).toBe('text');
          expect(c0.attributes.tabindex).toBe(-1);
          expect(c0.value).toBe('A');

          expect(c1.attributes['aria-label']).toBe('Security PIN, character 2 of 4');
          expect(c1.attributes.tabindex).toBe(-1);
          expect(c1.value).toBe('1');

          expect(c2.attributes['aria-label']).toBe('Security PIN, character 3 of 4');
          expect(c2.attributes.tabindex).toBe(0);
          expect(c2.value).toBe('');

          c0.destroy();
          c1.destroy();
          c2.destroy();
          labeled.destroy();
        });
      }));
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
          expect(items[0].cell.value).toBe('1');
          expect(document.activeElement).toBe(items[1].el);

          type(items[1].el, '2');
          expect(props.value).toBe('12');
          expect(items[1].el.value).toBe('2');
          expect(document.activeElement).toBe(items[2].el);

          type(items[2].el, '3');
          expect(items[0].el.value).toBe('1');
          expect(props.value).toBe('123');

          expect(code.value).toBe('123');

          code.value = '9876';
          expect(props.value).toBe('9876');
          expect(items[3].el.value).toBe('6');

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

    it('distributes pasted and autofilled strings from the target cell, stripping invalid chars and discarding overflow', () =>
      scope.run(() => {
        component().run(() => {
          const oninput = vi.fn();
          const oncomplete = vi.fn();
          const props = mutable<CodeInputProps>({ value: '', length: 4, kind: 'numeric', oninput, oncomplete });
          const { items, cleanup } = buildCode(props, 4);

          items[0].el.focus();
          const pasteEvt = paste(items[0].el, '1-2a3');
          expect(pasteEvt.defaultPrevented).toBe(true);
          expect(props.value).toBe('123');
          expect(items[0].el.value).toBe('1');
          expect(items[1].el.value).toBe('2');
          expect(items[2].el.value).toBe('3');
          expect(items[3].el.value).toBe('');
          expect(document.activeElement).toBe(items[3].el);
          expect(oninput).toHaveBeenCalledTimes(1);
          expect(oncomplete).not.toHaveBeenCalled();

          items[1].el.focus();
          paste(items[1].el, '987654');
          expect(props.value).toBe('1987');
          expect(items[0].el.value).toBe('1');
          expect(items[1].el.value).toBe('9');
          expect(items[2].el.value).toBe('8');
          expect(items[3].el.value).toBe('7');
          expect(document.activeElement).toBe(items[3].el);
          expect(oninput).toHaveBeenCalledTimes(2);
          expect(oncomplete).toHaveBeenCalledTimes(1);
          expect(oncomplete.mock.calls[0][0].detail).toBe('1987');

          items[0].el.focus();
          type(items[0].el, '456789');
          expect(props.value).toBe('4567');
          expect(document.activeElement).toBe(items[3].el);

          cleanup();
        });
      }));
  });

  describe('Single Tab-Stop & Boundary Invariant', () => {
    it('keeps only the active cell reachable and moves the stop with the navigation keys', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '12', length: 4 });
          const { containerEl, items, cleanup } = buildCode(props, 4);

          const stops = items.map(({ el }) => el.getAttribute('tabindex'));
          expect(stops.filter((value) => value === '0')).toHaveLength(1);
          expect(stops.filter((value) => value === '-1')).toHaveLength(3);
          expect(items[2].el.getAttribute('tabindex')).toBe('0');

          items[0].el.focus();
          expect(items[0].el.getAttribute('tabindex')).toBe('0');
          expect(items[2].el.getAttribute('tabindex')).toBe('-1');

          travel(items[0].el, 'ArrowRight');
          expect(document.activeElement).toBe(items[1].el);

          travel(items[1].el, 'ArrowRight');
          expect(document.activeElement).toBe(items[2].el);

          travel(items[2].el, 'ArrowRight');
          expect(document.activeElement).toBe(items[2].el);

          travel(items[2].el, 'ArrowLeft');
          expect(document.activeElement).toBe(items[1].el);

          travel(items[1].el, 'ArrowLeft');
          expect(document.activeElement).toBe(items[0].el);

          travel(items[0].el, 'End');
          expect(document.activeElement).toBe(items[2].el);

          travel(items[2].el, 'Home');
          expect(document.activeElement).toBe(items[0].el);

          travel(items[0].el, 'ArrowLeft');
          expect(document.activeElement).toBe(items[0].el);

          props.value = '1234';
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

          items[1].el.focus();
          travel(items[1].el, 'Delete');
          expect(props.value).toBe('134');
          expect(document.activeElement).toBe(items[1].el);

          items[2].el.focus();
          travel(items[2].el, 'Backspace');
          expect(props.value).toBe('13');
          expect(items[2].el.value).toBe('');

          travel(items[2].el, 'Backspace');
          expect(props.value).toBe('1');
          expect(items[0].el.value).toBe('1');
          expect(document.activeElement).toBe(items[1].el);

          cleanup();
        });
      }));

    it('removes every cell from the tab order when the group is disabled and locks out edits when readonly', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '', length: 3, disabled: true });
          const { containerEl, items, cleanup } = buildCode(props, 3);

          expect(containerEl.getAttribute('aria-disabled')).toBe('true');

          for (const { el } of items) {
            expect((el as HTMLInputElement).disabled).toBe(true);
            expect(el.getAttribute('tabindex')).toBe('-1');
          }

          items[0].el.focus();
          expect(travel(items[0].el, 'ArrowRight').defaultPrevented).toBe(false);
          expect(props.value).toBe('');

          props.disabled = false;
          props.readonly = true;
          expect(items[0].el.readOnly).toBe(true);
          items[0].el.focus();
          type(items[0].el, '7');
          expect(props.value).toBe('');
          paste(items[0].el, '789');
          expect(props.value).toBe('');
          travel(items[0].el, 'Backspace');
          expect(props.value).toBe('');

          cleanup();
        });
      }));
  });

  describe('Coordinated Value Synchronization Invariant', () => {
    it('gives the first cell the one-time-code hint and leaves the rest without it', () =>
      scope.run(() => {
        component().run(() => {
          const { containerEl, items, cleanup } = buildCode({ label: 'Verification code', value: '', length: 6 }, 6);

          expect(containerEl.getAttribute('role')).toBe('group');
          expect(containerEl.getAttribute('aria-label')).toBe('Verification code');

          expect(items[0].el.getAttribute('autocomplete')).toBe('one-time-code');
          for (const { el } of items.slice(1)) {
            expect(el.getAttribute('autocomplete')).not.toBe('one-time-code');
          }

          cleanup();
        });
      }));

    it('announces edits, completion and the committed value on blur via both DOM events and on* handlers', () =>
      scope.run(() => {
        component().run(() => {
          const edits: unknown[] = [];
          const commits: unknown[] = [];
          const completions: unknown[] = [];
          const propEdits: string[] = [];
          const propCommits: string[] = [];
          const propCompletions: string[] = [];

          const props = mutable<CodeInputProps>({
            value: '',
            length: 3,
            oninput: (e) => propEdits.push(e.detail),
            onchange: (e) => propCommits.push(e.detail),
            oncomplete: (e) => propCompletions.push(e.detail),
          });
          const { containerEl, items, cleanup } = buildCode(props, 3);

          containerEl.addEventListener('input', (event) => edits.push((event as CustomEvent).detail));
          containerEl.addEventListener('change', (event) => commits.push((event as CustomEvent).detail));
          containerEl.addEventListener('complete', (event) => completions.push((event as CustomEvent).detail));

          items[0].el.focus();
          type(items[0].el, '5');
          expect(edits).toEqual(['5']);
          expect(propEdits).toEqual(['5']);
          expect(commits).toEqual([]);
          expect(completions).toEqual([]);

          type(items[1].el, '6');
          type(items[2].el, '7');

          expect(props.value).toBe('567');
          expect(edits).toEqual(['5', '56', '567']);
          expect(propEdits).toEqual(['5', '56', '567']);
          expect(completions).toEqual(['567']);
          expect(propCompletions).toEqual(['567']);

          items[2].el.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: null }));
          expect(commits).toEqual(['567']);
          expect(propCommits).toEqual(['567']);

          items[2].el.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: null }));
          expect(commits).toEqual(['567']);
          expect(propCommits).toEqual(['567']);

          cleanup();
        });
      }));

    it('gives a custom host the textbox role, contenteditable, and the character it derives from the code', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<CodeInputProps>({ value: '98', length: 3 });
          const { items, cleanup } = buildCode(props, 3, 'custom');

          expect(items[0].el.getAttribute('role')).toBe('textbox');
          expect(items[0].el.getAttribute('contenteditable')).toBe('true');
          expect(items[2].el.getAttribute('role')).toBe('textbox');
          expect(items[0].el.textContent).toBe('9');
          expect(items[1].el.textContent).toBe('8');
          expect(items[2].el.textContent).toBe('');

          props.value = '7';
          expect(items[0].el.textContent).toBe('7');
          expect(items[1].el.textContent).toBe('');

          items[1].el.focus();
          type(items[1].el, '4');
          expect(props.value).toBe('74');
          expect(items[1].el.textContent).toBe('4');
          expect(document.activeElement).toBe(items[2].el);

          props.readonly = true;
          expect(items[0].el.getAttribute('contenteditable')).toBe('false');
          expect(items[0].el.getAttribute('aria-readonly')).toBe('true');

          props.readonly = false;
          props.disabled = true;
          expect(items[0].el.getAttribute('contenteditable')).toBe('false');
          expect(items[0].el.getAttribute('aria-disabled')).toBe('true');

          cleanup();
        });
      }));
  });
});
