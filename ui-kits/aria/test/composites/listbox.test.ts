import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ListboxProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildListbox(
  props: Partial<ListboxProps>,
  options: Array<{ value: string; label: string; disabled?: boolean }>,
  host: 'custom' | 'native' = 'custom',
) {
  const listbox =
    host === 'native'
      ? aria<HTMLSelectElement>('listbox', props as ListboxProps, { native: true })
      : aria<HTMLDivElement>('listbox', props as ListboxProps);

  const listboxEl = bind(
    document.createElement(host === 'native' ? 'select' : 'div'),
    listbox,
  ) as HTMLSelectElement | HTMLDivElement;
  document.body.appendChild(listboxEl);

  const members = options.map(({ value, label, disabled }) => {
    const option =
      host === 'native'
        ? aria<HTMLOptionElement>('option', { value, label, disabled }, { native: true })
        : aria<HTMLDivElement>('option', { value, label, disabled });

    const el = bind(document.createElement(host === 'native' ? 'option' : 'div'), option);
    el.dataset.value = value;
    listboxEl.appendChild(el);
    return { value, option, el };
  });

  const cleanup = () => {
    for (const { option } of members) {
      option.destroy();
    }

    listbox.destroy();
    listboxEl.remove();
  };

  return { listbox, listboxEl, members, cleanup };
}

