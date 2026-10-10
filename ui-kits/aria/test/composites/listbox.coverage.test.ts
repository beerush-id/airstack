import { type AnyType, createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { aria, ListboxAria, type ListboxAttributes, type ListboxProps, type OptionAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

type Member = { value: string; option: OptionAria; el: HTMLElement };

function buildListbox(
  props: Partial<ListboxProps>,
  options: Array<{ value: string; text: string; disabled?: boolean }>
): { listbox: ListboxAria; listboxEl: HTMLElement; members: Member[]; cleanup: () => void } {
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

  return { listbox, listboxEl, members, cleanup } as AnyType;
}

function press(el: HTMLElement, key: string, init?: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

describe('Listbox - Coverage & Boundary Tests', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Namespace Invariant', () => {
    it('namespaces options under a generated container id and keeps a declared one', () =>
      scope.run(() => {
        component().run(() => {
          const generated = aria<HTMLDivElement>('listbox');
          const sibling = aria<HTMLDivElement>('listbox');
          const declared = aria<HTMLDivElement>('listbox', { id: 'cities' });

          expect(generated).toBeInstanceOf(ListboxAria);
          expect(generated.attributes.id).toMatch(/^listbox-/);
          expect(sibling.attributes.id).toMatch(/^listbox-/);
          expect(generated.attributes.id).not.toBe(sibling.attributes.id);
          expect(declared.attributes.id).toBe('cities');

          generated.destroy();
          sibling.destroy();
          declared.destroy();
        });
      }));

    it('holds the stop for an empty multiple registry', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ multiple: true, value: [] });
          const { listbox, listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          expect(listboxEl.getAttribute('aria-multiselectable')).toBe('true');
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          expect(listbox.value).toEqual([]);

          listbox.value = ['b'];
          expect(listboxEl.getAttribute('tabindex')).toBe('0');
          expect(members[1].el.getAttribute('aria-selected')).toBe('true');

          cleanup();
        });
      }));
  });

  describe('Guarded Interaction Invariant', () => {
    it('claims nothing on an empty container', () =>
      scope.run(() => {
        component().run(() => {
          const listbox = aria<HTMLDivElement>('listbox', { label: 'Cities' });
          const el = bind(document.createElement('div'), listbox);
          document.body.appendChild(el);

          el.focus();

          for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', ' ', 'Enter', 'c']) {
            expect(press(el, key).defaultPrevented).toBe(false);
          }

          expect(listbox.attributes['aria-label']).toBe('Cities');

          listbox.destroy();
          el.remove();
        });
      }));

    it('yields a keystroke the consumer canceled', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          listboxEl.addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
          members[0].el.focus();

          expect(press(members[0].el, 'ArrowDown').defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(members[0].el);

          cleanup();
        });
      }));

    it('leaves modifier chords and non-printable keys unclaimed', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ value: 'a' });
          const { members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          members[0].el.focus();

          for (const key of ['Escape', 'Shift', 'PageDown']) {
            expect(press(members[0].el, key).defaultPrevented).toBe(false);
          }

          expect(press(members[0].el, 'b', { ctrlKey: true }).defaultPrevented).toBe(false);
          expect(press(members[0].el, 'b', { metaKey: true }).defaultPrevented).toBe(false);
          expect(press(members[0].el, 'b', { altKey: true }).defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(members[0].el);
          expect(props.value).toBe('a');

          cleanup();
        });
      }));

    it('surrenders traversal to an enclosing toolbar rover', () =>
      scope.run(() => {
        component().run(() => {
          const toolbar = aria<HTMLDivElement>('toolbar', { label: 'Tools' });
          const toolbarEl = bind(document.createElement('div'), toolbar);
          document.body.appendChild(toolbarEl);

          const props = mutable<ListboxProps>({ value: 'a' });
          const listbox = aria<HTMLDivElement>('listbox', props as ListboxProps);
          const listboxEl = bind(document.createElement('div'), listbox);
          toolbarEl.appendChild(listboxEl);

          const option = aria<HTMLDivElement>('option', { value: 'a' });
          const first = bind(document.createElement('div'), option);
          first.textContent = 'Amsterdam';
          listboxEl.appendChild(first);

          const other = aria<HTMLDivElement>('option', { value: 'b' });
          const second = bind(document.createElement('div'), other);
          second.textContent = 'Berlin';
          listboxEl.appendChild(second);

          first.focus();
          expect(press(first, 'ArrowDown').defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(first);

          other.destroy();
          option.destroy();
          listbox.destroy();
          toolbar.destroy();
          listboxEl.remove();
          toolbarEl.remove();
        });
      }));
  });

  describe('Typeahead Reachability Invariant', () => {
    it('searches from the container when no option holds focus yet', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<ListboxProps>({ value: undefined });
          const { listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          listboxEl.focus();
          press(listboxEl, 'b');
          expect(document.activeElement).toBe(members[1].el);
          expect(props.value).toBeUndefined();

          vi.useRealTimers();
          cleanup();
        });
      }));

    it('drops a pending query when the container is torn down', () =>
      scope.run(() => {
        component().run(() => {
          vi.useFakeTimers();

          const props = mutable<ListboxProps>({ value: undefined });
          const { listbox, listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          listboxEl.focus();
          press(listboxEl, 'a');
          expect(document.activeElement).toBe(members[0].el);

          const clear = vi.spyOn(globalThis, 'clearTimeout');
          listbox.destroy();

          expect(clear).toHaveBeenCalled();
          clear.mockRestore();

          for (const { option } of members) {
            option.destroy();
          }

          listboxEl.remove();
          vi.useRealTimers();
          cleanup();
        });
      }));
  });

  describe('Deferred Compilation Invariant', () => {
    it('leaves the first compilation to a controller that inherits the listbox', () =>
      scope.run(() => {
        component().run(() => {
          let compiles = 0;

          class PopupListboxAria extends ListboxAria<HTMLDivElement, ListboxProps> {
            public constructor(props: Partial<ListboxProps> = {}) {
              super(props, true);

              this.properties.id = 'cities-popup';
              this.update();
            }

            protected override createAttributes(): ListboxAttributes<HTMLDivElement> {
              compiles += 1;

              return super.createAttributes();
            }
          }

          const popup = new PopupListboxAria({ value: 'a' });

          expect(compiles).toBe(1);
          expect(popup.attributes.id).toBe('cities-popup');
          expect(popup.attributes.role).toBe('listbox');

          popup.destroy();
        });
      }));

    it('compiles once at construction when the owner does not defer', () =>
      scope.run(() => {
        component().run(() => {
          let compiles = 0;

          class InlineListboxAria extends ListboxAria<HTMLDivElement, ListboxProps> {
            protected override createAttributes(): ListboxAttributes<HTMLDivElement> {
              compiles += 1;

              return super.createAttributes();
            }
          }

          const inline = new InlineListboxAria({ value: 'a' });

          expect(compiles).toBe(1);
          expect(inline.attributes.id).toMatch(/^listbox-/);

          inline.destroy();
        });
      }));
  });

  describe('Key Ownership Invariant', () => {
    it('owns its consumed keys and forwards the value on member commits after teardown stops', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<ListboxProps>({ id: 'cities', value: 'a', label: 'Cities' });
          const { listbox, listboxEl, members, cleanup } = buildListbox(props, [
            { value: 'a', text: 'Amsterdam' },
            { value: 'b', text: 'Berlin' },
          ]);

          for (const key of [
            'id',
            'label',
            'value',
            'multiple',
            'disabled',
            'required',
            'oninput',
            'onchange',
            'role',
            'tabindex',
            'aria-disabled',
          ]) {
            expect(listbox.ownKeys).toContain(key);
          }

          const commits: unknown[] = [];
          listboxEl.addEventListener('change', (event) => {
            commits.push((event as CustomEvent).detail);
          });

          members[1].el.click();
          expect(commits).toEqual(['b']);

          cleanup();

          expect(listbox.current).toBeNull();
        });
      }));
  });
});
