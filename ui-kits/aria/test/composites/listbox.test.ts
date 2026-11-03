import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, type ListboxProps, type OptionAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

type Member = { value: string; option: OptionAria; el: HTMLElement };

function buildListbox(
  props: Partial<ListboxProps>,
  options: Array<{ value: string; text: string; disabled?: boolean }>
) {
  const listbox = aria<HTMLDivElement>('listbox', props as ListboxProps);
  const listboxEl = bind(document.createElement('div'), listbox);
  document.body.appendChild(listboxEl);

  const members: Member[] = options.map(({ value, text, disabled }) => {
    const option = aria<HTMLDivElement>('option', { value, disabled });
    const el = bind(document.createElement('div'), option);
    el.textContent = text;
    listboxEl.appendChild(el);
    return { value, option, el };
  }) as AnyType[];

  const cleanup = () => {
    for (const { option } of members) {
      option.destroy();
    }

    listbox.destroy();
    listboxEl.remove();
  };

  return { listbox, listboxEl, members, cleanup };
}

function press(el: HTMLElement, key: string, init?: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

const stops = (members: Member[]): Array<string | null> => members.map(({ el }) => el.getAttribute('tabindex'));

describe('Listbox - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Single Tab Stop Invariant', () => {
    it('hands the stop to the selected option and takes it back while nothing is selected', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'b', label: 'Cities' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
            { value: 'c', text: 'Copenhagen' },
          ]);

          expect(listboxEl.getAttribute('role')).toBe('listbox');
          expect(listboxEl.getAttribute('aria-label')).toBe('Cities');
          expect(stops(members)).toEqual(['-1', '0', '-1']);
          expect(listboxEl.getAttribute('tabindex')).toBe('0');

          props.value = undefined;
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          expect(stops(members)).toEqual(['-1', '-1', '-1']);

          props.value = 'c';
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          expect(stops(members)).toEqual(['-1', '-1', '0']);

          cleanup();
        });
      }));

    it('compiles the archetype baselines and multiselectable only for the multiple list', () =>
      scope.run(() => {
        component().run(() => {
          const single = aria<HTMLDivElement>('listbox', { label: 'Cities' });
          expect(single.attributes.role).toBe('listbox');
          expect(single.attributes['aria-required']).toBeUndefined();
          expect(single.attributes['aria-disabled']).toBe('false');
          expect(single.attributes['aria-multiselectable']).toBeUndefined();
          expect(single.attributes.tabindex).toBe(0);

          single.properties.required = true;
          expect(single.attributes['aria-required']).toBe('true');

          const multiple = aria<HTMLDivElement>('listbox', { multiple: true });
          expect(multiple.attributes['aria-multiselectable']).toBe('true');

          single.destroy();
          multiple.destroy();
        });
      }));
  });

  describe('Roving Traversal Invariant', () => {
    it('wraps focus across enabled options with every arrow and commits nothing', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
            { value: 'c', text: 'Copenhagen' },
          ]);

          const [amsterdam, berlin, copenhagen] = members;
          amsterdam.el.focus();

          expect(press(amsterdam.el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(berlin.el);

          expect(press(berlin.el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(copenhagen.el);

          expect(press(copenhagen.el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(amsterdam.el);

          expect(press(amsterdam.el, 'ArrowUp').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(copenhagen.el);

          expect(props.value).toBe('a');
          expect(stops(members)).toEqual(['0', '-1', '-1']);

          cleanup();
        });
      }));

    it('steps over disabled options and sends Home and End to the ends', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin', disabled: true },
            { value: 'c', text: 'Copenhagen' },
          ]);

          expect(members[1].el.getAttribute('aria-disabled')).toBe('true');
          expect(members[1].el.getAttribute('tabindex')).toBe('-1');

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[2].el);

          press(members[2].el, 'ArrowUp');
          expect(document.activeElement).toBe(members[0].el);

          press(members[0].el, 'End');
          expect(document.activeElement).toBe(members[2].el);

          press(members[2].el, 'Home');
          expect(document.activeElement).toBe(members[0].el);

          expect(props.value).toBe('a');
          cleanup();
        });
      }));

    it('claims no traversal key while the container is disabled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a', disabled: false });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          props.disabled = true;
          expect(listboxEl.getAttribute('aria-disabled')).toBe('true');
          expect(listboxEl.hasAttribute('tabindex')).toBe(false);

          members[0].el.focus();
          for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', ' ', 'Enter', 'b']) {
            expect(press(listboxEl, key).defaultPrevented).toBe(false);
          }

          expect(props.value).toBe('a');
          members[1].el.click();
          expect(props.value).toBe('a');

          props.disabled = false;
          members[1].el.click();
          expect(props.value).toBe('b');

          cleanup();
        });
      }));
  });

  describe('Activation Invariant', () => {
    it('commits the option traversal landed on and moves the stop with it', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({});
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          listboxEl.focus();
          expect(listboxEl.getAttribute('tabindex')).toBe('0');

          expect(press(listboxEl, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);
          expect(props.value).toBeUndefined();

          expect(press(members[0].el, ' ').defaultPrevented).toBe(true);
          expect(props.value).toBe('a');
          expect(stops(members)).toEqual(['0', '-1']);

          press(members[0].el, 'ArrowDown');
          expect(document.activeElement).toBe(members[1].el);

          press(members[1].el, 'Enter');
          expect(props.value).toBe('b');
          expect(stops(members)).toEqual(['-1', '0']);

          cleanup();
        });
      }));

    it('keeps traversal out of the selection and toggles membership in the multiple list', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ multiple: true, value: ['a'] });
          const { members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
            { value: 'c', text: 'Copenhagen' },
          ]);

          members[0].el.focus();
          press(members[0].el, 'ArrowDown');
          expect(props.value).toEqual(['a']);
          expect(document.activeElement).toBe(members[1].el);

          press(members[1].el, ' ');
          expect(props.value).toEqual(['a', 'b']);

          press(members[1].el, 'Enter');
          expect(props.value).toEqual(['a']);

          press(members[2].el, ' ');
          expect(props.value).toEqual(['a', 'b']);
          expect(document.activeElement).toBe(members[1].el);

          cleanup();
        });
      }));

    it('refuses releasing the holder while required and releases it once optional', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a', required: true });
          const { members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[0].el.focus();
          press(members[0].el, 'Enter');
          expect(props.value).toBe('a');
          expect(members[0].el.getAttribute('aria-selected')).toBe('true');

          props.required = false;
          press(members[0].el, 'Enter');
          expect(props.value).toBeUndefined();

          cleanup();
        });
      }));

    it('claims nothing from the container while an optional registry stays empty', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: undefined });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(props.value).toBeUndefined();
          expect(stops(members)).toEqual(['-1', '-1']);
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          expect(listboxEl.hasAttribute('aria-required')).toBe(false);

          cleanup();
        });
      }));

    it('lets the first mounted option claim a required registry', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ required: true });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(listboxEl.getAttribute('aria-required')).toBe('true');
          expect(props.value).toBe('a');
          expect(stops(members)).toEqual(['0', '-1']);
          expect(listboxEl.getAttribute('tabindex')).toBe('0');

          cleanup();
        });
      }));
  });

  describe('Typeahead Invariant', () => {
    it('focuses the option whose text matches without touching the selection', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'co', text: 'Cologne' },
            { value: 'cop', text: 'Copenhagen' },
            { value: 'd', text: 'Dublin' },
          ]);

          members[0].el.focus();

          press(listboxEl, 'c');
          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toBe('a');

          press(listboxEl, 'o');
          expect(document.activeElement).toBe(members[2].el);

          press(listboxEl, 'p');
          expect(document.activeElement).toBe(members[2].el);

          vi.advanceTimersByTime(500);

          press(listboxEl, 'c');
          expect(document.activeElement).toBe(members[1].el);

          vi.useRealTimers();
          cleanup();
        });
      }));

    it('cycles through options sharing a prefix and stays silent when none answers', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'cologne', text: 'Cologne' },
            { value: 'copenhagen', text: 'Copenhagen' },
          ]);

          members[0].el.focus();

          press(listboxEl, 'c');
          expect(document.activeElement).toBe(members[1].el);

          press(listboxEl, 'c');
          expect(document.activeElement).toBe(members[2].el);

          press(listboxEl, 'c');
          expect(document.activeElement).toBe(members[1].el);

          press(listboxEl, 'z');
          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toBe('a');

          cleanup();
        });
      }));
  });

  describe('Announcement Invariant', () => {
    it('announces roving as input from the option and keeps the commit alone as change', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[0].el.focus();

          const seen: Array<{ kind: string; detail: unknown }> = [];
          for (const kind of ['input', 'change']) {
            listboxEl.addEventListener(kind, (event) =>
              seen.push({
                kind,
                detail: (event as CustomEvent).detail,
              })
            );
          }

          press(members[0].el, 'ArrowDown');

          expect(seen.filter((entry) => entry.kind === 'input')).toEqual([{ kind: 'input', detail: 'b' }]);

          press(members[1].el, 'Enter');
          expect(props.value).toBe('b');
          expect(seen.filter((entry) => entry.kind === 'change')).toEqual([{ kind: 'change', detail: 'b' }]);

          cleanup();
        });
      }));

    it('announces the option the cursor landed on while the query accumulates on props', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'co', text: 'Cologne' },
            { value: 'cop', text: 'Copenhagen' },
          ]);

          members[0].el.focus();

          const queries: unknown[] = [];
          listboxEl.addEventListener('input', (event) => queries.push((event as CustomEvent).detail));

          press(listboxEl, 'c');
          press(listboxEl, 'o');

          expect(queries).toEqual(['co', 'cop']);
          expect(props.value).toBe('a');

          vi.useRealTimers();
          cleanup();
        });
      }));

    it('announces the whole value on the container for a commit made by an option', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          const commits: Array<{ kind: string; detail: unknown }> = [];
          for (const kind of ['input', 'change']) {
            listboxEl.addEventListener(kind, (event) =>
              commits.push({
                kind,
                detail: (event as CustomEvent).detail,
              })
            );
          }

          members[1].el.click();

          expect(props.value).toBe('b');
          expect(commits.filter((entry) => entry)).toEqual([{ kind: 'change', detail: 'b' }]);

          cleanup();
        });
      }));

    it('stays silent when the value moves through an external write', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          const commits: unknown[] = [];
          listboxEl.addEventListener('change', (event) => {
            if (event.target === listboxEl) commits.push((event as CustomEvent).detail);
          });

          props.value = 'b';
          expect(members[1].el.getAttribute('tabindex')).toBe('0');
          expect(commits).toEqual([]);

          cleanup();
        });
      }));
  });
});