function press(el: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

const activeOption = (listboxEl: HTMLElement) =>
  document.getElementById(listboxEl.getAttribute('aria-activedescendant') ?? '');

describe('Listbox - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Virtual Selection & Active Descendant Invariant', () => {
    it('keeps one container tab stop and exposes the active option by address', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'b', label: 'Cities' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam' },
            { value: 'b', label: 'Berlin' },
            { value: 'c', label: 'Copenhagen' },
          ]);

          // The container is the only stop; options are never focusable
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          for (const { el } of members) {
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(el.getAttribute('role')).toBe('option');
          }

          // Entry lands on the selected option, addressed rather than focused
          expect(listboxEl.getAttribute('aria-activedescendant')).toBe(
            members[1].el.getAttribute('id'),
          );
          expect(activeOption(listboxEl)).toBe(members[1].el);
          expect(document.activeElement).not.toBe(members[1].el);

          expect(members[1].el.getAttribute('aria-selected')).toBe('true');
          expect(members[0].el.getAttribute('aria-selected')).toBe('false');

          cleanup();
        });
      }));

    it('enters on the first enabled option when nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: undefined });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam', disabled: true },
            { value: 'b', label: 'Berlin' },
            { value: 'c', label: 'Copenhagen' },
          ]);

          // A disabled first option cannot be the entry point
          expect(listboxEl.getAttribute('aria-activedescendant')).toBe(
            members[1].el.getAttribute('id'),
          );
          expect(members[0].el.getAttribute('aria-disabled')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Linear Directional Navigation Invariant', () => {
    it('commits the active option on every move in a single listbox and clamps at the ends', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam' },
            { value: 'b', label: 'Berlin', disabled: true },
            { value: 'c', label: 'Copenhagen' },
            { value: 'd', label: 'Dublin' },
          ]);

          listboxEl.focus();
          expect(document.activeElement).toBe(listboxEl);

          press(listboxEl, 'ArrowDown');
          expect(activeOption(listboxEl)).toBe(members[2].el);
          expect(props.value).toBe('c');
          expect(members[2].el.getAttribute('aria-selected')).toBe('true');
          expect(members[0].el.getAttribute('aria-selected')).toBe('false');

          press(listboxEl, 'ArrowDown');
          expect(props.value).toBe('d');

          // Clamping: past the last option nothing moves and nothing re-commits
          const commits: unknown[] = [];
          listboxEl.addEventListener('change', (event) =>
            commits.push((event as CustomEvent).detail),
          );
          press(listboxEl, 'ArrowDown');
          expect(props.value).toBe('d');
          expect(commits).toEqual([]);

          press(listboxEl, 'Home');
          expect(props.value).toBe('a');

          press(listboxEl, 'End');
          expect(props.value).toBe('d');

          cleanup();
        });
      }));

    it('jumps to a matching label on typeahead and holds the query for half a second', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam' },
            { value: 'co', label: 'Cologne' },
            { value: 'cm', label: 'Copenhagen' },
            { value: 'd', label: 'Dublin' },
          ]);

          listboxEl.focus();

          press(listboxEl, 'c');
          expect(activeOption(listboxEl)).toBe(members[1].el);
          expect(props.value).toBe('co');

          // A second character inside the window narrows to the longer match
          press(listboxEl, 'm');
          expect(activeOption(listboxEl)).toBe(members[2].el);

          vi.advanceTimersByTime(500);

          // After the window the next character starts a fresh query
          press(listboxEl, 'd');
          expect(activeOption(listboxEl)).toBe(members[3].el);

          vi.useRealTimers();
          cleanup();
        });
      }));

    it('announces both the running value and the committed one on a custom host', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam' },
            { value: 'b', label: 'Berlin' },
          ]);

          const live: unknown[] = [];
          const commits: unknown[] = [];
          listboxEl.addEventListener('input', (event) => live.push((event as CustomEvent).detail));
          listboxEl.addEventListener('change', (event) =>
            commits.push((event as CustomEvent).detail),
          );

          listboxEl.focus();
          const down = press(listboxEl, 'ArrowDown');

          expect(down.defaultPrevented).toBe(true);
          expect(live).toEqual(['b']);
          expect(commits).toEqual(['b']);
          expect(props.value).toBe('b');

          cleanup();
        });
      }));
  });

  describe('Host Parity & Multi-Select Coordination Invariant', () => {
    it('separates travel from commitment in a multi-select listbox', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ multiple: true, value: ['a'] });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', label: 'Amsterdam' },
            { value: 'b', label: 'Berlin' },
            { value: 'c', label: 'Copenhagen' },
          ]);

          expect(listboxEl.getAttribute('aria-multiselectable')).toBe('true');
          expect(members[0].el.getAttribute('aria-selected')).toBe('true');

          listboxEl.focus();

          press(listboxEl, 'ArrowDown');
          expect(activeOption(listboxEl)).toBe(members[1].el);
          expect(props.value).toEqual(['a']);
          expect(members[1].el.getAttribute('aria-selected')).toBe('false');

          press(listboxEl, ' ');
          expect(props.value).toEqual(['a', 'b']);
          expect(members[1].el.getAttribute('aria-selected')).toBe('true');

          press(listboxEl, 'Enter');
          expect(props.value).toEqual(['a']);
          expect(members[1].el.getAttribute('aria-selected')).toBe('false');

          // The active option stays highlighted through the toggle
          expect(activeOption(listboxEl)).toBe(members[1].el);

          cleanup();
        });
      }));

    it('leaves a native select list to the browser and syncs its option properties', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'b' });
          const { listboxEl, members, cleanup } = buildListbox(
            props,
            [{ value: 'a', label: 'Amsterdam' }, { value: 'b', label: 'Berlin' }],
            'native',
          );

          const select = listboxEl as HTMLSelectElement;
          select.size = 4;

          // A native <select> already is the listbox and its options are already options
          expect(select.hasAttribute('role')).toBe(false);
          expect(members[0].el.hasAttribute('role')).toBe(false);
          expect(members[0].el.hasAttribute('tabindex')).toBe(false);

          // Selection is expressed through the option property, not an ARIA mirror
          expect((members[1].el as HTMLOptionElement).selected).toBe(true);
          expect((members[0].el as HTMLOptionElement).selected).toBe(false);
          expect(members[1].el.hasAttribute('aria-selected')).toBe(false);
          expect(select.hasAttribute('aria-activedescendant')).toBe(false);

          // Native interaction is forwarded, never replayed
          const events: string[] = [];
          select.addEventListener('input', () => events.push('input'));
          select.addEventListener('change', () => events.push('change'));

          (members[0].el as HTMLOptionElement).selected = true;
          (members[1].el as HTMLOptionElement).selected = false;
          select.dispatchEvent(new Event('change', { bubbles: true }));

          expect(props.value).toBe('a');
          expect(events).toEqual(['change']);

          cleanup();
        });
      }));
  });
});
